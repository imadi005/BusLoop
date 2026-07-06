import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';
import { X, Navigation, Clock, Bus, MapPin, RefreshCw, Radio } from 'lucide-react';

const tint = (color, amount = 12) => `color-mix(in srgb, ${color} ${amount}%, transparent)`;

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function createBusIcon(color) {
  const c = color || '#EF3E42';
  return L.divIcon({
    html: `
      <div style="position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:52px;height:52px;border-radius:50%;background:${c};opacity:0.18;animation:busRing 2s ease-out infinite;"></div>
        <div style="position:absolute;width:64px;height:64px;border-radius:50%;background:${c};opacity:0.08;animation:busRing 2s ease-out 0.6s infinite;"></div>
        <div style="width:40px;height:40px;border-radius:50%;background:${c};display:flex;align-items:center;justify-content:center;box-shadow:0 4px 18px ${c}80;border:3px solid white;z-index:1;">
          <svg width='17' height='17' viewBox='0 0 24 24' fill='white'><path d='M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4S4 2.5 4 6v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z'/></svg>
        </div>
      </div>`,
    className: '', iconSize: [52, 52], iconAnchor: [26, 26],
  });
}

/* ── Map component that re-centers when pos changes ── */
function TrackingMap({ pos, color }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.setView(pos, 15, { animate: true, duration: 1 });
  }, [pos]);
  return pos ? <Marker position={pos} icon={createBusIcon(color)} /> : null;
}

/* ── Main exported modal ── */
export default function LiveBusMapModal({ bus, onClose }) {
  const [pos, setPos]           = useState(null);    // [lat, lng]
  const [trip, setTrip]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [pingCount, setPingCount]   = useState(0);
  const unsubRef = useRef(null);

  const busColor = bus?.route_color || '#EF3E42';

  useEffect(() => {
    if (!bus) return;
    load();
    return cleanup;
  }, [bus?.id]);

  const cleanup = () => {
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
  };

  const load = async () => {
    setLoading(true);
    setPos(null); setTrip(null);
    try {
      // 1. Find the active trip for this bus
      const { data: tripData } = await supabase
        .from('trips')
        .select('id, started_at, from_location, to_location, staff!driver_id ( full_name, phone )')
        .eq('bus_id', bus.id)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setTrip(tripData);

      if (!tripData) { setLoading(false); return; }

      // 2. Latest location for the trip
      const { data: loc } = await supabase
        .from('locations')
        .select('lat, lng, timestamp')
        .eq('trip_id', tripData.id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (loc) {
        setPos([parseFloat(loc.lat), parseFloat(loc.lng)]);
        setLastUpdate(new Date(loc.timestamp));
      }

      // 3. Real-time subscription — follow the bus live
      cleanup();
      const channel = supabase
        .channel(`live_bus_${bus.id}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'locations', filter: `trip_id=eq.${tripData.id}` },
          payload => {
            const l = payload.new;
            setPos([parseFloat(l.lat), parseFloat(l.lng)]);
            setLastUpdate(new Date(l.timestamp));
            setPingCount(c => c + 1);
          })
        .subscribe();
      unsubRef.current = () => supabase.removeChannel(channel);

    } catch (err) {
      console.error('[LiveBusMapModal] load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const secAgo = lastUpdate
    ? Math.round((Date.now() - lastUpdate.getTime()) / 1000)
    : null;

  const elapsed = trip?.started_at
    ? Math.floor((Date.now() - new Date(trip.started_at).getTime()) / 60000)
    : null;

  if (!bus) return null;

  return (
    /* Full-screen overlay */
    <div style={{
      position: 'fixed', inset: 0, zIndex: 700,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }}
      onClick={onClose}
    >
      {/* Sheet — stops event propagation */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          borderRadius: '24px 24px 0 0',
          overflow: 'hidden',
          maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          animation: 'slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 20px 14px',
          borderBottom: '1px solid var(--border)',
        }}>
          {/* Bus icon */}
          <div style={{
            width: 46, height: 46, borderRadius: 14, flexShrink: 0, overflow: 'hidden',
            background: tint(busColor, 12), border: `1.5px solid ${tint(busColor, 20)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem',
          }}>
            {bus.photo_url
              ? <img src={bus.photo_url} alt={bus.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : '🚌'}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>{bus.name}</span>
              {pos && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(18,183,106,0.12)', border: '1px solid rgba(18,183,106,0.25)', borderRadius: 99, padding: '2px 8px' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', animation: 'livePulse 1.5s ease-in-out infinite' }} />
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--success)' }}>LIVE</span>
                </div>
              )}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {bus.registration_no} · {bus.route_name || 'No route'}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Map */}
        <div style={{ height: 300, position: 'relative', flexShrink: 0 }}>
          {loading ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: 12 }}>
              <RefreshCw size={28} color="var(--brand)" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Finding bus location…</span>
            </div>
          ) : !trip ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: 10 }}>
              <div style={{ fontSize: '2.5rem' }}>🔌</div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>No Active Trip</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '0 24px' }}>
                {bus.name} doesn't have an active trip right now. Wait for the driver to start one.
              </div>
            </div>
          ) : !pos ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: 10 }}>
              <div style={{ fontSize: '2.5rem' }}>📡</div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Awaiting GPS Signal</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '0 24px' }}>
                Trip is active but no location pings yet. The driver's GPS will appear here shortly.
              </div>
              <button
                onClick={load}
                style={{ marginTop: 8, background: 'rgba(239,62,66,0.12)', color: 'var(--brand)', border: '1px solid rgba(239,62,66,0.3)', borderRadius: 12, padding: '8px 18px', cursor: 'pointer', fontFamily: 'var(--font-main)', fontWeight: 600, fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : (
            <MapContainer
              center={pos}
              zoom={15}
              style={{ width: '100%', height: '100%' }}
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />
              <TrackingMap pos={pos} color={busColor} />
            </MapContainer>
          )}

          {/* Coordinates overlay */}
          {pos && (
            <div style={{
              position: 'absolute', bottom: 12, left: 12, zIndex: 500,
              background: 'rgba(13,21,38,0.9)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.22)',
              padding: '6px 12px', borderRadius: 10,
              fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)',
            }}>
              📌 {pos[0].toFixed(5)}, {pos[1].toFixed(5)}
            </div>
          )}

          {/* Last update chip */}
          {secAgo !== null && (
            <div style={{
              position: 'absolute', top: 12, right: 12, zIndex: 500,
              background: secAgo < 30 ? 'rgba(18,183,106,0.9)' : 'rgba(247,144,9,0.9)',
              backdropFilter: 'blur(8px)',
              padding: '5px 10px', borderRadius: 99,
              fontSize: '0.7rem', fontWeight: 700, color: 'white',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <Radio size={11} />
              {secAgo < 5 ? 'Just now' : `${secAgo}s ago`}
            </div>
          )}
        </div>

        {/* Info strip */}
        {trip && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1,
            background: 'var(--bg-card)',
            borderTop: '1px solid var(--border)',
          }}>
            {[
              { icon: Clock, label: 'Duration', value: elapsed !== null ? `${elapsed} min` : '—', color: 'var(--info)' },
              { icon: Navigation, label: 'GPS Pings', value: pingCount, color: 'var(--success)' },
              { icon: Bus, label: 'Capacity', value: bus.capacity || '—', color: busColor },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} style={{ padding: '14px 10px', textAlign: 'center' }}>
                <Icon size={14} color={color} style={{ marginBottom: 5 }} />
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{value}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Trip route summary */}
        {trip && (trip.from_location || trip.to_location) && (
          <div style={{ padding: '12px 20px 20px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)' }}>
            <MapPin size={13} color={busColor} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--success)' }}>{trip.from_location || '?'}</strong>
              <span style={{ color: 'var(--text-primary)', margin: '0 6px' }}>→</span>
              <strong style={{ color: 'var(--brand)' }}>{trip.to_location || '?'}</strong>
            </span>
            {trip.staff?.full_name && (
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
                👨‍✈️ {trip.staff.full_name.split(' ')[0]}
              </span>
            )}
          </div>
        )}
        {trip && !trip.from_location && !trip.to_location && (
          <div style={{ height: 16, background: 'var(--bg-card)' }} />
        )}
      </div>

      <style>{`
        @keyframes busRing    { 0%{transform:scale(1);opacity:0.5} 100%{transform:scale(2.8);opacity:0} }
        @keyframes spin       { to{transform:rotate(360deg)} }
        @keyframes livePulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.3;transform:scale(1.6)} }
        @keyframes slideUp    { from{transform:translateY(100%);opacity:0.5} to{transform:none;opacity:1} }
      `}</style>
    </div>
  );
}
