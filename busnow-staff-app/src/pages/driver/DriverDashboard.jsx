import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertCircle,
  ArrowLeftRight,
  Bus,
  CheckCircle,
  ChevronDown,
  Clock,
  LogOut,
  MapPin,
  Navigation,
  Play,
  Radio,
  RefreshCw,
  Route,
  Satellite,
  Square,
  Users,
  WifiOff,
} from 'lucide-react';
import { useStaffAuth } from '../../context/StaffAuthContext';
import { tripService, locationService, busService, presetService } from '../../services/api';
import { MOCK_BUSES } from '../../data/mockData';
import PlaceSearch from '../../components/PlaceSearch';
import { canUseMockData } from '../../config/appMode';
import { captureError } from '../../utils/observability';

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const REST_HEADERS = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
};

function offlineBusAndTrip(tripId, busId) {
  const now = new Date().toISOString();
  if (tripId) {
    fetch(`${SUPA_URL}/rest/v1/trips?id=eq.${tripId}`, {
      method: 'PATCH',
      headers: REST_HEADERS,
      body: JSON.stringify({ status: 'completed', ended_at: now }),
      keepalive: true,
    });
  }
  if (busId) {
    fetch(`${SUPA_URL}/rest/v1/buses?id=eq.${busId}`, {
      method: 'PATCH',
      headers: REST_HEADERS,
      body: JSON.stringify({ status: 'inactive', updated_at: now }),
      keepalive: true,
    });
  }
}

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const createDriverIcon = () => L.divIcon({
  html: `<div style="width:40px;height:40px;border-radius:50%;background:#2563EB;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(37,99,235,0.35);border:3px solid white;">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4S4 2.5 4 6v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
  </div>`,
  className: '',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

function LiveMap({ pos }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.setView(pos, 16, { animate: true });
  }, [map, pos]);
  return pos ? <Marker position={pos} icon={createDriverIcon()} /> : null;
}

const GPS_INTERVAL_MS = 4000;
const ALLOW_SIM_GPS = import.meta.env.DEV && import.meta.env.VITE_ALLOW_SIM_GPS === 'true';
const STATUS_OPTIONS = [
  { value: 'active', label: 'On Route', color: 'var(--success)' },
  { value: 'delayed', label: 'Delayed', color: 'var(--warning)' },
];
const LS_KEY_BUS = 'busnow_driver_last_bus_id';
const LS_KEY_FROM = 'busnow_driver_from';
const LS_KEY_TO = 'busnow_driver_to';

const routeText = (bus) => {
  if (!bus) return 'Route not assigned';
  return bus.route_name || (bus.route_origin && bus.route_dest ? `${bus.route_origin} -> ${bus.route_dest}` : 'Route not assigned');
};

export default function DriverDashboard() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useStaffAuth();

  const [assignedBus, setAssignedBus] = useState(null);
  const [allBuses, setAllBuses] = useState([]);
  const [loadingBus, setLoadingBus] = useState(true);
  const [tripStatus, setTripStatus] = useState('idle');
  const [activeTrip, setActiveTrip] = useState(null);
  const [busStatus, setBusStatus] = useState('active');
  const [pos, setPos] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [gpsError, setGpsError] = useState(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [notification, setNotification] = useState('');
  const [tripError, setTripError] = useState('');
  const [locationCount, setLocationCount] = useState(0);
  const [fromLocation, setFromLocation] = useState(() => localStorage.getItem(LS_KEY_FROM) || '');
  const [toLocation, setToLocation] = useState(() => localStorage.getItem(LS_KEY_TO) || '');
  const [swapping, setSwapping] = useState(false);

  const gpsWatchRef = useRef(null);
  const tripRef = useRef(null);
  const timerRef = useRef(null);
  const hiddenTimerRef = useRef(null);
  const tripStatusRef = useRef('idle');
  const busIdRef = useRef(null);

  useEffect(() => { tripStatusRef.current = tripStatus; }, [tripStatus]);
  useEffect(() => { busIdRef.current = assignedBus?.id ?? null; }, [assignedBus]);
  useEffect(() => { localStorage.setItem(LS_KEY_FROM, fromLocation); }, [fromLocation]);
  useEffect(() => { localStorage.setItem(LS_KEY_TO, toLocation); }, [toLocation]);

  const notify = (msg) => {
    setNotification(msg);
    window.setTimeout(() => setNotification(''), 3200);
  };

  const cleanup = () => {
    stopGPS();
    clearInterval(timerRef.current);
    clearTimeout(hiddenTimerRef.current);
  };

  useEffect(() => {
    loadBus();
    return cleanup;
  }, []);

  useEffect(() => {
    const handleUnload = () => {
      if (tripStatusRef.current !== 'active') return;
      const tripId = tripRef.current?.id;
      const busId = busIdRef.current;
      if (!tripId || String(tripId).startsWith('demo') || !busId) return;
      offlineBusAndTrip(tripId, busId);
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  useEffect(() => {
    const hiddenTimeoutMs = 4 * 60 * 1000;
    const handleVisibility = () => {
      if (document.hidden) {
        hiddenTimerRef.current = window.setTimeout(async () => {
          if (tripStatusRef.current !== 'active') return;
          const tripId = tripRef.current?.id;
          const busId = busIdRef.current;
          setTripStatus('ended');
          setBusStatus('inactive');
          stopGPS();
          clearInterval(timerRef.current);
          if (tripId && !String(tripId).startsWith('demo') && busId) {
            await tripService.endTrip(tripId, busId).catch(() => {});
          }
        }, hiddenTimeoutMs);
      } else {
        clearTimeout(hiddenTimerRef.current);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const loadBus = async () => {
    setLoadingBus(true);
    setTripError('');
    try {
      if (!user) {
        const fallbackBuses = canUseMockData() ? MOCK_BUSES : [];
        setAllBuses(fallbackBuses);
        setAssignedBus(fallbackBuses[0] || null);
        return;
      }

      const existingTrip = await tripService.getActiveForDriver(user.id).catch(() => null);
      if (existingTrip) {
        setActiveTrip(existingTrip);
        setTripStatus('active');
        tripRef.current = existingTrip;
        setFromLocation(existingTrip.from_location || localStorage.getItem(LS_KEY_FROM) || '');
        setToLocation(existingTrip.to_location || localStorage.getItem(LS_KEY_TO) || '');
        startTimer(existingTrip.started_at);

        if (existingTrip.buses) {
          const bus = {
            ...existingTrip.buses,
            id: existingTrip.bus_id,
            route_name: existingTrip.buses.routes?.name || 'Route not assigned',
            route_color: existingTrip.buses.routes?.color || '#667085',
            route_origin: existingTrip.buses.routes?.origin || null,
            route_dest: existingTrip.buses.routes?.destination || null,
          };
          setAssignedBus(bus);
          localStorage.setItem(LS_KEY_BUS, bus.id);
        }
        startGPS(existingTrip.id);
      }

      const buses = await busService.getAll().catch(() => []);
      const liveList = buses.length > 0 ? buses : [];
      setAllBuses(liveList);

      if (!existingTrip) {
        const lastId = localStorage.getItem(LS_KEY_BUS);
        const usableBuses = liveList.filter((bus) => bus.status !== 'maintenance');
        const last = usableBuses.find((bus) => String(bus.id) === String(lastId));
        setAssignedBus(last || usableBuses[0] || null);
      }
    } catch (err) {
      captureError(err, { area: 'DriverDashboard.loadBus' });
      setAllBuses([]);
      setAssignedBus(null);
      setTripError(`Could not load assigned buses: ${err?.message || 'Network error'}`);
    } finally {
      setLoadingBus(false);
    }
  };

  const startTimer = (startedAt = null) => {
    clearInterval(timerRef.current);
    if (startedAt) {
      const diff = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
      setElapsed(diff);
    }
    timerRef.current = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
  };

  const startGPS = (tripId) => {
    stopGPS();
    if (!navigator.geolocation) {
      setGpsError('GPS is not supported on this device.');
      if (ALLOW_SIM_GPS) startSimGPS(tripId);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng, speed, heading } = position.coords;
        setPos([lat, lng]);
        setGpsError(null);
        setLocationCount((count) => count + 1);
        await locationService.push({ tripId, lat, lng, speed, heading }).catch(() => {});
      },
      (err) => {
        setGpsError(ALLOW_SIM_GPS ? `${err.message}. Using simulated GPS in dev.` : err.message);
        if (ALLOW_SIM_GPS) startSimGPS(tripId);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude: lat, longitude: lng, speed, heading } = position.coords;
        setPos([lat, lng]);
        setGpsError(null);
        setLocationCount((count) => count + 1);
        await locationService.push({ tripId, lat, lng, speed, heading }).catch(() => {});
      },
      (err) => {
        setGpsError(ALLOW_SIM_GPS ? `${err.message}. Using simulated GPS in dev.` : err.message);
        if (ALLOW_SIM_GPS) startSimGPS(tripId);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );

    gpsWatchRef.current = { watchId };
  };

  const startSimGPS = (tripId) => {
    let lat = 12.9716;
    let lng = 77.5946;
    const interval = window.setInterval(async () => {
      lat += (Math.random() - 0.48) * 0.0008;
      lng += (Math.random() - 0.48) * 0.0008;
      setPos([lat, lng]);
      setLocationCount((count) => count + 1);
      await locationService.push({ tripId, lat, lng }).catch(() => {});
    }, GPS_INTERVAL_MS);
    gpsWatchRef.current = { simInterval: interval };
  };

  function stopGPS() {
    if (gpsWatchRef.current?.simInterval) clearInterval(gpsWatchRef.current.simInterval);
    if (gpsWatchRef.current?.watchId != null) navigator.geolocation.clearWatch(gpsWatchRef.current.watchId);
    gpsWatchRef.current = null;
  }

  const handleSwap = () => {
    setSwapping(true);
    window.setTimeout(() => {
      setFromLocation(toLocation);
      setToLocation(fromLocation);
      setSwapping(false);
    }, 150);
  };

  const handleStartTrip = async () => {
    if (!assignedBus || tripStatus !== 'idle') return;

    if (!user) {
      setTripError('Please sign in again before starting a trip.');
      return;
    }

    setTripError('');
    notify('Starting trip...');

    if (fromLocation.trim()) presetService.record('location', fromLocation.trim()).catch(() => {});
    if (toLocation.trim()) presetService.record('location', toLocation.trim()).catch(() => {});

    try {
      const trip = await tripService.startTrip({
        busId: assignedBus.id,
        driverId: user.id,
        routeId: assignedBus.route_id,
        fromLocation,
        toLocation,
      });
      setActiveTrip(trip);
      tripRef.current = trip;
      setTripStatus('active');
      setBusStatus('active');
      setElapsed(0);
      setLocationCount(0);
      setGpsError(null);
      startTimer();
      startGPS(trip.id);
      notify('Trip is live. Location sharing started.');
    } catch (err) {
      setTripError(
        err?.message?.includes('violates foreign key')
          ? 'Your account is not linked to a driver record. Ask the operator to re-add you as a driver.'
          : `Failed to start trip: ${err?.message || 'Unknown error'}. Check internet and try again.`
      );
    }
  };

  const handleEndTrip = async () => {
    setTripStatus('ended');
    setBusStatus('inactive');
    stopGPS();
    clearInterval(timerRef.current);
    notify('Trip ended.');
    try {
      if (activeTrip && !String(activeTrip.id).startsWith('demo')) {
        await tripService.endTrip(activeTrip.id, assignedBus?.id);
      }
    } catch {
      setTripError('Trip ended locally, but server update failed. Refresh and check bus status.');
    }
  };

  const handleStatusChange = async (status) => {
    setBusStatus(status);
    setShowStatusMenu(false);
    if (assignedBus && !String(assignedBus.id).startsWith('mock')) {
      await busService.update(assignedBus.id, { status }).catch(() => {
        setTripError('Status update failed. Trip is still running.');
      });
    }
    notify(status === 'delayed' ? 'Bus marked delayed.' : 'Bus marked on route.');
  };

  const handleLogout = async () => {
    if (tripStatus === 'active') {
      notify('End the trip before logging out.');
      return;
    }
    cleanup();
    await signOut().catch(() => {});
    navigate('/');
  };

  const resetForNewTrip = () => {
    setTripStatus('idle');
    setActiveTrip(null);
    tripRef.current = null;
    setElapsed(0);
    setLocationCount(0);
    setPos(null);
    setGpsError(null);
    setBusStatus('active');
    loadBus();
  };

  const fmt = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const usableBuses = allBuses.filter((bus) => bus.status !== 'maintenance');
  const hasNoBus = !loadingBus && usableBuses.length === 0 && tripStatus === 'idle';
  const statusCopy = STATUS_OPTIONS.find((option) => option.value === busStatus) || STATUS_OPTIONS[0];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 32 }}>
      <div className="staff-header">
        <div className="brand-mark brand-mark--image">
          <img src="/busloop-mark.png" alt="BusLoop" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="staff-header__logo">
            <span className="brand-wordmark">BusLoop</span>
            <span className="staff-header__badge" style={{ background: 'var(--driver-bg)', color: 'var(--driver)' }}>Driver</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {profile?.full_name || 'Trip console'}
          </div>
        </div>
        <button
          onClick={handleLogout}
          title={tripStatus === 'active' ? 'End trip before logging out' : 'Log out'}
          style={{
            width: tripStatus === 'active' ? 70 : 38,
            height: 38,
            borderRadius: 14,
            border: '1px solid var(--border)',
            background: tripStatus === 'active' ? 'var(--danger-bg)' : 'var(--bg-input)',
            color: tripStatus === 'active' ? 'var(--danger)' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontWeight: 800,
            fontSize: '0.66rem',
          }}
        >
          {tripStatus === 'active' && 'LIVE'}
          <LogOut size={18} />
        </button>
      </div>

      {notification && (
        <div style={{
          position: 'fixed',
          top: 74,
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: 'calc(100% - 32px)',
          background: 'var(--success)',
          color: 'white',
          padding: '11px 16px',
          borderRadius: 999,
          fontSize: '0.82rem',
          fontWeight: 800,
          zIndex: 800,
          boxShadow: 'var(--shadow-md)',
          textAlign: 'center',
        }}>
          {notification}
        </div>
      )}

      <div style={{ padding: '84px 16px 0' }}>
        <div className="operator-page-title">
          <div>
            <h2>{tripStatus === 'active' ? 'Live Trip' : tripStatus === 'ended' ? 'Trip Complete' : 'Start Trip'}</h2>
            <p>{tripStatus === 'active' ? 'Broadcasting bus location to passengers.' : 'Choose a bus before going live.'}</p>
          </div>
          <button className="btn btn--secondary btn--sm" onClick={loadBus} disabled={tripStatus === 'active'} style={{ borderRadius: 999 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {tripError && (
          <div className="card" style={{ borderColor: 'rgba(239,62,66,0.30)', background: 'var(--danger-bg)', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <AlertCircle size={19} color="var(--danger)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ color: 'var(--danger)', fontWeight: 800 }}>Needs attention</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 3 }}>{tripError}</p>
              </div>
              <button onClick={() => setTripError('')} style={{ color: 'var(--danger)', fontWeight: 900, fontSize: '1rem' }}>x</button>
            </div>
          </div>
        )}

        {tripStatus === 'idle' && (
          <div className="stack stack--md">
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 13, background: 'var(--driver-bg)', color: 'var(--driver)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bus size={19} />
                </div>
                <div>
                  <div style={{ fontWeight: 800 }}>Assigned Bus</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    {loadingBus ? 'Loading buses...' : `${usableBuses.length} available`}
                  </div>
                </div>
              </div>

              {hasNoBus ? (
                <div className="empty-state" style={{ padding: '24px 8px' }}>
                  <Bus size={36} color="var(--text-muted)" />
                  <h3>No bus available</h3>
                  <p>Ask the operator to add or activate a bus before starting a trip.</p>
                </div>
              ) : (
                <select
                  className="form-input"
                  value={assignedBus?.id || ''}
                  onChange={(event) => {
                    const bus = usableBuses.find((item) => String(item.id) === String(event.target.value));
                    setAssignedBus(bus || null);
                    if (bus) localStorage.setItem(LS_KEY_BUS, bus.id);
                    else localStorage.removeItem(LS_KEY_BUS);
                  }}
                  style={{ fontWeight: 800, fontSize: '0.94rem', borderRadius: 14 }}
                  disabled={loadingBus}
                >
                  <option value="">{loadingBus ? 'Loading...' : 'Choose a bus'}</option>
                  {usableBuses.map((bus) => (
                    <option key={bus.id} value={bus.id}>
                      {bus.name} - {routeText(bus)}
                    </option>
                  ))}
                </select>
              )}

              {assignedBus && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: 'var(--bg-input)', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <MapPin size={16} color="var(--driver)" />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{assignedBus.registration_no || 'No registration'}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{routeText(assignedBus)}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 13, background: 'var(--brand-light)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Route size={19} />
                </div>
                <div>
                  <div style={{ fontWeight: 800 }}>Trip Route</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Optional, but helps passengers.</div>
                </div>
              </div>

              <PlaceSearch label="FROM" value={fromLocation} onChange={setFromLocation} placeholder="Starting point" color="var(--success)" icon="A" />

              <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
                <button
                  onClick={handleSwap}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 999,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-secondary)',
                    transform: swapping ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.25s ease',
                  }}
                >
                  <ArrowLeftRight size={16} />
                </button>
              </div>

              <PlaceSearch label="TO" value={toLocation} onChange={setToLocation} placeholder="Destination" color="var(--brand)" icon="B" />

              {fromLocation && toLocation && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <Navigation size={13} color="var(--brand)" />
                  <span style={{ fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fromLocation}</span>
                  <span>to</span>
                  <span style={{ fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toLocation}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {tripStatus !== 'idle' && assignedBus && (
          <div className="card" style={{ borderColor: tripStatus === 'active' ? 'rgba(37,99,235,0.24)' : 'var(--border)', marginBottom: 12 }}>
            <div className="row row--between" style={{ gap: 12 }}>
              <div className="row" style={{ gap: 12, minWidth: 0 }}>
                <div style={{ width: 42, height: 42, borderRadius: 14, background: 'var(--driver-bg)', color: 'var(--driver)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bus size={20} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{assignedBus.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{assignedBus.registration_no || 'No registration'} - {routeText(assignedBus)}</div>
                </div>
              </div>
              <span className={`badge badge--${tripStatus === 'active' ? 'active' : 'inactive'}`}>
                {tripStatus === 'active' ? 'Live' : 'Ended'}
              </span>
            </div>
          </div>
        )}

        {tripStatus === 'active' && fromLocation && toLocation && (
          <div className="card" style={{ marginBottom: 12, padding: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem' }}>
              <Route size={15} color="var(--driver)" />
              <span style={{ color: 'var(--success)', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fromLocation}</span>
              <span style={{ color: 'var(--text-muted)' }}>to</span>
              <span style={{ color: 'var(--brand)', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toLocation}</span>
            </div>
          </div>
        )}
      </div>

      {tripStatus === 'active' && (
        <div className="stack stack--md" style={{ padding: '0 16px' }}>
          {pos ? (
            <div style={{ height: 210, borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <MapContainer center={pos} zoom={16} style={{ width: '100%', height: '100%' }} zoomControl={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <LiveMap pos={pos} />
              </MapContainer>
            </div>
          ) : (
            <div className="card" style={{ padding: 22, textAlign: 'center' }}>
              <Satellite size={34} color="var(--driver)" />
              <div style={{ fontWeight: 800, marginTop: 10 }}>Waiting for GPS</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', marginTop: 3 }}>Allow location permission to show the bus live.</p>
            </div>
          )}

          {gpsError && (
            <div className="card" style={{ borderColor: 'rgba(247,144,9,0.30)', background: 'var(--warning-bg)', padding: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--warning)', fontSize: '0.82rem', fontWeight: 800 }}>
                <WifiOff size={15} /> {gpsError}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[
              { label: 'Elapsed', value: fmt(elapsed), icon: Clock },
              { label: 'Pings', value: locationCount, icon: Satellite },
              { label: 'Capacity', value: assignedBus?.capacity || 50, icon: Users },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="stat-card" style={{ textAlign: 'center', padding: 14 }}>
                <Icon size={15} color="var(--driver)" style={{ margin: '0 auto 5px' }} />
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>{value}</div>
                <div className="stat-card__label">{label}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ borderColor: 'rgba(18,183,106,0.28)', padding: 14 }}>
            <div className="row row--between" style={{ gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: 999, background: gpsError ? 'var(--warning)' : 'var(--success)', animation: 'driverPulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, color: gpsError ? 'var(--warning)' : 'var(--success)' }}>
                    {gpsError ? 'Location needs attention' : 'Live location sharing'}
                  </div>
                  {pos && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pos[0].toFixed(5)}, {pos[1].toFixed(5)}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button className="btn btn--secondary btn--sm" onClick={() => setShowStatusMenu((open) => !open)} style={{ borderRadius: 999, color: statusCopy.color }}>
                  <Radio size={14} /> {statusCopy.label} <ChevronDown size={14} />
                </button>
                {showStatusMenu && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 170, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', zIndex: 200, boxShadow: 'var(--shadow-lg)' }}>
                    {STATUS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleStatusChange(option.value)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          width: '100%',
                          padding: '12px 14px',
                          textAlign: 'left',
                          borderBottom: '1px solid var(--border)',
                          color: busStatus === option.value ? option.color : 'var(--text-primary)',
                          fontWeight: busStatus === option.value ? 800 : 700,
                          fontSize: '0.86rem',
                        }}
                      >
                        <span style={{ width: 7, height: 7, borderRadius: 999, background: option.color }} />
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="trip-control" style={{ padding: '18px 16px 32px' }}>
        {tripStatus === 'idle' && (
          <div className="card" style={{ textAlign: 'center', padding: 22 }}>
            {!assignedBus && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginBottom: 14 }}>
                Select an available bus before starting.
              </p>
            )}
            <button
              id="start-trip-btn"
              className="big-btn big-btn--start"
              onClick={handleStartTrip}
              disabled={!assignedBus || loadingBus}
              style={{ opacity: assignedBus && !loadingBus ? 1 : 0.45 }}
            >
              <Play size={32} />
              START TRIP
            </button>
          </div>
        )}

        {tripStatus === 'active' && (
          <button id="end-trip-btn" className="big-btn big-btn--end" onClick={handleEndTrip}>
            <Square size={30} />
            END TRIP
          </button>
        )}

        {tripStatus === 'ended' && (
          <div className="card" style={{ textAlign: 'center', padding: 24 }}>
            <CheckCircle size={58} color="var(--success)" strokeWidth={1.6} />
            <h3 style={{ marginTop: 12, color: 'var(--success)' }}>Trip Complete</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '6px 0 4px' }}>
              Duration: {fmt(elapsed)} - {locationCount} location pings
            </p>
            {fromLocation && toLocation && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 18 }}>
                {fromLocation} to {toLocation}
              </p>
            )}
            <button className="btn btn--driver" onClick={resetForNewTrip} style={{ borderRadius: 14 }}>
              New Trip
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes driverPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.45;transform:scale(1.35)} }
      `}</style>
    </div>
  );
}
