import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowLeft, MapPin, Navigation, CheckCircle, RefreshCw, Loader,
  AlertCircle, User, Bus, Clock, Ticket, Star, X,
  Wifi, WifiOff, Users, IndianRupee, Info,
} from 'lucide-react';
import { busService, tripService, locationService, routeService, reviewService } from '../services/api';
import { MOCK_BUSES, MOCK_STOPS } from '../data/mockData';
import PaymentModal from '../components/PaymentModal';
import TicketSuccessModal from '../components/TicketSuccessModal';
import { initiatePayment } from '../services/payment';
import { useAuth } from '../context/AuthContext';
import { canUseMockData } from '../config/appMode';
import { captureError } from '../utils/observability';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function busIcon(color) {
  const c = color || 'var(--brand)';
  return L.divIcon({
    html: `<div style="position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;width:52px;height:52px;border-radius:50%;background:${c};opacity:0.18;animation:busRingD 2s ease-out infinite;"></div>
      <div style="position:absolute;width:38px;height:38px;border-radius:50%;background:${c};opacity:0.1;animation:busRingD 2s ease-out infinite 0.7s;"></div>
      <div style="width:38px;height:38px;border-radius:50%;background:${c};display:flex;align-items:center;justify-content:center;box-shadow:0 4px 18px rgba(0,0,0,0.4);border:3px solid white;z-index:1;">
        <svg width='18' height='18' viewBox='0 0 24 24' fill='white'><path d='M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4S4 2.5 4 6v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z'/></svg>
      </div>
    </div>`,
    className: '', iconSize: [52, 52], iconAnchor: [26, 26],
  });
}

function LiveBusMarker({ pos, color }) {
  const map = useMap();
  const prevPos = useRef(null);
  useEffect(() => {
    if (pos && prevPos.current && (pos[0] !== prevPos.current[0] || pos[1] !== prevPos.current[1]))
      map.panTo(pos, { animate: true, duration: 1.5 });
    prevPos.current = pos;
  }, [pos]);
  return pos ? <Marker position={pos} icon={busIcon(color)} /> : null;
}

/* ─── Stat Card ─────────────────────────────────────────── */
function StatCard({ icon, label, value, sub, color, bg }) {
  return (
    <div style={{
      background: bg || '#F8FAFC',
      borderRadius: 16,
      padding: '14px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      border: `1.5px solid ${bg ? color + '22' : 'var(--border)'}`,
      minWidth: 0,
    }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: '1rem', color: color || 'var(--text-primary)', lineHeight: 1.18, overflowWrap: 'anywhere' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{sub}</div>}
    </div>
  );
}

function BusReviewsModal({ bus, reviews, loading, onClose }) {
  const avg = reviews.length
    ? (reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{bus?.name || 'Bus'} Reviews</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Feedback from passengers on this bus
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close bus reviews">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '34px 0' }}>
            <RefreshCw size={24} color="var(--brand)" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : reviews.length === 0 ? (
          <div className="journey-review-empty">No reviews for this bus yet.</div>
        ) : (
          <div className="stack stack--md">
            <div style={{ background: 'var(--warning-bg)', border: '1.5px solid rgba(247,144,9,0.30)', borderRadius: 16, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#92400E', lineHeight: 1 }}>{avg}</div>
                <div style={{ color: '#92400E', fontSize: '0.8rem', marginTop: 4 }}>{reviews.length} review{reviews.length !== 1 ? 's' : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 2, color: 'var(--warning)' }}>
                {[1, 2, 3, 4, 5].map(value => (
                  <Star key={value} size={18} fill={value <= Math.round(avg || 0) ? 'currentColor' : 'none'} />
                ))}
              </div>
            </div>

            {reviews.map(review => (
              <div key={review.id} className="review-card">
                <div className="review-card__header">
                  <div className="review-card__avatar">{(review.passenger || 'A')[0].toUpperCase()}</div>
                  <div className="review-card__info">
                    <div className="review-card__name">{review.passenger || 'Anonymous'}</div>
                    <div className="review-card__rating-row">
                      <span style={{ display: 'inline-flex', gap: 2, color: 'var(--warning)' }}>
                        {[1, 2, 3, 4, 5].map(value => (
                          <Star key={value} size={13} fill={value <= review.rating ? 'currentColor' : 'none'} />
                        ))}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="review-card__comment">{review.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Tab Button ─────────────────────────────────────────── */
function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '9px 0', borderRadius: 10, border: 'none',
      cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
      fontSize: '0.8125rem',
      background: active ? 'white' : 'transparent',
      color: active ? 'var(--text-primary)' : 'var(--text-muted)',
      boxShadow: active ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
      transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
      transform: active ? 'scale(1.01)' : 'scale(1)',
    }}>
      {children}
    </button>
  );
}

function TicketFinalizingOverlay() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1900,
      background: 'rgba(15,23,42,0.72)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 340,
        background: 'white',
        borderRadius: 20,
        padding: '28px 24px',
        textAlign: 'center',
        boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
      }}>
        <div style={{
          width: 58,
          height: 58,
          borderRadius: '50%',
          margin: '0 auto 16px',
          background: 'var(--success-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Loader size={28} color="var(--success)" style={{ animation: 'bdSpin 0.8s linear infinite' }} />
        </div>
        <h3 style={{ marginBottom: 6, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Creating your ticket</h3>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.45 }}>
          Payment received. Securing your QR now.
        </p>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────── */
export default function BusDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [bus, setBus]               = useState(null);
  const [busPos, setBusPos]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [activeTrip, setActiveTrip] = useState(null);
  const [isLive, setIsLive]         = useState(false);
  const [stops, setStops]           = useState([]);
  const [activeTab, setActiveTab]   = useState('stops');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [paying, setPaying]         = useState(false);
  const [ticketFinalizing, setTicketFinalizing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [bookedTicket, setBookedTicket] = useState(null);
  const [showBusReviews, setShowBusReviews] = useState(false);
  const [busReviews, setBusReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const unsubRef = useRef(null);

  useEffect(() => {
    loadAll();
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [id]);

  const loadAll = async () => {
    setLoading(true);
    try {
      let busData;
      try { busData = await busService.getById(id); }
      catch (err) {
        captureError(err, { area: 'BusDetailPage.busLoad', busId: id });
        busData = canUseMockData() ? (MOCK_BUSES.find(b => b.id === id) || MOCK_BUSES[0]) : null;
      }
      setBus(busData);

      let stopsData = [];
      if (busData?.route_id) {
        try {
          stopsData = await routeService.getStops(busData.route_id);
          if (!stopsData?.length && canUseMockData()) stopsData = MOCK_STOPS[busData.route_id] || [];
        } catch (err) {
          captureError(err, { area: 'BusDetailPage.stopsLoad', routeId: busData.route_id });
          stopsData = canUseMockData() ? (MOCK_STOPS[busData.route_id] || []) : [];
        }
      }
      setStops(stopsData);

      try {
        const tripData = await tripService.getActiveForBus(id);
        setActiveTrip(tripData || null);
        setIsLive(!!tripData);
        if (tripData) {
          try {
            const latest = await locationService.getLatest(tripData.id);
            if (latest) {
              setBusPos([parseFloat(latest.lat), parseFloat(latest.lng)]);
              setLastUpdate(latest.timestamp ? new Date(latest.timestamp) : new Date());
            }
          } catch (err) {
            console.warn('[BusDetail] Latest location unavailable:', err?.message || err);
          }

          try {
            unsubRef.current = locationService.subscribe(tripData.id, loc => {
              setBusPos([parseFloat(loc.lat), parseFloat(loc.lng)]);
              setLastUpdate(new Date());
            });
          } catch (err) {
            console.warn('[BusDetail] Live location subscription unavailable:', err?.message || err);
          }
        }
      } catch { setIsLive(false); }
    } finally { setLoading(false); }
  };

  const handlePay = async (fromStopId, toStopId) => {
    if (!user) {
      navigate('/login');
      return;
    }

    setPaying(true);
    setTicketFinalizing(false);
    setPaymentError('');

    try {
      const ticket = await initiatePayment({
        amount: fare,
        busName: bus.name,
        routeName: bus.route_name || null,
        tripId: activeTrip?.id || null,
        routeId: bus.route_id || null,
        fromStopId,
        toStopId,
        userEmail: user.email,
        userName: profile?.full_name || user.email,
        onClose: () => setPaying(false),
        onVerifying: () => {
          setShowPayModal(false);
          setTicketFinalizing(true);
        },
      });

      setBookedTicket(ticket);
      setShowPayModal(false);
    } catch (err) {
      if (err?.message !== 'PAYMENT_CANCELLED') {
        setPaymentError(err?.message || 'Payment failed. Please try again.');
        setShowPayModal(true);
      }
    } finally {
      setPaying(false);
      setTicketFinalizing(false);
    }
  };

  const openBusReviews = async () => {
    if (!bus?.id) return;
    setShowBusReviews(true);
    setReviewsLoading(true);
    try {
      const allReviews = await reviewService.getAll();
      setBusReviews((allReviews || []).filter(review => review.bus_id === bus.id));
    } catch (err) {
      console.warn('[BusDetail] Reviews unavailable:', err?.message || err);
      setBusReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  /* ─── Loading ─── */
  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#f8fafc' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Bus size={26} color="var(--brand)" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div className="bd-spinner" />
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>Loading bus details…</span>
      </div>
    </div>
  );

  if (!bus) return (
    <div style={{ padding: 32, textAlign: 'center', paddingTop: 80 }}>
      <div style={{ fontSize: '3rem', marginBottom: 12 }}>🚌</div>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Bus not found.</p>
      <button onClick={() => navigate('/')} style={{ padding: '12px 28px', background: 'var(--brand)', color: 'white', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: '0.9375rem' }}>Go Home</button>
    </div>
  );

  const color    = bus.route_color || 'var(--brand)';
  const fare     = parseFloat(bus.base_fare || bus.route_fare) || 30;
  const firstStopCoords = stops.length > 0 ? [parseFloat(stops[0].lat), parseFloat(stops[0].lng)] : null;
  const mapCenter = busPos || firstStopCoords || [13.0395, 77.6240];

  const regularStops = stops.filter(s => s.stop_type !== 'landmark');
  const landmarks    = stops.filter(s => s.stop_type === 'landmark');

  const tripFrom   = activeTrip?.from_location || null;
  const tripTo     = activeTrip?.to_location   || null;
  const displayOrigin      = tripFrom || bus.route_origin      || null;
  const displayDestination = tripTo   || bus.route_destination || null;
  const driverName = activeTrip?.staff?.full_name || null;

  const formatTime = (d) => {
    if (!d) return null;
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const tabs = [
    regularStops.length > 0 && { id: 'stops', label: `🚏 Stops (${regularStops.length})` },
    landmarks.length > 0    && { id: 'landmarks', label: `📍 Landmarks (${landmarks.length})` },
    (bus.route_notes || bus.route_landmarks) && { id: 'info', label: '📋 Info' },
  ].filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>

      {/* ── Floating Header ── */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 700, padding: '12px 14px 0' }}>
        <div style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 18,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
          border: '1px solid rgba(255,255,255,0.8)',
        }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--bg-input)', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background 0.15s',
            }}
          >
            <ArrowLeft size={18} color="var(--text-primary)" />
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>{bus.name}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
              {displayOrigin && displayDestination
                ? `${displayOrigin} → ${displayDestination}`
                : bus.route_name || 'No route assigned'}
            </div>
          </div>

          {/* Live pill */}
          {isLive ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'linear-gradient(135deg, var(--success-bg), #D1FAE5)',
              border: '1.5px solid #34D399',
              borderRadius: 99, padding: '5px 10px', flexShrink: 0,
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', animation: 'bdPulse 1.5s ease-in-out infinite' }} />
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#065F46' }}>LIVE</span>
            </div>
          ) : (
            <div style={{
              background: 'var(--bg-input)', borderRadius: 99, padding: '5px 10px',
              fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0,
            }}>
              OFFLINE
            </div>
          )}
        </div>
      </div>

      {/* ── Map ── */}
      <div className="bus-detail-map-frame" style={{ height: '42vh', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        <MapContainer center={mapCenter} zoom={busPos ? 15 : 13} style={{ width: '100%', height: '100%' }} zoomControl={false} attributionControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          <LiveBusMarker pos={busPos} color={color} />
        </MapContainer>

        {/* Map gradient overlay at bottom */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
          background: 'linear-gradient(to top, #f8fafc, transparent)',
          pointerEvents: 'none', zIndex: 400,
        }} />

        {!busPos && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none', textAlign: 'center', zIndex: 500 }}>
            <div style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderRadius: 14, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
              <WifiOff size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Waiting for GPS signal…</span>
            </div>
          </div>
        )}

        {/* Last update badge */}
        {lastUpdate && (
          <div style={{
            position: 'absolute', bottom: 16, right: 14, zIndex: 500,
            background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(6px)',
            borderRadius: 99, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}>
            <Clock size={10} color="var(--success)" />
            <span style={{ fontSize: '0.65rem', color: 'var(--success)', fontWeight: 700 }}>Updated {formatTime(lastUpdate)}</span>
          </div>
        )}
      </div>

      {/* ── Bottom Sheet ── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        background: 'white',
        borderRadius: '22px 22px 0 0',
        marginTop: -20,
        paddingBottom: 90, // space for CTA bar
        boxShadow: '0 -6px 30px rgba(0,0,0,0.1)',
        position: 'relative',
        zIndex: 500,
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 99, margin: '14px auto 0' }} />

        <div style={{ padding: '16px 16px 0' }}>

          {/* ── Live Status Banner ── */}
          {isLive ? (
            <div style={{
              background: 'linear-gradient(135deg, var(--success-bg) 0%, #D1FAE5 100%)',
              border: '1.5px solid #6EE7B7',
              borderRadius: 16, padding: '12px 16px', marginBottom: 16,
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, boxShadow: '0 2px 8px rgba(16,185,129,0.2)',
              }}>
                <Wifi size={18} color="var(--success)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '0.875rem', color: '#065F46', marginBottom: 2 }}>GPS Tracking Active</div>
                {displayOrigin && displayDestination ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', color: '#047857' }}>
                    <span style={{ fontWeight: 600 }}>{displayOrigin}</span>
                    <span style={{ color: '#34D399', fontWeight: 800 }}>→</span>
                    <span style={{ fontWeight: 600 }}>{displayDestination}</span>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: '#047857' }}>Bus is currently active on route</div>
                )}
                {driverName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, fontSize: '0.73rem', color: '#065F46' }}>
                    <User size={11} />
                    <span>Driver: <strong>{driverName}</strong></span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              background: '#F8FAFC', border: '1.5px solid #CBD5E0',
              borderRadius: 16, padding: '12px 16px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <WifiOff size={18} color="var(--text-muted)" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Bus Currently Offline</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>No active trip at the moment</div>
              </div>
            </div>
          )}

          {/* ── Stats Grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
            <StatCard
              icon={<Navigation size={15} color={color} />}
              label="Route"
              value={displayOrigin && displayDestination ? `${displayOrigin} to ${displayDestination}` : bus.route_name || 'None'}
              sub={bus.route_name || 'Unassigned'}
              color={color}
              bg={`${color}08`}
            />
            <StatCard
              icon={<Users size={15} color="#6366F1" />}
              label="Capacity"
              value={bus.capacity || '—'}
              sub="Passengers"
              color="#6366F1"
            />
            <StatCard
              icon={<IndianRupee size={15} color="var(--warning)" />}
              label="Fare"
              value={`₹${Number(fare).toFixed(0)}`}
              sub="Verified online"
              color="var(--warning)"
              bg="var(--warning-bg)"
            />
          </div>

          {/* ── Bus Metadata Row ── */}
          <div style={{
            background: '#F8FAFC', borderRadius: 16, padding: '12px 14px',
            marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center',
            border: '1.5px solid var(--border)',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Bus size={20} color={color} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{bus.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {bus.registration_no || 'Reg. N/A'} · {bus.type || 'Bus'}
              </div>
            </div>
            <div style={{
              background: bus.status === 'active' ? 'var(--success-bg)' : 'var(--bg-hover)',
              color: bus.status === 'active' ? 'var(--success)' : 'var(--text-muted)',
              padding: '5px 12px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 800,
              flexShrink: 0, letterSpacing: '0.04em',
              border: `1.5px solid ${bus.status === 'active' ? '#34D399' : '#CBD5E0'}`,
            }}>
              {(bus.status || 'unknown').toUpperCase()}
            </div>
          </div>

          {/* ── Tabs ── */}
          {tabs.length > 0 && (
            <>
              <div style={{
                display: 'flex', gap: 4, marginBottom: 20,
                background: 'var(--bg-input)', borderRadius: 14, padding: '4px',
              }}>
                {tabs.map(t => (
                  <TabBtn key={t.id} active={activeTab === t.id} onClick={() => setActiveTab(t.id)}>
                    {t.label}
                  </TabBtn>
                ))}
              </div>

              {/* ── Stops Tab ── */}
              {activeTab === 'stops' && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {regularStops.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                      <Navigation size={28} style={{ marginBottom: 8, opacity: 0.3 }} />
                      <p style={{ fontSize: '0.875rem' }}>No stop data available</p>
                    </div>
                  ) : regularStops.map((stop, i) => {
                    const isFirst = i === 0;
                    const isLast  = i === regularStops.length - 1;
                    const dotColor = isFirst ? 'var(--success)' : isLast ? color : '#CBD5E0';
                    const textColor = isFirst ? '#065F46' : isLast ? color : '#2D3748';
                    return (
                      <div key={stop.id || i} style={{ display: 'flex', gap: 14 }}>
                        {/* Timeline column */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 24 }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: '50%',
                            background: isFirst ? 'var(--success)' : isLast ? color : 'white',
                            border: `2.5px solid ${dotColor}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: (isFirst || isLast) ? `0 0 0 4px ${dotColor}20` : '0 0 0 3px var(--border)',
                            flexShrink: 0, transition: 'all 0.2s',
                          }}>
                            {isFirst && <CheckCircle size={11} color="white" strokeWidth={3} />}
                            {isLast  && <MapPin size={11} color="white" />}
                          </div>
                          {!isLast && (
                            <div style={{
                              width: 2, flex: 1, minHeight: 28,
                              background: `linear-gradient(to bottom, ${dotColor}80, var(--border))`,
                              margin: '3px 0',
                            }} />
                          )}
                        </div>

                        {/* Stop content */}
                        <div style={{
                          flex: 1, paddingBottom: isLast ? 4 : 18,
                          background: (isFirst || isLast) ? `${dotColor}07` : 'transparent',
                          borderRadius: (isFirst || isLast) ? 12 : 0,
                          padding: (isFirst || isLast) ? '10px 12px 10px 12px' : '2px 0 18px 0',
                          marginBottom: (isFirst || isLast) ? 2 : 0,
                          border: (isFirst || isLast) ? `1px solid ${dotColor}20` : 'none',
                        }}>
                          <div style={{ fontWeight: (isFirst || isLast) ? 700 : 600, fontSize: '0.9375rem', color: textColor }}>
                            {stop.name}
                          </div>
                          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                            {isFirst ? (
                              <><span style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '1px 7px', borderRadius: 99, fontWeight: 700, fontSize: '0.65rem' }}>ORIGIN</span></>
                            ) : isLast ? (
                              <><span style={{ background: `${color}15`, color, padding: '1px 7px', borderRadius: 99, fontWeight: 700, fontSize: '0.65rem' }}>DESTINATION</span></>
                            ) : (
                              <span>Stop {stop.stop_order || i + 1}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Landmarks Tab ── */}
              {activeTab === 'landmarks' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {landmarks.map((lm, i) => (
                    <div key={lm.id || i} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 16px',
                      background: 'linear-gradient(135deg, var(--warning-bg), #FEF3C7)',
                      borderRadius: 16, border: '1.5px solid rgba(247,144,9,0.30)',
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: 'var(--warning-bg)', border: '1.5px solid rgba(247,144,9,0.30)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <MapPin size={19} color="var(--warning)" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#78350F' }}>{lm.name}</div>
                        <div style={{ fontSize: '0.73rem', color: '#92400E', marginTop: 2 }}>Along route · Stop {lm.stop_order}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Info Tab ── */}
              {activeTab === 'info' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {displayOrigin && displayDestination && (
                    <div style={{
                      background: `linear-gradient(135deg, ${color}08, ${color}04)`,
                      border: `1.5px solid ${color}22`,
                      borderRadius: 16, padding: '14px 16px',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Navigation size={13} color={color} /> Full Route Path
                      </div>
                      <div style={{ display: 'flex', gap: 14 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3 }}>
                          <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--success)', border: '2px solid white', boxShadow: '0 0 0 2px rgba(18,183,106,0.22)' }} />
                          <div style={{ width: 2, height: 30, background: `linear-gradient(to bottom, var(--success), ${color})` }} />
                          <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, border: '2px solid white', boxShadow: `0 0 0 2px ${color}33` }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{displayOrigin}</div>
                          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', margin: '8px 0' }}>to</div>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{displayDestination}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {bus.route_landmarks && (
                    <div style={{
                      display: 'flex', gap: 12, padding: '12px 14px',
                      background: 'var(--warning-bg)', borderRadius: 14, border: '1px solid rgba(247,144,9,0.30)',
                    }}>
                      <MapPin size={16} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400E', marginBottom: 4 }}>Key Landmarks</div>
                        <div style={{ fontSize: '0.8125rem', color: '#78350F', lineHeight: 1.5 }}>{bus.route_landmarks}</div>
                      </div>
                    </div>
                  )}

                  {bus.route_notes && (
                    <div style={{
                      display: 'flex', gap: 12, padding: '12px 14px',
                      background: 'var(--info-bg)', borderRadius: 14, border: '1px solid #BFDBFE',
                    }}>
                      <AlertCircle size={16} color="var(--info)" style={{ flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1D4ED8', marginBottom: 4 }}>Route Notes</div>
                        <div style={{ fontSize: '0.8125rem', color: '#1D4ED8', lineHeight: 1.5 }}>{bus.route_notes}</div>
                      </div>
                    </div>
                  )}

                  {/* Bus details */}
                  <div style={{
                    background: '#F8FAFC', borderRadius: 14, border: '1.5px solid var(--border)', overflow: 'hidden',
                  }}>
                    {[
                      { icon: <Bus size={14} color="#6366F1" />, label: 'Bus Number', val: bus.name },
                      { icon: <Info size={14} color="#6366F1" />, label: 'Registration', val: bus.registration_no || 'N/A' },
                      { icon: <Users size={14} color="#6366F1" />, label: 'Capacity', val: bus.capacity ? `${bus.capacity} seats` : 'N/A' },
                    ].map((row, i, arr) => (
                      <div key={row.label} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px',
                        borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                      }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {row.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 1 }}>{row.label}</div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{row.val}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Fallback when no tabs at all */}
          {tabs.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
              <Navigation size={32} style={{ marginBottom: 10, opacity: 0.25 }} />
              <p style={{ fontSize: '0.875rem' }}>No stop or route info available yet</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Sticky CTA Bar ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 600,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--border)',
        padding: '12px 16px',
        display: 'flex',
        gap: 10,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
      }}>
        {/* Review button */}
        <button
          onClick={openBusReviews}
          style={{
            width: 46, height: 46, borderRadius: 13, border: '1.5px solid var(--border)',
            background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
          }}
          title="Bus reviews"
        >
          <Star size={18} color="var(--warning)" fill="var(--warning)" />
        </button>

        {/* Verified payment CTA */}
        <button
          onClick={() => { if (isLive) { setPaymentError(''); setShowPayModal(true); } }}
          disabled={!isLive}
          style={{
            flex: 1, height: 46, borderRadius: 13, border: 'none',
            background: isLive ? `linear-gradient(135deg, ${color}, ${color}CC)` : '#CBD5E0',
            color: 'white', fontWeight: 800, fontSize: '0.9375rem',
            cursor: isLive ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, boxShadow: isLive ? `0 4px 20px ${color}55` : 'none',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
        >
          <Ticket size={17} />
          {isLive ? 'Book Ticket' : 'Bus Offline'}
        </button>
      </div>

      {/* ── Verified Payment Modal ── */}
      {showPayModal && (
        <PaymentModal
          bus={bus}
          stops={stops}
          activeTrip={activeTrip}
          onClose={() => setShowPayModal(false)}
          onPay={handlePay}
          paying={paying}
          error={paymentError}
        />
      )}

      {ticketFinalizing && <TicketFinalizingOverlay />}

      {bookedTicket && (
        <TicketSuccessModal
          ticket={bookedTicket}
          onClose={() => setBookedTicket(null)}
          onViewTickets={() => {
            setBookedTicket(null);
            navigate('/tickets');
          }}
        />
      )}

      {showBusReviews && (
        <BusReviewsModal
          bus={bus}
          reviews={busReviews}
          loading={reviewsLoading}
          onClose={() => setShowBusReviews(false)}
        />
      )}

      <style>{`
        @keyframes bdPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.45;transform:scale(1.45)} }
        @keyframes busRingD { 0%{transform:scale(1);opacity:0.35} 100%{transform:scale(2.6);opacity:0} }
        @keyframes bdSpin { to{transform:rotate(360deg)} }
        .bd-spinner {
          width: 28px; height: 28px;
          border: 3px solid #FEE2E2;
          border-top-color: var(--brand);
          border-radius: 50%;
          animation: bdSpin 0.8s linear infinite;
        }
      `}</style>
    </div>
  );
}

