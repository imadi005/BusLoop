import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';
import { tripService } from '../../services/api';
import { MapPin, Bus } from 'lucide-react';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function createBusIcon(color) {
  const c = color || 'var(--brand)';
  return L.divIcon({
    html: `
      <div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:44px;height:44px;border-radius:50%;background:${c};opacity:0.22;animation:busRing 2s ease-out infinite;"></div>
        <div style="width:36px;height:36px;border-radius:50%;background:${c};display:flex;align-items:center;justify-content:center;box-shadow:0 3px 12px rgba(0,0,0,0.35);border:3px solid white;z-index:1;">
          <svg width='15' height='15' viewBox='0 0 24 24' fill='white'><path d='M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4S4 2.5 4 6v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z'/></svg>
        </div>
      </div>`,
    className: '', iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -26],
  });
}

const DEFAULT_CENTER = [13.0395, 77.6240];

export default function OperatorMap() {
  const [activeTrips, setActiveTrips] = useState([]);
  const [positions, setPositions] = useState({});
  const unsubRef = useRef(null);

  useEffect(() => {
    loadData();
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, []);

  const loadData = async () => {
    try {
      const trips = await tripService.getAllActive();
      setActiveTrips(trips);

      const initialPos = {};
      await Promise.all(trips.map(async trip => {
        const { data } = await supabase
          .from('locations')
          .select('lat,lng')
          .eq('trip_id', trip.id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) initialPos[trip.id] = { lat: parseFloat(data.lat), lng: parseFloat(data.lng) };
      }));
      setPositions(initialPos);

      if (unsubRef.current) unsubRef.current();
      const channel = supabase.channel('operator_map_locations')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'locations' }, payload => {
          const loc = payload.new;
          setPositions(prev => ({
            ...prev,
            [loc.trip_id]: { lat: parseFloat(loc.lat), lng: parseFloat(loc.lng) }
          }));
        })
        .subscribe();
      unsubRef.current = () => supabase.removeChannel(channel);

    } catch (err) {
      console.error('Failed to load map data', err);
    }
  };

  const mapTrips = activeTrips.filter(t => positions[t.id]);

  return (
    <div style={{ position: 'fixed', top: 164, bottom: 86, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, zIndex: 10 }}>
      <MapContainer center={DEFAULT_CENTER} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {mapTrips.map(trip => {
          const pos = positions[trip.id];
          if (!pos) return null;
          return (
            <Marker key={trip.id} position={[pos.lat, pos.lng]} icon={createBusIcon('var(--brand)')}>
              <Popup className="bus-popup" maxWidth={220} closeButton={false}>
                <div style={{ fontFamily: 'Inter,sans-serif', padding: '4px 2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(239,62,66,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Bus size={16} color="var(--brand)" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{trip.buses?.name || 'Unknown Bus'}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{trip.buses?.registration_no}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                    👨‍✈️ {trip.staff?.full_name || 'Driver'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--success)', background: 'var(--success-bg)', padding: '4px 8px', borderRadius: 8, fontWeight: 600 }}>
                    Status: Active Trip
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      
      {/* Overlay indicator */}
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 500, background: 'white', padding: '8px 12px', borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)', animation: 'busRing 1.5s ease-out infinite' }} />
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{mapTrips.length} Live Buses</span>
      </div>

      <style>{`
        @keyframes busRing { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(2.5);opacity:0} }
        .leaflet-popup-content-wrapper { border-radius:14px!important;box-shadow:0 8px 32px rgba(0,0,0,0.18)!important;padding:0!important; }
        .leaflet-popup-content { margin:14px!important; }
        .leaflet-popup-tip-container { display:none!important; }
      `}</style>
    </div>
  );
}
