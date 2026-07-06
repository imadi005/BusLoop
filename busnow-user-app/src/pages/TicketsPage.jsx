import { useState, useEffect, useCallback, useRef } from 'react';
import { QrCode, MapPin, RefreshCw, X, Download, Star } from 'lucide-react';
import { reviewService, ticketService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import ReviewComposer from '../components/ReviewComposer';
import { formatTicketBoardedAt, formatTicketExpiry, formatTicketTimeLeft, withTicketValidity } from '../utils/ticketValidity';
import { drawTicketQR } from '../utils/qrCanvas';

const STATUS_CONFIG = {
  active:    { label: 'Active',    cls: 'badge--ticket-active' },
  used:      { label: 'Used',      cls: 'badge--ticket-used' },
  expired:   { label: 'Expired',   cls: 'badge--ticket-expired' },
  cancelled: { label: 'Cancelled', cls: 'badge--ticket-expired' },
};

function QRModal({ ticket, onClose }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current && ticket?.qr_code) drawTicketQR(canvasRef.current, ticket.qr_code, { size: 180 });
  }, [ticket?.qr_code]);

  const handleDownload = () => {
    const c = canvasRef.current;
    if (!c) return;
    const a = document.createElement('a');
    a.download = `BusLoop-${ticket.qr_code}.png`;
    a.href = c.toDataURL('image/png');
    a.click();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 24, padding: 28, textAlign: 'center', animation: 'slideUp 0.25s ease-out', width: '100%', maxWidth: 320 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Your Ticket QR</h3>
          <button onClick={onClose} style={{ background: 'var(--bg-input)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
        </div>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 6 }}>Show this QR to the bus checker</p>
        <p style={{ fontSize: '0.75rem', color: 'var(--brand-dark)', fontWeight: 700, marginBottom: 18 }}>
          {ticket.status === 'used' ? formatTicketBoardedAt(ticket.used_at) : `Board within 2 hours. ${formatTicketExpiry(ticket.expires_at)}`}
        </p>
        <div style={{ display: 'inline-block', background: 'white', borderRadius: 16, padding: 12, border: '2px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', marginBottom: 12 }}>
          <canvas ref={canvasRef} width={180} height={180} style={{ display: 'block', borderRadius: 8 }} />
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.1em', marginBottom: 20 }}>
          {ticket.qr_code}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleDownload} style={{ flex: 1, padding: '11px', background: 'var(--success-bg)', border: '1.5px solid var(--success)', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.875rem', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Download size={15} /> Save</button>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', background: 'var(--bg-input)', border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Close</button>
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } }`}</style>
    </div>
  );
}

function TicketCard({ ticket, onShowQR, onRate, now }) {
  const cfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.used;
  const isActive = ticket.status === 'active';
  const isUsed = ticket.status === 'used';
  const isExpired = ticket.status === 'expired';
  const fromName = ticket.from_stop_name || ticket.from_stop || null;
  const toName   = ticket.to_stop_name   || ticket.to_stop   || null;

  return (
    <div className="ticket-card">
      <div className="ticket-card__header">
        <div>
          <div className="ticket-card__bus">{ticket.bus_name || '—'}</div>
          <div className="ticket-card__route">{ticket.route_name || 'Unknown Route'}</div>
        </div>
        <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
      </div>
      <div className="ticket-card__divider" />
      <div className="ticket-card__body">
        <div className="ticket-card__journey" style={{ flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div><div className="ticket-card__from">From</div><div className="ticket-card__stop">{fromName || 'Any stop'}</div></div>
            <MapPin size={16} color="var(--brand)" />
            <div><div className="ticket-card__to">To</div><div className="ticket-card__stop">{toName || 'Any stop'}</div></div>
          </div>
          {ticket.amount_paid && (
            <div style={{ marginTop: 10, display: 'inline-block', background: 'var(--success-bg)', color: 'var(--success)', padding: '3px 10px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700 }}>
              ₹{Number(ticket.amount_paid).toFixed(2)} paid
            </div>
          )}
          {isActive && (
            <div className="ticket-validity-note ticket-validity-note--active">
              <strong>{formatTicketTimeLeft(ticket.expires_at, now)}</strong>
              <span>Board within 2 hours. {formatTicketExpiry(ticket.expires_at)}</span>
            </div>
          )}
          {isExpired && (
            <div className="ticket-validity-note ticket-validity-note--expired">
              <strong>Expired</strong>
              <span>Boarding window was 2 hours from booking.</span>
            </div>
          )}
          {isUsed && (
            <div className="ticket-validity-note ticket-validity-note--used">
              <strong>Trip boarded</strong>
              <span>{formatTicketBoardedAt(ticket.used_at)}</span>
            </div>
          )}
        </div>
        <div className="ticket-card__qr">
          <div
            className="ticket-card__qr-code"
            onClick={() => isActive && onShowQR(ticket)}
            style={{ cursor: isActive ? 'pointer' : 'default', opacity: isActive ? 1 : 0.4 }}
            title={isActive ? 'Tap to show QR' : 'N/A'}
          >
            <QrCode size={40} />
          </div>
          <span className="ticket-card__qr-label">{isActive ? 'Tap to show' : 'N/A'}</span>
        </div>
      </div>
      {isUsed && (
        <div className="ticket-card__actions">
          <button type="button" className="btn btn--ghost btn--full btn--sm" onClick={() => onRate(ticket)} disabled={!ticket.bus_id}>
            <Star size={15} /> Rate Journey
          </button>
        </div>
      )}
    </div>
  );
}

export default function TicketsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('active');
  const [tickets, setTickets]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [qrTicket, setQrTicket]   = useState(null);
  const [reviewTicket, setReviewTicket] = useState(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(Date.now());
  const tabs = ['active', 'used', 'expired'];

  const loadTickets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await ticketService.getMyTickets(user.id);
      setTickets(data || []);
    } catch (err) {
      console.warn('[TicketsPage] Error:', err.message);
      setTickets([]);
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  };

  const handleReviewSubmit = async ({ rating, comment }) => {
    if (!user || !reviewTicket?.bus_id) return;
    setReviewSubmitting(true);
    try {
      await reviewService.insert({
        passengerId: user.id,
        busId: reviewTicket.bus_id,
        tripId: reviewTicket.trip_id || reviewTicket.trips?.id,
        rating,
        comment,
      });
      setReviewTicket(null);
      showToast('Review submitted. Thank you!');
    } catch (err) {
      showToast(err?.message || 'Could not submit review.', false);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const effectiveTickets = tickets.map(t => withTicketValidity(t, now));
  const filtered = effectiveTickets.filter(t => t.status === activeTab);

  return (
    <div className="page">
      <AppHeader title="My Tickets" action={
        <button onClick={loadTickets} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand)' }} aria-label="Refresh">
          <RefreshCw size={18} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      } />

      <div className="page-content">
        {toast && (
          <div className={`toast ${toast.ok ? 'toast--ok' : 'toast--error'}`}>
            {toast.msg}
          </div>
        )}

        <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 12, padding: 4, marginBottom: 20 }}>
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: '9px 0', borderRadius: 10, background: activeTab === tab ? 'white' : 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8125rem', color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: 'var(--font-main)', textTransform: 'capitalize', boxShadow: activeTab === tab ? 'var(--shadow-sm)' : 'none', transition: 'all 0.2s' }}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} /><p>Loading tickets...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🎫</div>
            <h3>No {activeTab} tickets</h3>
            <p>Book a ticket from any bus page to get started</p>
          </div>
        ) : (
          <div className="stack stack--md">
            {filtered.map(t => <TicketCard key={t.id} ticket={t} onShowQR={setQrTicket} onRate={setReviewTicket} now={now} />)}
          </div>
        )}
      </div>

      {qrTicket && <QRModal ticket={qrTicket} onClose={() => setQrTicket(null)} />}
      {reviewTicket && (
        <div className="modal-overlay" onClick={() => setReviewTicket(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <ReviewComposer
              journey={reviewTicket}
              onSubmit={handleReviewSubmit}
              onCancel={() => setReviewTicket(null)}
              submitting={reviewSubmitting}
            />
          </div>
        </div>
      )}
      <BottomNav />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

