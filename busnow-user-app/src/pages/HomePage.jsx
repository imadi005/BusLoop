import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Bus, RefreshCw, MapPin, ChevronRight, X, Zap, Navigation } from 'lucide-react';
import { busService, locationService, routeService } from '../services/api';
import { getRoadRoute } from '../services/routing';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { MOCK_BUSES, MOCK_STOPS } from '../data/mockData';
import BusCard from '../components/BusCard';
import BottomNav from '../components/BottomNav';
import { canUseMockData } from '../config/appMode';
import { captureError } from '../utils/observability';

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Animated pulsing bus marker
function createBusIcon(color) {
  const c = color || 'var(--brand)';
  return L.divIcon({
    html: `
      <div style="position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:52px;height:52px;border-radius:50%;background:${c};opacity:0.15;animation:busRing 2s ease-out infinite;"></div>
        <div style="position:absolute;width:38px;height:38px;border-radius:50%;background:${c};opacity:0.09;animation:busRing 2s ease-out infinite 0.6s;"></div>
        <div style="width:38px;height:38px;border-radius:50%;background:${c};display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,0.4);border:3px solid white;z-index:1;">
          <svg width='18' height='18' viewBox='0 0 24 24' fill='white'><path d='M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4S4 2.5 4 6v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z'/></svg>
        </div>
      </div>`,
    className: '', iconSize: [52, 52], iconAnchor: [26, 26], popupAnchor: [0, -30],
  });
}

// SmoothMarker — uses Leaflet's setLatLng() so the pin glides instead of jumping
function SmoothMarker({ position, icon, children }) {
  const markerRef = useRef(null);
  useEffect(() => {
    if (markerRef.current && Array.isArray(position) && position.length === 2) {
      markerRef.current.setLatLng(position);
    }
  }, [position[0], position[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Marker ref={markerRef} position={position} icon={icon}>
      {children}
    </Marker>
  );
}

const userIcon = L.divIcon({
  html: `<div style="position:relative;width:24px;height:24px;">
    <div style="width:24px;height:24px;background:var(--info);border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(49,130,206,0.6);"></div>
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:46px;height:46px;background:rgba(49,130,206,0.18);border-radius:50%;animation:pulseRing 2s ease-out infinite;"></div>
  </div>`,
  className: '', iconSize: [24, 24], iconAnchor: [12, 12],
});

function PanTo({ pos, zoom = 15 }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.setView(pos, zoom, { animate: true, duration: 1.2 });
  }, [pos?.[0], pos?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function UserLocateButton({ onLocate }) {
  const map = useMap();
  const [locating, setLocating] = useState(false);
  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const latlng = [pos.coords.latitude, pos.coords.longitude];
        onLocate(latlng);
        map.setView(latlng, 16, { animate: true });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };
  return (
    <button className="map-locate-btn" style={{ bottom: 'calc(var(--nav-height) + 72px)' }} onClick={locate} aria-label="My location">
      {locating
        ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
        : <MapPin size={18} />}
    </button>
  );
}

// Fetch the latest GPS ping for each active trip
async function fetchActiveBusPositions(trips) {
  if (!trips?.length) return {};
  const results = {};
  await Promise.all(
    trips.map(async trip => {
      try {
        const { data } = await supabase
          .from('locations')
          .select('lat,lng,timestamp')
          .eq('trip_id', trip.id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          results[String(trip.bus_id)] = {
            lat: parseFloat(data.lat),
            lng: parseFloat(data.lng),
            isPlaceholder: false,
          };
        }
      } catch { /* skip */ }
    })
  );
  return results;
}

const DEFAULT_CENTER = [13.0395, 77.6240];

export default function HomePage() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [buses, setBuses]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showSheet, setShowSheet]       = useState(false);
  const [busPositions, setBusPositions] = useState({});
  const [userLocation, setUserLocation] = useState(null);
  const [panToUser, setPanToUser]       = useState(null);
  const [routeOverlay, setRouteOverlay] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState('connecting'); // 'connecting'|'live'|'error'

  const locatedRef   = useRef(false);
  const channelsRef  = useRef([]);   // all supabase channel refs for cleanup
  const tripsRef     = useRef([]);

  // ── Auto-locate user on first load ──────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => {
        const latlng = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(latlng);
        if (!locatedRef.current) { setPanToUser(latlng); locatedRef.current = true; }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
    );
  }, []);

  // ── Cleanup helper — unsubscribe all channels ────────────────────────────
  const cleanupChannels = useCallback(() => {
    channelsRef.current.forEach(ch => { try { supabase.removeChannel(ch); } catch {} });
    channelsRef.current = [];
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // Active trips — select only columns guaranteed to exist in the DB.
      // from_location / to_location are optional (migration 007 may not be run yet);
      // we fall back to route-level origin/destination from the bus record.
      let trips = null;
      const { data: tripsWithLoc, error: tripErrFull } = await supabase
        .from('trips')
        .select('id,bus_id,from_location,to_location')
        .eq('status', 'active');

      if (tripErrFull) {
        // Likely the from_location / to_location columns don't exist yet.
        // Fall back to selecting just the guaranteed columns.
        console.warn('[HomePage] Full trips fetch failed, retrying without optional columns:', tripErrFull.message);
        const { data: tripsBase, error: tripErrBase } = await supabase
          .from('trips')
          .select('id,bus_id')
          .eq('status', 'active');

        if (tripErrBase) {
          console.error('[HomePage] Base trips fetch also failed:', tripErrBase.message);
          tripsRef.current = [];
          setBuses([]);
          setBusPositions({});
          return;
        }
        trips = (tripsBase || []).map(t => ({ ...t, from_location: null, to_location: null }));
      } else {
        trips = tripsWithLoc || [];
      }

      if (!trips.length) {
        tripsRef.current = [];
        setBuses([]);
        setBusPositions({});
        return;
      }

      tripsRef.current = trips;

      // Build bus_id (string) → trip lookup
      const tripMap = {};
      trips.forEach(t => { tripMap[String(t.bus_id)] = t; });
      const liveBusIds = Object.keys(tripMap); // string UUIDs

      // Fetch all bus records; filter to only those with live trips
      const busData = await busService.getAll().catch(() => []);
      const allBusData = busData.length > 0 ? busData : (canUseMockData() ? MOCK_BUSES : []);
      const activeBusList = allBusData
        .filter(b => liveBusIds.includes(String(b.id)))
        .map(b => {
          const t = tripMap[String(b.id)];
          return {
            ...b,
            trip_id:           t.id,
            trip_from:         t.from_location || null,
            trip_to:           t.to_location   || null,
            route_origin:      t.from_location || b.route_origin      || null,
            route_destination: t.to_location   || b.route_destination || null,
          };
        });

      // Fetch latest GPS positions
      const livePos = await fetchActiveBusPositions(trips);

      // Buses with no GPS ping yet get a placeholder near city centre
      const initPos = {};
      activeBusList.forEach(b => {
        const key = String(b.id);
        if (livePos[key]) {
          initPos[key] = livePos[key];
        } else {
          const spread = (Math.random() - 0.5) * 0.02;
          initPos[key] = {
            lat: DEFAULT_CENTER[0] + spread,
            lng: DEFAULT_CENTER[1] + spread,
            isPlaceholder: true,
          };
        }
      });

      setBuses(activeBusList);
      setBusPositions(initPos);
    } catch (err) {
      captureError(err, { area: 'HomePage.loadAll' });
      setBuses([]);
      setBusPositions({});
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Subscribe to realtime events ─────────────────────────────────────────
  const setupRealtime = useCallback(() => {
    cleanupChannels();

    // Channel 1: live location pings → update individual bus marker position
    const locChannel = supabase
      .channel('home_locations_v2')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'locations' },
        payload => {
          const loc = payload.new;
          if (!loc?.trip_id || !loc?.lat || !loc?.lng) return;
          const trip = tripsRef.current.find(t => t.id === loc.trip_id);
          if (trip) {
            setBusPositions(prev => ({
              ...prev,
              [String(trip.bus_id)]: {
                lat: parseFloat(loc.lat),
                lng: parseFloat(loc.lng),
                isPlaceholder: false,
              },
            }));
          }
        }
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('error');
        }
      });

    // Channel 2: trip INSERT → a new driver just went live, reload the bus list
    const tripInsertChannel = supabase
      .channel('home_trip_inserts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trips' },
        payload => {
          if (payload.new?.status === 'active') {
            // A new live trip started — reload so the bus appears on map
            loadAll();
          }
        }
      )
      .subscribe();

    // Channel 3: trip UPDATE → driver ended a trip (status → completed)
    const tripUpdateChannel = supabase
      .channel('home_trip_updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'trips' },
        () => loadAll()   // reload whenever any trip changes status
      )
      .subscribe();

    // Channel 4: bus row UPDATE → bus went active/inactive
    const busChannel = supabase
      .channel('home_bus_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'buses' },
        () => loadAll()
      )
      .subscribe();

    channelsRef.current = [locChannel, tripInsertChannel, tripUpdateChannel, busChannel];
  }, [cleanupChannels, loadAll]);

  useEffect(() => {
    loadAll().then(() => setupRealtime());

    // Periodic position polling (fallback if realtime WebSocket drops)
    const pollInterval = setInterval(async () => {
      const trips = tripsRef.current;
      if (!trips?.length) return;
      const fresh = await fetchActiveBusPositions(trips);
      if (!Object.keys(fresh).length) return;
      setBusPositions(prev => {
        const next = { ...prev };
        Object.entries(fresh).forEach(([busId, loc]) => {
          if (
            !prev[busId] ||
            prev[busId].lat !== loc.lat ||
            prev[busId].lng !== loc.lng
          ) {
            next[busId] = { ...loc, isPlaceholder: false };
          }
        });
        return next;
      });
    }, 8000);

    // Continuous GPS watch for user dot
    let watchId;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        pos => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    }

    return () => {
      cleanupChannels();
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      clearInterval(pollInterval);
    };
  }, [loadAll, setupRealtime, cleanupChannels]);

  // ── Draw road route when bus marker is tapped ────────────────────────────
  const showBusRoute = async (bus) => {
    if (routeOverlay?.busId === bus.id) { setRouteOverlay(null); return; }
    if (!bus.route_id) return;
    setRouteLoading(true);
    try {
      let stops = [];
      try { stops = await routeService.getStops(bus.route_id); } catch {}
      if (!stops?.length && canUseMockData()) stops = MOCK_STOPS[bus.route_id] || [];
      if (stops.length >= 2) {
        const path = await getRoadRoute(stops.map(s => ({ lat: s.lat, lng: s.lng })));
        setRouteOverlay({ busId: bus.id, path, color: bus.route_color || 'var(--brand)' });
      }
    } finally { setRouteLoading(false); }
  };

  const greeting = profile?.full_name ? `Hey ${profile.full_name.split(' ')[0]} 👋` : 'BusLoop Live';

  return (
    <div className="map-page">
      <MapContainer center={DEFAULT_CENTER} zoom={13} style={{ width: '100%', height: '100dvh' }} zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        {panToUser && <PanTo pos={panToUser} zoom={15} />}

        {/* Route polyline overlay */}
        {routeOverlay?.path?.length > 1 && (
          <>
            <Polyline positions={routeOverlay.path} color="rgba(0,0,0,0.07)" weight={9} lineCap="round" lineJoin="round" />
            <Polyline positions={routeOverlay.path} color={routeOverlay.color} weight={5} opacity={0.88} lineCap="round" lineJoin="round" />
          </>
        )}

        {/* ── Live bus markers — one per active trip ── */}
        {buses.map(bus => {
          const pos = busPositions[String(bus.id)];
          if (!pos) return null;
          const color       = bus.route_color || 'var(--brand)';
          const origin      = bus.route_origin      || bus.trip_from || null;
          const destination = bus.route_destination || bus.trip_to   || null;
          const isPlaceholder = pos.isPlaceholder;

          return (
            <SmoothMarker
              key={bus.id}
              position={[pos.lat, pos.lng]}
              icon={createBusIcon(color)}
            >
              <Popup className="bus-popup" maxWidth={240} closeButton={false}>
                <div style={{ fontFamily: 'Inter,sans-serif', padding: '6px 4px' }}>

                  {/* Bus name + status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Bus size={17} color={color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9375rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bus.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{bus.registration_no}</div>
                    </div>
                    <span style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '2px 8px', borderRadius: 99, fontSize: '0.68rem', fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block', animation: 'pulseDot 1.5s ease-in-out infinite' }} />
                      LIVE
                    </span>
                  </div>

                  {/* Trip route */}
                  {origin && destination ? (
                    <div style={{ background: 'linear-gradient(135deg,var(--success-bg),#F8FAFC)', border: `1.5px solid ${color}22`, borderRadius: 10, padding: '8px 10px', marginBottom: 10 }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 5 }}>TRIP ROUTE</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', border: '1.5px solid white', boxShadow: '0 0 0 1.5px rgba(18,183,106,0.32)' }} />
                          <div style={{ width: 1.5, height: 14, background: 'linear-gradient(to bottom,var(--success),'+color+')' }} />
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, border: '1.5px solid white', boxShadow: `0 0 0 1.5px ${color}55` }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-primary)' }}>{origin}</div>
                          <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-primary)', marginTop: 6 }}>{destination}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10, padding: '6px 0' }}>
                      🛣️ {bus.route_name || 'Route not set'}
                    </div>
                  )}

                  {/* GPS acquiring indicator */}
                  {isPlaceholder && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--warning)', background: 'var(--warning-bg)', borderRadius: 7, padding: '4px 8px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <RefreshCw size={10} style={{ animation: 'spin 1.5s linear infinite' }} />
                      Acquiring GPS location…
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {bus.route_id && (
                      <button
                        onClick={() => showBusRoute(bus)}
                        style={{ flex: 1, background: `${color}15`, color, border: `1.5px solid ${color}40`, borderRadius: 8, padding: '7px 0', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                      >
                        <Navigation size={12} /> Route
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/bus/${bus.id}`)}
                      style={{ flex: 2, background: color, color: 'white', border: 'none', borderRadius: 8, padding: '7px 0', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                    >
                      Details <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </Popup>
            </SmoothMarker>
          );
        })}

        {/* User position dot */}
        {userLocation && <Marker position={userLocation} icon={userIcon} />}
        <UserLocateButton onLocate={latlng => { setUserLocation(latlng); setPanToUser(latlng); }} />
      </MapContainer>

      {/* ── Top overlay ── */}
      <div className="map-overlay-top">
        <div style={{
          maxWidth: 'min(72vw, 280px)',
          display: 'inline-block',
          background: 'rgba(255,255,255,0.94)',
          border: '1px solid rgba(226,232,240,0.95)',
          borderRadius: 999,
          padding: '8px 13px',
          marginBottom: 10,
          color: 'var(--text-primary)',
          fontSize: '0.8125rem',
          fontWeight: 800,
          lineHeight: 1,
          boxShadow: '0 8px 24px rgba(15,23,42,0.16)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {greeting}
        </div>
        <div className="search-bar" onClick={() => navigate('/search')} role="button" tabIndex={0} aria-label="Search buses">
          <Search size={18} className="search-bar__icon" />
          <span className="search-bar__text">Search buses, stops, landmarks…</span>
        </div>

        {routeLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, background: 'rgba(255,255,255,0.93)', borderRadius: 99, padding: '5px 12px', fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)', alignSelf: 'flex-start' }}>
            <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> Mapping route…
          </div>
        )}
        {routeOverlay && !routeLoading && (
          <div onClick={() => setRouteOverlay(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, background: 'rgba(255,255,255,0.93)', borderRadius: 99, padding: '5px 12px', fontSize: '0.73rem', fontWeight: 600, color: routeOverlay.color, alignSelf: 'flex-start', cursor: 'pointer' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: routeOverlay.color }} />
            Route on map · tap to clear
          </div>
        )}
      </div>

      {/* ── Bottom-left pills ── */}
      <div style={{ position: 'absolute', bottom: 'calc(var(--nav-height) + 16px)', left: 16, zIndex: 500, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={() => setShowSheet(s => !s)}
          style={{ background: 'white', border: 'none', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '0.875rem', boxShadow: '0 4px 16px rgba(0,0,0,0.18)', cursor: 'pointer' }}>
          {loading ? <RefreshCw size={16} color="var(--brand)" style={{ animation: 'spin 1s linear infinite' }} /> : <Bus size={16} color="var(--brand)" />}
          {loading ? 'Loading…' : `${buses.length} Live`}
        </button>
        {buses.length > 0 && !loading && (
          <div style={{ background: realtimeStatus === 'live' ? 'var(--success-bg)' : 'var(--warning-bg)', border: `1.5px solid ${realtimeStatus === 'live' ? 'var(--success)' : 'var(--warning)'}`, borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8125rem', fontWeight: 600, color: realtimeStatus === 'live' ? 'var(--success)' : 'var(--warning)', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
            <Zap size={13} /> {buses.length} on map
          </div>
        )}
      </div>

      {/* ── Bottom sheet ── */}
      {showSheet && (
        <>
          <div style={{ position: 'absolute', inset: 0, zIndex: 595, background: 'rgba(0,0,0,0.2)' }} onClick={() => setShowSheet(false)} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'white', borderRadius: '20px 20px 0 0', padding: '0 16px 80px', zIndex: 600, maxHeight: '68vh', overflowY: 'auto', boxShadow: '0 -4px 24px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 99, margin: '14px auto 0', flexShrink: 0 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0 10px', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>
                  Live Buses <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-muted)' }}>({buses.length})</span>
                </h3>
                <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>Tap a bus on the map to see its route</p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={loadAll} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand)', fontWeight: 600, fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
                </button>
                <button onClick={() => setShowSheet(false)} style={{ background: 'var(--bg-input)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X size={16} color="var(--text-muted)" />
                </button>
              </div>
            </div>
            {buses.length === 0
              ? <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                  <Bus size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
                  <p style={{ fontSize: '0.875rem' }}>No drivers are live right now</p>
                </div>
              : <div className="stack stack--sm">{buses.map(bus => <BusCard key={bus.id} bus={bus} />)}</div>}
          </div>
        </>
      )}

      <BottomNav />
      <style>{`
        @keyframes pulseRing { 0%{transform:translate(-50%,-50%) scale(0.6);opacity:0.8} 100%{transform:translate(-50%,-50%) scale(2);opacity:0} }
        @keyframes pulseDot  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.4)} }
        @keyframes spin      { to{transform:rotate(360deg)} }
        @keyframes busRing   { 0%{transform:scale(1);opacity:0.35} 100%{transform:scale(2.8);opacity:0} }
        .leaflet-popup-content-wrapper { border-radius:16px!important;box-shadow:0 8px 32px rgba(0,0,0,0.2)!important;padding:0!important; }
        .leaflet-popup-content { margin:14px!important; }
        .leaflet-popup-tip-container { display:none!important; }
      `}</style>
    </div>
  );
}
