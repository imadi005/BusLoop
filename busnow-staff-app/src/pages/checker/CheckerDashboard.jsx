import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Bus,
  CheckCircle,
  ClipboardCheck,
  Clock,
  Copy,
  Download,
  ListChecks,
  LogOut,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  TicketCheck,
  XCircle,
} from 'lucide-react';
import { ticketService, busService } from '../../services/api';
import { useStaffAuth } from '../../context/StaffAuthContext';
import CameraQRScanner from '../../components/CameraQRScanner';
import { formatTicketExpiry, getTicketExpiry, isTicketTimeExpired } from '../../utils/ticketValidity';
import { drawTicketQR } from '../../utils/qrCanvas';

const cleanDash = (value) => value && value !== '—' ? value : null;

export default function CheckerDashboard() {
  const navigate = useNavigate();
  const { profile, signOut } = useStaffAuth();

  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [verifiedList, setVerifiedList] = useState([]);
  const [activeTab, setActiveTab] = useState('scan');
  const [notification, setNotification] = useState(null);
  const [assignedBus, setAssignedBus] = useState(null);
  const [showBusQr, setShowBusQr] = useState(false);
  const [sessionStats, setSessionStats] = useState({ valid: 0, invalid: 0 });

  const lastScannedRef = useRef({ code: '', ts: 0 });
  const busQrCanvasRef = useRef(null);

  const notify = (msg, isError = false) => {
    setNotification({ msg, isError });
    window.setTimeout(() => setNotification(null), 2800);
  };

  const loadCheckerContext = async () => {
    try {
      const buses = await busService.getAll().catch(() => []);
      const activeBuses = buses.filter((bus) => bus.status === 'active' || bus.status === 'delayed');
      setAssignedBus(activeBuses[0] || null);
    } catch {
      setAssignedBus(null);
    }
  };

  useEffect(() => {
    loadCheckerContext();
  }, []);

  useEffect(() => {
    if (!showBusQr || !assignedBus?.id || !busQrCanvasRef.current) return;
    drawTicketQR(busQrCanvasRef.current, assignedBus.id, {
      size: 220,
      dark: '#101828',
      light: '#ffffff',
    });
  }, [showBusQr, assignedBus]);

  const normalizeTicketCode = (raw) => {
    const text = String(raw || '').trim();
    if (!text) return '';

    try {
      if (text.includes('qr_code=')) return new URL(text).searchParams.get('qr_code')?.trim() || '';
      if (text.includes('ticket=')) return new URL(text).searchParams.get('ticket')?.trim() || '';
    } catch {
      // Plain QR payload or manually typed code.
    }

    const parts = text.split(/[\s,;|]+/).filter(Boolean);
    return (parts[0] || text).trim();
  };

  const handleScan = async (code) => {
    if (!assignedBus) {
      notify('Start or select an active bus before verifying tickets.', true);
      return;
    }

    const lookupCode = normalizeTicketCode(code || scanInput);
    if (!lookupCode) {
      notify('Scan a QR or enter the ticket code.', true);
      return;
    }

    const now = Date.now();
    if (lookupCode === lastScannedRef.current.code && now - lastScannedRef.current.ts < 3000) {
      notify('This code was just scanned.', true);
      return;
    }
    lastScannedRef.current = { code: lookupCode, ts: now };

    setScanning(true);
    setScanResult(null);

    try {
      const ticket = await ticketService.getByQR(lookupCode);
      if (!ticket) {
        setScanResult({ valid: false, code: lookupCode, reason: 'Ticket not found in system', passenger: 'Unknown Passenger' });
        return;
      }

      const timeExpired = isTicketTimeExpired(ticket);
      const isValid = ticket.status === 'active' && !timeExpired;
      const expiresAt = getTicketExpiry(ticket.booked_at)?.toISOString();
      let reason = null;

      if (ticket.status === 'used') reason = 'Ticket has already been used.';
      else if (ticket.status === 'expired' || timeExpired) reason = 'Ticket expired. Passenger must board within 2 hours of booking.';
      else if (ticket.status === 'cancelled') reason = 'Ticket was cancelled.';
      else if (ticket.status !== 'active') reason = `Ticket status: ${ticket.status}`;

      setScanResult({
        id: ticket.id,
        code: lookupCode,
        valid: isValid,
        reason,
        passenger: ticket.users?.full_name || 'Unknown Passenger',
        route: cleanDash(ticket.routes?.name),
        from: cleanDash(ticket.from_stop?.name),
        to: cleanDash(ticket.to_stop?.name),
        status: timeExpired ? 'expired' : ticket.status,
        bookedAt: ticket.booked_at,
        expiresAt,
        validity: formatTicketExpiry(expiresAt),
      });
    } catch {
      setScanResult({ valid: false, code: lookupCode, reason: 'Could not verify ticket. Check connection and try again.', passenger: 'Unknown Passenger' });
    } finally {
      setScanning(false);
    }
  };

  const handleCameraResult = (rawCode) => {
    setShowScanner(false);
    const code = normalizeTicketCode(rawCode);
    setScanInput(code);
    handleScan(code);
  };

  const closeResult = ({ countInvalid = false } = {}) => {
    if (countInvalid && scanResult && !scanResult.valid) {
      setSessionStats((prev) => ({ ...prev, invalid: prev.invalid + 1 }));
    }
    setScanResult(null);
    setScanInput('');
  };

  const handleVerify = async () => {
    if (!scanResult) return;

    if (!scanResult.valid) {
      setSessionStats((prev) => ({ ...prev, invalid: prev.invalid + 1 }));
      notify(`Ticket denied: ${scanResult.reason || 'Invalid'}`, true);
      closeResult();
      return;
    }

    try {
      if (scanResult.id) await ticketService.markUsed(scanResult.id);
    } catch (err) {
      notify(`Failed to mark used: ${err.message || 'DB error'}`, true);
      return;
    }

    setVerifiedList((prev) => [
      {
        id: Date.now(),
        code: scanResult.code,
        passenger: scanResult.passenger,
        route: scanResult.route,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      ...prev,
    ]);
    setSessionStats((prev) => ({ ...prev, valid: prev.valid + 1 }));
    notify('Ticket verified and marked used.');
    closeResult();
  };

  const handleCopyBusQr = async () => {
    if (!assignedBus?.id) return;
    try {
      await navigator.clipboard.writeText(assignedBus.id);
      notify('Bus QR ID copied.');
    } catch {
      notify('Copy failed. Long-press the ID to copy.', true);
    }
  };

  const handleDownloadBusQr = () => {
    const canvas = busQrCanvasRef.current;
    if (!canvas || !assignedBus?.id) return;
    const link = document.createElement('a');
    const safeName = String(assignedBus.registration_no || assignedBus.name || 'bus').replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '');
    link.download = `${safeName || 'bus'}-passenger-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    notify('Bus QR downloaded.');
  };

  const handleLogout = async () => {
    await signOut().catch(() => {});
    navigate('/');
  };

  const total = sessionStats.valid + sessionStats.invalid;
  const validPct = total > 0 ? Math.round((sessionStats.valid / total) * 100) : 0;
  const assignedRoute = assignedBus?.route_name || (assignedBus?.route_origin && assignedBus?.route_dest ? `${assignedBus.route_origin} -> ${assignedBus.route_dest}` : 'Route not assigned');
  const tabs = [
    { id: 'scan', label: 'Scan', icon: ScanLine },
    { id: 'log', label: `Verified ${verifiedList.length}`, icon: ListChecks },
  ];

  return (
    <div className="checker-shell" style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 32 }}>
      <div className="staff-header">
        <div className="brand-mark brand-mark--image">
          <img src="/busloop-mark.png" alt="BusLoop" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="staff-header__logo">
            <span className="brand-wordmark">BusLoop</span>
            <span className="staff-header__badge" style={{ background: 'var(--checker-bg)', color: 'var(--checker)' }}>Checker</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {profile?.full_name || 'Ticket verification'}
          </div>
        </div>
        <button
          onClick={handleLogout}
          aria-label="Log out"
          style={{
            width: 38,
            height: 38,
            borderRadius: 14,
            border: '1px solid var(--border)',
            background: 'var(--bg-input)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LogOut size={18} />
        </button>
      </div>

      {notification && (
        <div
          style={{
            position: 'fixed',
            top: 74,
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: 'calc(100% - 32px)',
            background: notification.isError ? 'var(--danger)' : 'var(--success)',
            color: 'white',
            padding: '11px 16px',
            borderRadius: 999,
            fontSize: '0.82rem',
            fontWeight: 800,
            zIndex: 800,
            boxShadow: 'var(--shadow-md)',
            textAlign: 'center',
          }}
        >
          {notification.msg}
        </div>
      )}

      <div style={{ padding: '84px 16px 0' }}>
        <div className="operator-page-title">
          <div>
            <h2>Ticket Check</h2>
            <p>Scan passenger tickets and mark boarding.</p>
          </div>
          <button className="btn btn--secondary btn--sm" onClick={loadCheckerContext} style={{ borderRadius: 999 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 12 }}>
          <div className="stat-card" style={{ padding: 14 }}>
            <div className="stat-card__value" style={{ color: 'var(--success)', fontSize: '1.55rem' }}>{sessionStats.valid}</div>
            <div className="stat-card__label">Verified</div>
          </div>
          <div className="stat-card" style={{ padding: 14 }}>
            <div className="stat-card__value" style={{ color: 'var(--danger)', fontSize: '1.55rem' }}>{sessionStats.invalid}</div>
            <div className="stat-card__label">Denied</div>
          </div>
          <div className="stat-card" style={{ padding: 14 }}>
            <div className="stat-card__value" style={{ color: 'var(--info)', fontSize: '1.55rem' }}>{validPct}%</div>
            <div className="stat-card__label">Rate</div>
          </div>
        </div>

        {assignedBus ? (
          <div className="card" style={{ borderColor: 'rgba(18,183,106,0.30)', marginBottom: 12, padding: 14 }}>
            <div className="row row--between" style={{ gap: 12 }}>
              <div className="row" style={{ gap: 12, minWidth: 0 }}>
                <div style={{ width: 42, height: 42, borderRadius: 14, background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bus size={20} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{assignedBus.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{assignedRoute}</div>
                </div>
              </div>
              <span className="badge badge--active">Active</span>
            </div>
            <button
              className="btn btn--checker btn--full"
              onClick={() => setShowBusQr(true)}
              style={{ marginTop: 12, borderRadius: 14 }}
            >
              <QrCode size={16} /> Show Booking QR
            </button>
          </div>
        ) : (
          <div className="card" style={{ borderColor: 'rgba(247,144,9,0.30)', background: 'var(--warning-bg)', marginBottom: 12 }}>
            <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
              <AlertCircle size={20} color="var(--warning)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 800 }}>No active bus</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 3 }}>
                  Start a driver trip or refresh after a bus goes live. Ticket marking is paused until then.
                </p>
              </div>
            </div>
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2,1fr)',
          gap: 6,
          padding: 5,
          background: 'var(--bg-input)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          marginBottom: 14,
        }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  minHeight: 44,
                  borderRadius: 14,
                  background: active ? 'var(--bg-card)' : 'transparent',
                  color: active ? 'var(--checker)' : 'var(--text-secondary)',
                  boxShadow: active ? 'var(--shadow-sm)' : 'none',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '0 16px 32px' }}>
        {activeTab === 'scan' && (
          <div className="stack stack--md">
            <button
              className={`scan-area ${scanning ? 'scan-area--scanning' : ''}`}
              onClick={() => !scanning && assignedBus && setShowScanner(true)}
              disabled={!assignedBus || scanning}
              style={{
                opacity: assignedBus ? 1 : 0.62,
                cursor: assignedBus ? 'pointer' : 'not-allowed',
                background: assignedBus ? 'var(--bg-card)' : 'var(--bg-input)',
                borderColor: scanning ? 'var(--checker)' : 'var(--border)',
              }}
            >
              <div style={{ width: 104, height: 104, margin: '0 auto 14px', border: `1.5px solid ${scanning ? 'var(--checker)' : 'var(--border)'}`, borderRadius: 26, background: scanning ? 'var(--checker-bg)' : 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                {scanning ? <RefreshCw size={40} color="var(--checker)" style={{ animation: 'spin 0.8s linear infinite' }} /> : <QrCode size={42} color={assignedBus ? 'var(--checker)' : 'var(--text-muted)'} />}
                {scanning && <div style={{ position: 'absolute', left: '12%', right: '12%', height: 2, background: 'linear-gradient(90deg, transparent, var(--checker), transparent)', animation: 'checkerScanLine 1.45s ease-in-out infinite' }} />}
              </div>
              <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{scanning ? 'Checking ticket...' : 'Open Camera Scanner'}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 4 }}>
                {assignedBus ? 'Point camera at the passenger QR.' : 'Active bus required before scanning.'}
              </div>
            </button>

            <div className="card">
              <div className="form-group">
                <label className="form-label">Manual Ticket Code</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Paste or type ticket code"
                    value={scanInput}
                    onChange={(event) => setScanInput(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && !scanning && handleScan(scanInput)}
                    style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
                    disabled={!assignedBus}
                  />
                  <button className="btn btn--checker" style={{ borderRadius: 14, minWidth: 94 }} onClick={() => handleScan(scanInput)} disabled={scanning || !scanInput.trim() || !assignedBus}>
                    Verify
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, color: 'var(--text-muted)', fontSize: '0.76rem', alignItems: 'flex-start' }}>
                <Clock size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                Valid tickets are marked used only after you confirm boarding.
              </div>
            </div>
          </div>
        )}

        {activeTab === 'log' && (
          <div className="stack stack--sm">
            {verifiedList.length === 0 ? (
              <div className="empty-state card" style={{ padding: '34px 18px' }}>
                <ClipboardCheck size={36} color="var(--text-muted)" />
                <h3>No verifications yet</h3>
                <p>Tickets marked used in this session will appear here.</p>
              </div>
            ) : (
              verifiedList.map((entry) => (
                <div key={entry.id} className="card" style={{ borderColor: 'rgba(18,183,106,0.28)' }}>
                  <div className="row row--between" style={{ gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.passenger}</div>
                      {entry.route && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.route}</div>
                      )}
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.code}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <CheckCircle size={20} color="var(--success)" />
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3 }}>{entry.time}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {scanResult && (
        <div className="modal-overlay" onClick={() => closeResult({ countInvalid: !scanResult.valid })}>
          <div className="modal-sheet" onClick={(event) => event.stopPropagation()} style={{ borderTop: `4px solid ${scanResult.valid ? 'var(--success)' : 'var(--danger)'}` }}>
            <div className="modal-handle" />
            <div style={{ textAlign: 'center', paddingBottom: 18 }}>
              <div style={{ width: 72, height: 72, borderRadius: 24, margin: '0 auto 12px', background: scanResult.valid ? 'var(--success-bg)' : 'var(--danger-bg)', color: scanResult.valid ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {scanResult.valid ? <TicketCheck size={38} /> : <XCircle size={38} />}
              </div>
              <h3 style={{ color: scanResult.valid ? 'var(--success)' : 'var(--danger)' }}>
                {scanResult.valid ? 'Valid Ticket' : 'Ticket Blocked'}
              </h3>
              {scanResult.reason && <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', marginTop: 5 }}>{scanResult.reason}</p>}
            </div>

            <div className="card" style={{ marginBottom: 14, boxShadow: 'none' }}>
              {[
                ['Passenger', scanResult.passenger],
                scanResult.route ? ['Route', scanResult.route] : null,
                scanResult.from ? ['From', scanResult.from] : null,
                scanResult.to ? ['To', scanResult.to] : null,
                ['Ticket Code', scanResult.code],
                ['Status', (scanResult.status || 'unknown').toUpperCase()],
                scanResult.validity ? ['Validity', scanResult.validity] : null,
              ].filter(Boolean).map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{label}</span>
                  <span style={{ fontWeight: 800, fontSize: '0.84rem', textAlign: 'right', maxWidth: '62%', wordBreak: 'break-word' }}>{value}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {scanResult.valid && (
                <button className="btn btn--checker" style={{ flex: 1, borderRadius: 14 }} onClick={handleVerify}>
                  <CheckCircle size={16} /> Mark Boarded
                </button>
              )}
              <button className="btn btn--secondary" style={{ flex: 1, borderRadius: 14 }} onClick={() => closeResult({ countInvalid: !scanResult.valid })}>
                {scanResult.valid ? 'Cancel' : 'Scan Next'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBusQr && assignedBus && (
        <div className="modal-overlay" onClick={() => setShowBusQr(false)}>
          <div className="modal-sheet" onClick={(event) => event.stopPropagation()} style={{ textAlign: 'center' }}>
            <div className="modal-handle" />
            <div style={{
              width: 58,
              height: 58,
              borderRadius: 18,
              margin: '0 auto 12px',
              background: 'var(--checker-bg)',
              color: 'var(--checker)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(18,183,106,0.24)',
            }}>
              <QrCode size={28} />
            </div>
            <h3 style={{ marginBottom: 4 }}>Passenger Booking QR</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', marginBottom: 14 }}>
              {assignedBus.name} · {assignedRoute}
            </p>
            <div style={{
              width: 244,
              height: 244,
              padding: 12,
              margin: '0 auto 14px',
              background: 'white',
              borderRadius: 20,
              border: '1px solid var(--border)',
              boxShadow: '0 12px 32px rgba(16,24,40,0.08)',
            }}>
              <canvas ref={busQrCanvasRef} width="220" height="220" style={{ width: 220, height: 220, display: 'block' }} />
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.45, marginBottom: 14 }}>
              Ask the passenger to open BusLoop, tap Scan, and scan this QR to book this bus.
            </p>
            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: '10px 12px',
              marginBottom: 14,
              textAlign: 'left',
            }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>
                Bus ID
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                {assignedBus.id}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <button className="btn btn--checker" style={{ borderRadius: 14 }} onClick={handleDownloadBusQr}>
                <Download size={16} /> Save
              </button>
              <button className="btn btn--secondary" style={{ borderRadius: 14 }} onClick={handleCopyBusQr}>
                <Copy size={16} /> Copy ID
              </button>
            </div>
            <button className="btn btn--secondary btn--full" style={{ borderRadius: 14 }} onClick={() => setShowBusQr(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {showScanner && (
        <CameraQRScanner
          onResult={handleCameraResult}
          onClose={() => setShowScanner(false)}
        />
      )}

      <style>{`
        @keyframes checkerScanLine { 0%{top:12%} 50%{top:86%} 100%{top:12%} }
      `}</style>
    </div>
  );
}
