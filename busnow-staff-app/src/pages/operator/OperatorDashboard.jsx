import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bus, LogOut, PlusCircle, RefreshCw, Route, MapPin,
  ChevronDown, ChevronUp, X, Check, BarChart2, Users,
  Radio, Camera, UserPlus, UserX, UserCheck, Phone, Mail,
  Settings, Trash2, AlertTriangle, Activity, QrCode, Download, Copy,
} from 'lucide-react';
import { busService, routeService, staffService, presetService } from '../../services/api';
import { useStaffAuth } from '../../context/StaffAuthContext';
import { MOCK_BUSES } from '../../data/mockData';
import OperatorAnalytics from './OperatorAnalytics';
import MapPicker from './MapPicker';
import LiveBusMapModal from './LiveBusMapModal';
import PlaceSearch from '../../components/PlaceSearch';
import { drawTicketQR } from '../../utils/qrCanvas';
import { canUseMockData } from '../../config/appMode';
import { captureError } from '../../utils/observability';

const STATUS_MAP = {
  active:      { cls: 'active',       label: 'Active',      color: 'var(--success)' },
  delayed:     { cls: 'delayed',      label: 'Delayed',     color: 'var(--warning)' },
  inactive:    { cls: 'inactive',     label: 'Inactive',    color: '#6B7280' },
  maintenance: { cls: 'maintenance',  label: 'Maintenance', color: 'var(--violet)' },
  stopped:     { cls: 'inactive',     label: 'Stopped',     color: '#6B7280' },
};

const ROUTE_COLORS = ['#EF3E42','#2563EB','#12B76A','#F79009','#7C3AED','#C92F33','#06B6D4','#EC4899'];
const tint = (color, amount = 12) => `color-mix(in srgb, ${color} ${amount}%, transparent)`;

/* ── Role Badge ── */
function RoleBadge({ role }) {
  const map = {
    driver:  { bg: 'rgba(59,130,246,0.15)',  color: 'var(--info)',  label: 'Driver' },
    checker: { bg: 'rgba(18,183,106,0.15)',  color: 'var(--success)',  label: 'Checker' },
    operator:{ bg: 'rgba(239,62,66,0.15)',  color: 'var(--brand)',  label: 'Operator' },
  };
  const s = map[role] || map.driver;
  return (
    <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 700 }}>
      {s.label}
    </span>
  );
}

/* ── Live Bus Card ── */
function LiveBusCard({ bus, onClick }) {
  const s = STATUS_MAP[bus.status] || STATUS_MAP.inactive;
  const isLive = bus.status === 'active';
  const canOpen = isLive && typeof onClick === 'function';
  return (
    <div
      onClick={canOpen ? onClick : undefined}
      style={{
        background: isLive ? 'var(--success-bg)' : 'var(--bg-card)',
        border: `1.5px solid ${isLive ? 'rgba(18,183,106,0.26)' : 'var(--border)'}`,
        borderRadius: 18, padding: '14px 16px', cursor: canOpen ? 'pointer' : 'default',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={e => {
        if (!canOpen) return;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 28px rgba(18,183,106,0.16)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 14, flexShrink: 0,
          background: tint(bus.route_color ?? '#667085', 12),
          border: `1.5px solid ${tint(bus.route_color ?? '#667085', 18)}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem',
          overflow: 'hidden',
        }}>
          {bus.photo_url
            ? <img src={bus.photo_url} alt={bus.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : '🚌'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
            <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{bus.name}</span>
            <span className={`badge badge--${s.cls}`}>{s.label}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {bus.route_name || 'No route'} · {bus.registration_no}
          </div>
        </div>
      </div>
      {isLive && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--success)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', animation: 'livePulse 1.5s ease-in-out infinite' }} />
          Broadcasting live location · tap to view on map
        </div>
      )}
    </div>
  );
}

/* ── Stat Card ── */
function StatCard({ label, value, color, icon: Icon, sub }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1.5px solid var(--border)',
      borderRadius: 18, padding: '14px 12px',
      display: 'flex', flexDirection: 'column', gap: 6,
      position: 'relative', overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        position: 'absolute', top: -10, right: -10,
        width: 52, height: 52, borderRadius: '50%',
        background: tint(color, 10),
      }} />
      {Icon && (
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: tint(color, 12), display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={15} color={color} />
        </div>
      )}
      <div style={{ fontSize: '1.75rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      {sub && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

export default function OperatorDashboard() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useStaffAuth();
  const photoInputRef = useRef(null);
  const busQrCanvasRef = useRef(null);

  const [activeTab, setActiveTab]   = useState('analytics');
  const [buses, setBuses]           = useState([]);
  const [routes, setRoutes]         = useState([]);
  const [allStaff, setAllStaff]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [notification, setNotification] = useState(null);
  const [saving, setSaving]         = useState(false);

  // Modals
  const [showAddBus, setShowAddBus]           = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showRouteModal, setShowRouteModal]   = useState(false);
  const [showRouteDetail, setShowRouteDetail] = useState(null);
  const [showAddStaff, setShowAddStaff]       = useState(false);
  const [showTerminateConfirm, setShowTerminateConfirm] = useState(null);
  const [showDeleteBusConfirm, setShowDeleteBusConfirm] = useState(null); // bus object
  const [showLiveMapBus, setShowLiveMapBus]   = useState(null);
  const [showBusQr, setShowBusQr]             = useState(null);

  const [selectedBus, setSelectedBus] = useState(null);
  const [assignForm, setAssignForm]   = useState({ route_id: '' });
  const [newBus, setNewBus]           = useState({ name: '', registration_no: '', capacity: 50, destination: '', photo_url: '' });
  const [newStaff, setNewStaff]       = useState({ full_name: '', email: '', password: '', phone: '', role: 'driver', employee_id: '' });

  // Route creation
  const [routeForm, setRouteForm] = useState({
    origin:'', destination:'', color:'var(--brand)',
    landmarks:'', notes:'', search_keywords:'',
    originLat:null, originLng:null, destLat:null, destLng:null,
    stops: [{ name:'', lat:'', lng:'' }],
  });
  const [mapPicker, setMapPicker] = useState({ open: false, type: 'stop', title: '', index: null });

  const notify = (msg, isError=false) => {
    setNotification({ msg, isError });
    setTimeout(() => setNotification(null), 3500);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [busRes, routeRes, staffRes] = await Promise.allSettled([
        busService.getAll(), routeService.getAll(), staffService.getAllStaff(),
      ]);
      setBuses(busRes.status==='fulfilled' && busRes.value.length>0 ? busRes.value : (canUseMockData() ? MOCK_BUSES : []));
      setRoutes(routeRes.status==='fulfilled' ? (routeRes.value || []) : []);
      setAllStaff(staffRes.status==='fulfilled' ? (staffRes.value || []) : []);
    } catch (err) {
      captureError(err, { area: 'OperatorDashboard.loadAll' });
      setBuses(canUseMockData() ? MOCK_BUSES : []);
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!showBusQr || !busQrCanvasRef.current) return;
    drawTicketQR(busQrCanvasRef.current, showBusQr.id, {
      size: 220,
      dark: '#101828',
      light: '#ffffff',
    });
  }, [showBusQr]);

  const handleLogout = async () => { await signOut().catch(()=>{}); navigate('/'); };

  const handleAssign = async () => {
    if (!assignForm.route_id || !selectedBus) return;
    setSaving(true);
    try {
      const isMock = String(selectedBus.id).startsWith('mock') || !String(selectedBus.id).includes('-');
      if (!isMock) { await busService.update(selectedBus.id, { route_id: assignForm.route_id }); await loadAll(); }
      else {
        const route = routes.find(r=>r.id===assignForm.route_id);
        setBuses(prev=>prev.map(b=>b.id===selectedBus.id ? {...b, route_id:route?.id, route_name:route?.name, route_color:route?.color} : b));
      }
      setShowAssignModal(false); setAssignForm({ route_id:'' }); notify('✓ Route assigned');
    } catch(err) { notify('Failed: '+err.message, true); }
    finally { setSaving(false); }
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setNewBus(p => ({ ...p, photo_url: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const handleAddBus = async () => {
    const name = newBus.name.trim();
    const registrationNo = newBus.registration_no.trim().toUpperCase();
    if (!name || !registrationNo) {
      notify('Bus name and registration number required', true);
      return;
    }
    setSaving(true);
    try {
      const created = await busService.insert({
        name,
        registration_no: registrationNo,
        capacity: parseInt(newBus.capacity) || 50,
        status: 'inactive',
        destination: newBus.destination.trim() || undefined,
        photo_url: newBus.photo_url || undefined,
      });
      await loadAll();
      setShowAddBus(false);
      setNewBus({ name:'', registration_no:'', capacity:50, destination:'', photo_url:'' });
      setShowBusQr(created);
      notify(`✓ ${created.name} added`);
    } catch(err) { notify('Failed: '+err.message, true); }
    finally { setSaving(false); }
  };

  const isRealBus = (bus) => Boolean(bus?.id && !String(bus.id).startsWith('mock') && String(bus.id).includes('-'));

  const handleCopyBusQr = async (bus) => {
    if (!bus?.id) return;
    try {
      await navigator.clipboard.writeText(bus.id);
      notify('Bus QR ID copied');
    } catch {
      notify('Copy failed. Long-press the ID to copy.', true);
    }
  };

  const handleDownloadBusQr = (bus) => {
    const canvas = busQrCanvasRef.current;
    if (!canvas || !bus?.id) return;
    const link = document.createElement('a');
    const safeName = String(bus.registration_no || bus.name || 'bus').replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '');
    link.download = `${safeName || 'bus'}-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    notify('Bus QR downloaded');
  };

  const handleSetStatus = async (busId, status) => {
    const isMock = String(busId).startsWith('mock') || !String(busId).includes('-');
    if (!isMock) { await busService.update(busId, { status }).catch(()=>{}); await loadAll(); }
    else { setBuses(prev=>prev.map(b=>b.id===busId ? {...b,status} : b)); }
    notify(`✓ Status: ${status}`);
  };

  const handleDeleteBus = async () => {
    if (!showDeleteBusConfirm) return;
    const bus = showDeleteBusConfirm;
    setSaving(true);
    try {
      const isMock = String(bus.id).startsWith('mock') || !String(bus.id).includes('-');
      if (!isMock) { await busService.delete(bus.id); await loadAll(); }
      else { setBuses(prev => prev.filter(b => b.id !== bus.id)); }
      setShowDeleteBusConfirm(null);
      notify(`✓ ${bus.name} removed`);
    } catch(err) { notify('Failed: ' + err.message, true); }
    finally { setSaving(false); }
  };

  const handleAddStaff = async () => {
    if (!newStaff.full_name || !newStaff.role) { notify('Full name and role required', true); return; }
    setSaving(true);
    try {
      await staffService.addStaff(newStaff);
      await loadAll();
      setShowAddStaff(false);
      setNewStaff({ full_name:'', email:'', password:'', phone:'', role:'driver', employee_id:'' });
      notify(`✓ ${newStaff.full_name} added`);
    } catch(err) { notify('Failed: '+err.message, true); }
    finally { setSaving(false); }
  };

  const handleTerminate = async (id) => {
    setSaving(true);
    try {
      await staffService.terminateStaff(id); await loadAll();
      setShowTerminateConfirm(null); notify('✓ Staff terminated');
    } catch(err) { notify('Failed: '+err.message, true); }
    finally { setSaving(false); }
  };

  const handleReinstate = async (id) => {
    setSaving(true);
    try {
      await staffService.reinstateStaff(id); await loadAll(); notify('✓ Staff reinstated');
    } catch(err) { notify('Failed: '+err.message, true); }
    finally { setSaving(false); }
  };

  const handleCreateRoute = async () => {
    if (!routeForm.origin || !routeForm.destination) { notify('Origin and destination required', true); return; }
    setSaving(true);
    try {
      const route = await routeService.create({
        origin: routeForm.origin, destination: routeForm.destination,
        color: routeForm.color, landmarks: routeForm.landmarks,
        notes: routeForm.notes, searchKeywords: routeForm.search_keywords,
      });
      const validStops = routeForm.stops.filter(s=>s.name.trim());
      if (validStops.length > 0) await routeService.upsertStops(route.id, validStops);
      await loadAll();
      setShowRouteModal(false);
      setRouteForm({ origin:'', destination:'', color:'var(--brand)', landmarks:'', notes:'', search_keywords:'', originLat:null, originLng:null, destLat:null, destLng:null, stops:[{name:'',lat:'',lng:''}] });
      notify(`✓ Route: ${routeForm.origin} → ${routeForm.destination}`);
    } catch(err) { notify('Failed: '+err.message, true); }
    finally { setSaving(false); }
  };

  const addStop    = () => setRouteForm(p=>({...p, stops:[...p.stops,{name:'',lat:'',lng:''}]}));
  const removeStop = (i) => setRouteForm(p=>({...p, stops:p.stops.filter((_,idx)=>idx!==i)}));
  const updateStop = (i, field, val) => setRouteForm(p=>({ ...p, stops: p.stops.map((s,idx)=>idx===i?{...s,[field]:val}:s) }));

  const activeBuses   = buses.filter(b=>b.status==='active'||b.status==='delayed');
  const inactiveBuses = buses.filter(b=>b.status==='inactive'||b.status==='maintenance');

  const TABS = [
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'live',      label: 'Live',      icon: Radio },
    { id: 'buses',     label: 'Buses',     icon: Bus },
    { id: 'routes',    label: 'Routes',    icon: Route },
    { id: 'employees', label: 'Staff',     icon: Users },
    { id: 'settings',  label: 'Settings',  icon: Settings },
  ];
  const TAB_COPY = {
    analytics: { title: 'Operator Overview', subtitle: 'Collections, activity, and fleet health' },
    live:      { title: 'Live Operations',    subtitle: `${activeBuses.length} active, ${inactiveBuses.length} offline` },
    buses:     { title: 'Bus Fleet',          subtitle: `${buses.length} buses managed` },
    routes:    { title: 'Routes',             subtitle: `${routes.length} active route${routes.length === 1 ? '' : 's'}` },
    employees: { title: 'Staff',              subtitle: `${allStaff.length} employee${allStaff.length === 1 ? '' : 's'} on record` },
    settings:  { title: 'Operator Settings',  subtitle: 'Account and fleet summary' },
  };
  const tabCopy = TAB_COPY[activeTab] || TAB_COPY.analytics;

  return (
    <div className="page operator-shell">

      {/* ── Header ── */}
      <div className="operator-header">
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 12 }}>
          <div className="brand-mark brand-mark--image">
            <img src="/busloop-mark.png" alt="BusLoop" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="brand-wordmark">BusLoop</span>
              <span style={{ background: 'var(--operator-bg)', color: 'var(--operator)', padding: '2px 8px', borderRadius: 99, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em' }}>OPERATOR</span>
            </div>
            {profile && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{profile.full_name || user?.email}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {loading && <RefreshCw size={15} color="var(--brand)" style={{ animation: 'spin 1s linear infinite' }} />}
            <button
              onClick={handleLogout}
              style={{
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '7px 8px', cursor: 'pointer', color: 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--brand-light)'; e.currentTarget.style.color = 'var(--danger)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-input)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Toast ── */}
      {notification && (
        <div style={{
          position: 'fixed', top: 76, left: '50%', transform: 'translateX(-50%)',
          background: notification.isError
            ? 'linear-gradient(135deg,var(--danger),var(--brand-dark))'
            : 'linear-gradient(135deg,var(--success),var(--success))',
          color: 'white', padding: '10px 20px', borderRadius: 99,
          fontSize: '0.875rem', fontWeight: 600, zIndex: 800,
          animation: 'slideDown 0.3s ease-out', whiteSpace: 'nowrap',
          boxShadow: notification.isError ? '0 4px 20px rgba(239,62,66,0.4)' : '0 4px 20px rgba(18,183,106,0.4)',
        }}>
          {notification.msg}
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="operator-content-top">
        <div className="operator-page-title">
          <div>
            <h2>{tabCopy.title}</h2>
            <p>{tabCopy.subtitle}</p>
          </div>
        </div>
        {activeTab === 'analytics' && (
          <div className="operator-quick-actions">
            <button type="button" onClick={() => setActiveTab('buses')}>
              <Bus size={15} /> Fleet
            </button>
            <button type="button" onClick={() => setShowAddBus(true)}>
              <PlusCircle size={15} /> Add Bus
            </button>
            <button type="button" onClick={() => setShowRouteModal(true)}>
              <Route size={15} /> New Route
            </button>
            <button type="button" onClick={() => setShowAddStaff(true)}>
              <UserPlus size={15} /> Staff
            </button>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
          <StatCard label="Active"  value={activeBuses.length} color="var(--success)" icon={Activity} sub="on road" />
          <StatCard label="Buses"   value={buses.length}       color="var(--info)" icon={Bus}      sub="total" />
          <StatCard label="Routes"  value={routes.length}      color="var(--brand)" icon={Route}    sub="created" />
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="operator-content">

        {activeTab === 'analytics' && <OperatorAnalytics />}

        {/* ── LIVE TAB ── */}
        {activeTab === 'live' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: activeBuses.length > 0 ? 'var(--success-bg)' : 'var(--bg-card)',
              border: `1px solid ${activeBuses.length > 0 ? 'rgba(18,183,106,0.26)' : 'var(--border)'}`,
              borderRadius: 14, padding: '10px 14px', marginBottom: 4,
            }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: activeBuses.length > 0 ? 'var(--success)' : 'var(--text-secondary)', animation: activeBuses.length > 0 ? 'livePulse 1.5s ease-in-out infinite' : 'none' }} />
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: activeBuses.length > 0 ? 'var(--success)' : 'var(--text-muted)', flex: 1 }}>
                {activeBuses.length > 0 ? `${activeBuses.length} bus${activeBuses.length !== 1 ? 'es' : ''} active now` : 'No buses active'}
              </span>
              <button
                onClick={loadAll}
                style={{ background: 'var(--bg-input)', border: 'none', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
              >
                <RefreshCw size={13} />
              </button>
            </div>

            {activeBuses.length === 0 && !loading && (
              <div className="empty-state">
                <div className="empty-state__icon">📡</div>
                <h3>No active buses</h3>
                <p>Start a trip from the driver app to see live buses here.</p>
              </div>
            )}
            {activeBuses.map(bus => (
              <LiveBusCard key={bus.id} bus={bus} onClick={() => setShowLiveMapBus(bus)} />
            ))}
            {inactiveBuses.length > 0 && (
              <>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.08em', marginTop: 8 }}>OFFLINE BUSES</div>
                {inactiveBuses.map(bus => <LiveBusCard key={bus.id} bus={bus} />)}
              </>
            )}
          </div>
        )}

        {/* ── BUSES TAB ── */}
        {activeTab === 'buses' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowAddBus(true)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: 'linear-gradient(135deg, var(--brand), var(--brand-dark))', border: 'none',
                  borderRadius: 14, padding: '13px', color: 'white', fontFamily: 'var(--font-main)',
                  fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(239,62,66,0.35)',
                }}
              >
                <PlusCircle size={18} /> Add Bus
              </button>
              <button onClick={loadAll} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 14, padding: '13px 14px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                <RefreshCw size={16} />
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} /><p>Loading…</p>
              </div>
            ) : buses.length === 0 ? (
              <div className="empty-state"><div className="empty-state__icon">🚌</div><h3>No buses yet</h3><p>Add your first bus above.</p></div>
            ) : buses.map(bus => {
              const s = STATUS_MAP[bus.status] || STATUS_MAP.inactive;
              const statusColor = s.color || 'var(--text-muted)';
              const isLiveBus = bus.status === 'active' || bus.status === 'delayed';
              return (
                <div key={bus.id} style={{
                  background: 'var(--bg-card)',
                  border: `1.5px solid ${tint(statusColor, 18)}`,
                  borderLeft: `4px solid ${statusColor}`,
                  borderRadius: 18, padding: '14px 16px',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 14, flexShrink: 0, overflow: 'hidden',
                      background: tint(statusColor, 12),
                      border: `1.5px solid ${tint(statusColor, 18)}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem',
                    }}>
                      {bus.photo_url
                        ? <img src={bus.photo_url} alt={bus.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : '🚌'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                        <span style={{ fontWeight: 800, fontSize: '0.9375rem' }}>{bus.name}</span>
                        <span className={`badge badge--${s.cls}`}>{s.label}</span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>{bus.registration_no}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                        {bus.route_name || 'No route assigned'}
                      </div>
                    </div>
                  </div>

                  {/* Action row */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <button
                      onClick={() => { setSelectedBus(bus); setAssignForm({ route_id: bus.route_id||'' }); setShowAssignModal(true); }}
                      style={{ flex: '1 1 86px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: 'rgba(239,62,66,0.12)', color: 'var(--brand)', border: '1px solid rgba(239,62,66,0.25)', borderRadius: 10, padding: '8px', cursor: 'pointer', fontFamily: 'var(--font-main)', fontWeight: 600, fontSize: '0.78rem' }}
                    >
                      <Route size={13} /> Route
                    </button>
                    <button
                      onClick={() => setShowBusQr(bus)}
                      disabled={!isRealBus(bus)}
                      title={isRealBus(bus) ? 'Show bus QR' : 'QR is available for saved buses only'}
                      style={{
                        flex: '1 1 78px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        background: isRealBus(bus) ? 'rgba(37,99,235,0.12)' : 'var(--bg-input)',
                        color: isRealBus(bus) ? 'var(--info)' : 'var(--text-muted)',
                        border: `1px solid ${isRealBus(bus) ? 'rgba(37,99,235,0.25)' : 'var(--border)'}`,
                        borderRadius: 10, padding: '8px', cursor: isRealBus(bus) ? 'pointer' : 'not-allowed',
                        fontFamily: 'var(--font-main)', fontWeight: 600, fontSize: '0.78rem',
                      }}
                    >
                      <QrCode size={13} /> QR
                    </button>
                    <button
                      onClick={() => setShowLiveMapBus(bus)}
                      disabled={!isLiveBus}
                      title={isLiveBus ? 'View live bus GPS' : 'Live map is available when the driver starts a trip'}
                      style={{
                        flex: '1 1 88px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        background: isLiveBus ? 'rgba(18,183,106,0.12)' : 'var(--bg-input)',
                        color: isLiveBus ? 'var(--success)' : 'var(--text-muted)',
                        border: `1px solid ${isLiveBus ? 'rgba(18,183,106,0.25)' : 'var(--border)'}`,
                        borderRadius: 10, padding: '8px', cursor: isLiveBus ? 'pointer' : 'not-allowed',
                        fontFamily: 'var(--font-main)', fontWeight: 600, fontSize: '0.78rem',
                      }}
                    >
                      <Radio size={13} /> Live
                    </button>
                    {bus.status !== 'maintenance' ? (
                      <button
                        onClick={() => handleSetStatus(bus.id, 'maintenance')}
                        style={{ flex: '1 1 86px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: 'rgba(139,92,246,0.12)', color: 'var(--violet)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 10, padding: '8px', cursor: 'pointer', fontFamily: 'var(--font-main)', fontWeight: 600, fontSize: '0.78rem' }}
                      >
                        🔧 Repair
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSetStatus(bus.id, 'inactive')}
                        style={{ flex: '1 1 86px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: 'rgba(18,183,106,0.12)', color: 'var(--success)', border: '1px solid rgba(18,183,106,0.25)', borderRadius: 10, padding: '8px', cursor: 'pointer', fontFamily: 'var(--font-main)', fontWeight: 600, fontSize: '0.78rem' }}
                      >
                        <Check size={13} /> Done
                      </button>
                    )}
                    <button
                      onClick={() => setShowDeleteBusConfirm(bus)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: 'rgba(239,62,66,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,62,66,0.2)', borderRadius: 10, padding: '8px 12px', cursor: 'pointer' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── ROUTES TAB ── */}
        {activeTab === 'routes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => setShowRouteModal(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: 'linear-gradient(135deg, var(--brand), var(--brand-dark))', border: 'none',
                borderRadius: 14, padding: '13px', color: 'white', fontFamily: 'var(--font-main)',
                fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(239,62,66,0.3)',
              }}
            >
              <PlusCircle size={18} /> Create Route
            </button>

            {routes.map(route => (
              <div
                key={route.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1.5px solid var(--border)',
                  borderLeft: `4px solid ${route.color || 'var(--text-muted)'}`,
                  borderRadius: 18, padding: '14px 16px', cursor: 'pointer',
                  transition: 'transform 0.15s',
                }}
                onClick={() => setShowRouteDetail(showRouteDetail === route.id ? null : route.id)}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: route.color || 'var(--text-muted)', flexShrink: 0 }} />
                    <h4 style={{ margin: 0 }}>{route.name}</h4>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge badge--${route.is_active !== false ? 'active' : 'inactive'}`}>
                      {route.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                    {showRouteDetail === route.id ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
                  </div>
                </div>
                {(route.origin || route.destination) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    <MapPin size={11} color={route.color || 'var(--text-muted)'} />
                    {route.origin || '?'} → {route.destination || '?'}
                  </div>
                )}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  🚌 {buses.filter(b => b.route_id === route.id).length} buses on this route
                </div>
                {showRouteDetail === route.id && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    {route.landmarks && <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 6 }}>📍 <strong>Landmarks:</strong> {route.landmarks}</p>}
                    {route.notes && <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 6 }}>📝 <strong>Notes:</strong> {route.notes}</p>}
                    {route.search_keywords && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>🔍 {route.search_keywords}</p>}
                  </div>
                )}
              </div>
            ))}
            {routes.length === 0 && <div className="empty-state"><div className="empty-state__icon">🛣️</div><h3>No routes yet</h3><p>Create your first route above.</p></div>}
          </div>
        )}

        {/* ── STAFF TAB ── */}
        {activeTab === 'employees' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowAddStaff(true)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: 'linear-gradient(135deg, var(--brand), var(--brand-dark))', border: 'none',
                  borderRadius: 14, padding: '13px', color: 'white', fontFamily: 'var(--font-main)',
                  fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(239,62,66,0.3)',
                }}
              >
                <UserPlus size={18} /> Add Employee
              </button>
              <button onClick={loadAll} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 14, padding: '13px 14px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                <RefreshCw size={16} />
              </button>
            </div>

            {/* Summary pills */}
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: `All (${allStaff.length})`, color: '#667085' },
                { label: `Drivers (${allStaff.filter(s=>s.role==='driver').length})`, color: '#2563EB' },
                { label: `Checkers (${allStaff.filter(s=>s.role==='checker').length})`, color: '#12B76A' },
                { label: `Operators (${allStaff.filter(s=>s.role==='operator'||s.role==='super_admin').length})`, color: '#EF3E42' },
              ].map(p => (
                <div key={p.label} style={{ background: tint(p.color, 12), color: p.color, border: `1px solid ${tint(p.color, 18)}`, padding: '4px 12px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700 }}>
                  {p.label}
                </div>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}><RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>
            ) : allStaff.length === 0 ? (
              <div className="empty-state"><div className="empty-state__icon">👥</div><h3>No staff yet</h3><p>Add your first driver, checker, or operator above.</p></div>
            ) : allStaff.map(staff => {
              const isTerminated = staff.is_terminated;
              const roleColor = staff.role === 'driver' ? 'var(--info)' : 'var(--success)';
              return (
                <div key={staff.id} style={{
                  background: 'var(--bg-card)',
                  border: `1.5px solid ${isTerminated ? 'rgba(239,62,66,0.24)' : 'var(--border)'}`,
                  borderRadius: 18, padding: '14px 16px',
                  opacity: isTerminated ? 0.65 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                      background: tint(roleColor, 12), border: `1.5px solid ${tint(roleColor, 18)}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.1rem', fontWeight: 800, color: roleColor,
                    }}>
                      {(staff.full_name || staff.name || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700 }}>{staff.full_name || staff.name}</span>
                        <RoleBadge role={staff.role} />
                        {isTerminated && <span style={{ background: 'rgba(239,62,66,0.15)', color: 'var(--danger)', padding: '2px 8px', borderRadius: 99, fontSize: '0.62rem', fontWeight: 700 }}>TERMINATED</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {staff.phone && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={11} />{staff.phone}</div>}
                        {staff.email && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={11} />{staff.email}</div>}
                      </div>
                    </div>
                    {isTerminated ? (
                      <button
                        onClick={() => handleReinstate(staff.id)} disabled={saving}
                        style={{ background: 'rgba(18,183,106,0.12)', color: 'var(--success)', border: '1px solid rgba(18,183,106,0.25)', borderRadius: 10, padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-main)', fontWeight: 600, fontSize: '0.78rem' }}
                      >
                        <UserCheck size={13} /> Reinstate
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowTerminateConfirm(staff.id)}
                        style={{ background: 'rgba(239,62,66,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,62,66,0.2)', borderRadius: 10, padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-main)', fontWeight: 600, fontSize: '0.78rem' }}
                      >
                        <UserX size={13} /> Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Account card */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(239,62,66,0.1), rgba(239,62,66,0.04))',
              border: '1.5px solid rgba(239,62,66,0.25)',
              borderRadius: 20, padding: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{
                  width: 54, height: 54, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--brand), var(--brand-dark))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.5rem', fontWeight: 800, color: 'white',
                }}>
                  {(profile?.full_name || user?.email || 'O')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.0625rem' }}>{profile?.full_name || 'Operator'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user?.email}</div>
                  <div style={{ marginTop: 4 }}>
                    <span style={{ background: 'rgba(239,62,66,0.2)', color: 'var(--brand)', padding: '2px 10px', borderRadius: 99, fontSize: '0.68rem', fontWeight: 700 }}>OPERATOR</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                style={{
                  width: '100%', padding: '13px', borderRadius: 14,
                  background: 'rgba(239,62,66,0.12)', color: 'var(--danger)',
                  border: '1px solid rgba(239,62,66,0.25)',
                  fontFamily: 'var(--font-main)', fontWeight: 700, fontSize: '0.9375rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <LogOut size={17} /> Sign Out
              </button>
            </div>

            {/* Stats summary */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '18px 20px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 14, color: 'var(--text-primary)' }}>Fleet Summary</div>
              {[
                { label: 'Total Buses', value: buses.length, color: 'var(--info)' },
                { label: 'Active Now',  value: activeBuses.length, color: 'var(--success)' },
                { label: 'Routes',      value: routes.length, color: 'var(--brand)' },
                { label: 'Staff',       value: allStaff.length, color: 'var(--violet)' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{item.label}</span>
                  <span style={{ fontWeight: 800, fontSize: '1.1rem', color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* App version */}
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-primary)', fontWeight: 600 }}>BusLoop Staff v2.0 · Operator Edition</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Nav ── */}
      <div className="operator-bottom-nav">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '7px 10px', background: 'none', border: 'none', cursor: 'pointer',
                borderRadius: 12, transition: 'all 0.2s', flex: 1,
                color: isActive ? 'var(--brand)' : 'var(--text-secondary)',
              }}
            >
              {tab.id === 'live' && activeBuses.length > 0 && !isActive ? (
                <div style={{ position: 'relative' }}>
                  <tab.icon size={22} strokeWidth={isActive ? 2.5 : 1.75} />
                  <div style={{ position: 'absolute', top: -2, right: -2, width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', animation: 'livePulse 1.5s ease-in-out infinite' }} />
                </div>
              ) : (
                <tab.icon size={22} strokeWidth={isActive ? 2.5 : 1.75} />
              )}
              <span style={{ fontSize: '0.6rem', fontWeight: isActive ? 700 : 500, letterSpacing: '0.03em' }}>{tab.label}</span>
              {isActive && <div style={{ width: 16, height: 2, borderRadius: 99, background: 'var(--brand)', marginTop: -2 }} />}
            </button>
          );
        })}
      </div>

      {/* ── Assign Route Modal ── */}
      {showAssignModal && selectedBus && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ marginBottom: 4 }}>Assign Route</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: 16 }}>{selectedBus.name} · {selectedBus.registration_no}</p>
            <div className="stack stack--md">
              <div className="form-group">
                <label className="form-label">Route</label>
                <select className="form-input" value={assignForm.route_id} onChange={e => setAssignForm({ route_id: e.target.value })}>
                  <option value="">Select route…</option>
                  {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <button className="btn btn--operator btn--full" onClick={handleAssign} disabled={!assignForm.route_id || saving}>
                {saving ? <span className="spinner" /> : <><Check size={16} /> Confirm</>}
              </button>
              <button className="btn btn--secondary btn--full" onClick={() => setShowAssignModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Bus Modal ── */}
      {showAddBus && (
        <div className="modal-overlay" onClick={() => setShowAddBus(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh' }}>
            <div className="modal-handle" />
            <h3 style={{ marginBottom: 4 }}>Add New Bus</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>Fields marked * are required</p>
            <div className="stack stack--md">
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                <div
                  onClick={() => photoInputRef.current?.click()}
                  style={{
                    width: 80, height: 80, borderRadius: 16, cursor: 'pointer',
                    background: 'var(--bg-input)', border: '2px dashed var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  }}
                >
                  {newBus.photo_url
                    ? <img src={newBus.photo_url} alt="Bus" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}><Camera size={22} /><div style={{ fontSize: '0.65rem', marginTop: 4 }}>Photo</div></div>}
                </div>
                <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoSelect} />
              </div>
              <div className="form-group">
                <label className="form-label">Bus Name *</label>
                <input type="text" className="form-input" placeholder="e.g. Bus 99" value={newBus.name} onChange={e => setNewBus(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Registration Number *</label>
                <input type="text" className="form-input" placeholder="KA-01-XX-0001" value={newBus.registration_no} onChange={e => setNewBus(p => ({ ...p, registration_no: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Destination <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <input type="text" className="form-input" placeholder="e.g. Airport Terminal" value={newBus.destination} onChange={e => setNewBus(p => ({ ...p, destination: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Capacity <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <input type="number" className="form-input" placeholder="50" min="1" max="200" value={newBus.capacity} onChange={e => setNewBus(p => ({ ...p, capacity: e.target.value }))} />
              </div>
              <button type="button" className="btn btn--operator btn--full" onClick={handleAddBus} disabled={!newBus.name.trim() || !newBus.registration_no.trim() || saving}>
                {saving ? <span className="spinner" /> : <><PlusCircle size={16} /> Add Bus</>}
              </button>
              <button className="btn btn--secondary btn--full" onClick={() => setShowAddBus(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Bus Confirm Modal ── */}
      {showBusQr && (
        <div className="modal-overlay" onClick={() => setShowBusQr(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div className="modal-handle" />
            <div style={{
              width: 58, height: 58, borderRadius: 18, margin: '0 auto 12px',
              background: 'rgba(239,62,66,0.1)', color: 'var(--brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(239,62,66,0.22)',
            }}>
              <QrCode size={28} />
            </div>
            <h3 style={{ marginBottom: 4 }}>Bus QR Code</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', marginBottom: 14 }}>
              {showBusQr.name} · {showBusQr.registration_no}
            </p>
            <div style={{
              width: 244, height: 244, padding: 12, margin: '0 auto 14px',
              background: 'white', borderRadius: 20, border: '1px solid var(--border)',
              boxShadow: '0 12px 32px rgba(16,24,40,0.08)',
            }}>
              <canvas ref={busQrCanvasRef} width="220" height="220" style={{ width: 220, height: 220, display: 'block' }} />
            </div>
            <div style={{
              background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 14,
              padding: '10px 12px', marginBottom: 14, textAlign: 'left',
            }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                QR Payload
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                {showBusQr.id}
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.45, marginBottom: 16 }}>
              Stick this QR inside the bus. Passenger scans it from the BusLoop app and lands directly on this bus booking flow.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <button className="btn btn--operator" onClick={() => handleDownloadBusQr(showBusQr)}>
                <Download size={16} /> Download
              </button>
              <button className="btn btn--secondary" onClick={() => handleCopyBusQr(showBusQr)}>
                <Copy size={16} /> Copy ID
              </button>
            </div>
            <button className="btn btn--secondary btn--full" onClick={() => setShowBusQr(null)}>Close</button>
          </div>
        </div>
      )}

      {showDeleteBusConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteBusConfirm(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div className="modal-handle" />
            <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(239,62,66,0.12)', border: '1.5px solid rgba(239,62,66,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Trash2 size={24} color="var(--danger)" />
            </div>
            <h3 style={{ marginBottom: 8 }}>Delete {showDeleteBusConfirm.name}?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 24 }}>
              This will permanently remove <strong>{showDeleteBusConfirm.registration_no}</strong> from your fleet. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleDeleteBus} disabled={saving}
                style={{ flex: 1, padding: '14px', borderRadius: 14, background: 'var(--danger)', color: 'white', border: 'none', fontFamily: 'var(--font-main)', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {saving ? <span className="spinner" /> : <><Trash2 size={16} /> Delete</>}
              </button>
              <button className="btn btn--secondary btn--full" onClick={() => setShowDeleteBusConfirm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Staff Modal ── */}
      {showAddStaff && (
        <div className="modal-overlay" onClick={() => setShowAddStaff(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh' }}>
            <div className="modal-handle" />
            <h3 style={{ marginBottom: 4 }}>Add Employee</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>Full name and role are required</p>
            <div className="stack stack--md">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input type="text" className="form-input" placeholder="e.g. Ravi Kumar" value={newStaff.full_name} onChange={e => setNewStaff(p => ({ ...p, full_name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select className="form-input" value={newStaff.role} onChange={e => setNewStaff(p => ({ ...p, role: e.target.value }))}>
                  <option value="driver">Driver</option>
                  <option value="checker">Checker</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Phone <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <input type="tel" className="form-input" placeholder="+91 98765 43210" value={newStaff.phone} onChange={e => setNewStaff(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Email <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <input type="email" className="form-input" placeholder="staff@example.com" value={newStaff.email} onChange={e => setNewStaff(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input type="text" className="form-input" placeholder="Temporary login password" value={newStaff.password} onChange={e => setNewStaff(p => ({ ...p, password: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Employee ID <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <input type="text" className="form-input" placeholder="EMP-001" value={newStaff.employee_id} onChange={e => setNewStaff(p => ({ ...p, employee_id: e.target.value }))} />
              </div>
              <button className="btn btn--operator btn--full" onClick={handleAddStaff} disabled={!newStaff.full_name || saving}>
                {saving ? <span className="spinner" /> : <><UserPlus size={16} /> Add Employee</>}
              </button>
              <button className="btn btn--secondary btn--full" onClick={() => setShowAddStaff(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Terminate Confirm Modal ── */}
      {showTerminateConfirm && (
        <div className="modal-overlay" onClick={() => setShowTerminateConfirm(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div className="modal-handle" />
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚠️</div>
            <h3 style={{ marginBottom: 8 }}>Terminate Employee?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 24 }}>
              This will mark them as terminated. You can reinstate them later from the Staff tab.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleTerminate(showTerminateConfirm)} disabled={saving}
                style={{ flex: 1, padding: '14px', borderRadius: 14, background: 'var(--danger)', color: 'white', border: 'none', fontFamily: 'var(--font-main)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {saving ? <span className="spinner" /> : 'Yes, Terminate'}
              </button>
              <button className="btn btn--secondary btn--full" onClick={() => setShowTerminateConfirm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Route Modal ── */}
      {showRouteModal && (
        <div className="modal-overlay" onClick={() => setShowRouteModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh' }}>
            <div className="modal-handle" />
            <h3 style={{ marginBottom: 4 }}>Create Route</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: 16 }}>Set origin, destination, stops and notes</p>
            <div className="stack stack--md">
              <div className="form-group">
                <label className="form-label">Route Colour</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ROUTE_COLORS.map((c, i) => (
                    <button key={i} onClick={() => setRouteForm(p => ({ ...p, color: c }))}
                      style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: routeForm.color === c ? '3px solid white' : '3px solid transparent', boxShadow: routeForm.color === c ? `0 0 0 2px ${c}` : 'none', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">📍 Starting Location (Origin)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <PlaceSearch
                      value={routeForm.origin}
                      onChange={v => setRouteForm(p => ({ ...p, origin: v }))}
                      placeholder="e.g. City Center, Majestic…"
                      color="var(--success)"
                      icon="🟢"
                    />
                  </div>
                  <button type="button" onClick={() => setMapPicker({ open: true, type: 'origin', title: 'Pin Starting Location', index: null })}
                    style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 10, background: 'rgba(18,183,106,0.12)', border: '1px solid rgba(18,183,106,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 0 }}>
                    <MapPin size={18} color='var(--success)' />
                  </button>
                </div>
                {routeForm.originLat && <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>📌 {parseFloat(routeForm.originLat).toFixed(5)}, {parseFloat(routeForm.originLng).toFixed(5)}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">🏁 Destination</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <PlaceSearch
                      value={routeForm.destination}
                      onChange={v => setRouteForm(p => ({ ...p, destination: v }))}
                      placeholder="e.g. Airport Terminal, Whitefield…"
                      color="var(--brand)"
                      icon="🔴"
                    />
                  </div>
                  <button type="button" onClick={() => setMapPicker({ open: true, type: 'destination', title: 'Pin Destination', index: null })}
                    style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 10, background: 'rgba(239,62,66,0.12)', border: '1px solid rgba(239,62,66,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MapPin size={18} color='var(--brand)' />
                  </button>
                </div>
                {routeForm.destLat && <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>📌 {parseFloat(routeForm.destLat).toFixed(5)}, {parseFloat(routeForm.destLng).toFixed(5)}</p>}
              </div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label className="form-label" style={{ margin: 0 }}>🚏 Stops Along Route</label>
                  <button className="btn btn--sm btn--secondary" onClick={addStop} style={{ borderRadius: 8, padding: '4px 10px' }}>+ Add Stop</button>
                </div>
                <div className="stack stack--sm">
                  {routeForm.stops.map((stop, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(239,62,66,0.2)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <input type="text" className="form-input" placeholder={`Stop ${i + 1} name`} value={stop.name} onChange={e => updateStop(i, 'name', e.target.value)} />
                        {stop.lat && <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>📌 {parseFloat(stop.lat).toFixed(5)}, {parseFloat(stop.lng).toFixed(5)}</p>}
                      </div>
                      <button type="button" onClick={() => setMapPicker({ open: true, type: 'stop', title: `Pin Stop ${i + 1}`, index: i })}
                        style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 8, background: 'rgba(239,62,66,0.12)', border: '1px solid rgba(239,62,66,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MapPin size={15} color='var(--brand)' />
                      </button>
                      {routeForm.stops.length > 1 && (
                        <button onClick={() => removeStop(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0, padding: 4 }}><X size={14} /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Key Landmarks <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(comma-separated)</span></label>
                <input type="text" className="form-input" placeholder="e.g. Central Park, City Mall, Hospital" value={routeForm.landmarks} onChange={e => setRouteForm(p => ({ ...p, landmarks: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Operator Notes</label>
                <textarea className="form-input" rows={2} placeholder="e.g. Express route — no stops between X and Y" value={routeForm.notes} onChange={e => setRouteForm(p => ({ ...p, notes: e.target.value }))} style={{ resize: 'none' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Search Keywords <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(helps passengers find this route)</span></label>
                <input type="text" className="form-input" placeholder="e.g. airport shuttle express downtown" value={routeForm.search_keywords} onChange={e => setRouteForm(p => ({ ...p, search_keywords: e.target.value }))} />
              </div>
              <button className="btn btn--operator btn--full" onClick={handleCreateRoute} disabled={!routeForm.origin || !routeForm.destination || saving}>
                {saving ? <span className="spinner" /> : <><Check size={16} /> Create Route</>}
              </button>
              <button className="btn btn--secondary btn--full" onClick={() => setShowRouteModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MapPicker Modal */}
      <MapPicker
        isOpen={mapPicker.open}
        title={mapPicker.title}
        pinType={mapPicker.type}
        onClose={() => setMapPicker(p => ({ ...p, open: false }))}
        onConfirm={({ lat, lng, label }) => {
          if (mapPicker.type === 'origin') {
            setRouteForm(p => ({ ...p, origin: label.split(',')[0].trim() || p.origin, originLat: lat, originLng: lng }));
          } else if (mapPicker.type === 'destination') {
            setRouteForm(p => ({ ...p, destination: label.split(',')[0].trim() || p.destination, destLat: lat, destLng: lng }));
          } else if (mapPicker.type === 'stop' && mapPicker.index != null) {
            const name = label.split(',')[0].trim();
            updateStop(mapPicker.index, 'lat', lat);
            updateStop(mapPicker.index, 'lng', lng);
            if (!routeForm.stops[mapPicker.index].name) updateStop(mapPicker.index, 'name', name);
          }
          setMapPicker(p => ({ ...p, open: false }));
        }}
      />

      {/* ── Live Bus Map Modal ── */}
      {showLiveMapBus && (
        <LiveBusMapModal
          bus={showLiveMapBus}
          onClose={() => setShowLiveMapBus(null)}
        />
      )}

      <style>{`

        @keyframes shimmer    { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes slideDown  { from{opacity:0;transform:translateX(-50%) translateY(-10px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes spin       { to{transform:rotate(360deg)} }
        @keyframes livePulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(1.5)} }
        @keyframes pulse      { 0%,100%{opacity:1} 50%{opacity:0.4} }
        textarea.form-input   { font-family:var(--font-main); }
      `}</style>
    </div>
  );
}
