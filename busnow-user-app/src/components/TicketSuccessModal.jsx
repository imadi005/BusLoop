/**
 * TicketSuccessModal — shown after a successful Razorpay payment.
 * Renders a real QR code on a <canvas> element using the local ticket QR renderer.
 */
import { useEffect, useRef } from 'react';
import { CheckCircle, X, Download, Ticket } from 'lucide-react';
import { formatTicketExpiry, getTicketExpiry } from '../utils/ticketValidity';
import { drawTicketQR } from '../utils/qrCanvas';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function TicketSuccessModal({ ticket, onClose, onViewTickets }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current && ticket?.qr_code) {
      drawTicketQR(canvasRef.current, ticket.qr_code, { size: 180 });
    }
  }, [ticket?.qr_code]);

  if (!ticket) return null;

  const routeName = ticket.routes?.name || ticket.route_name || 'Bus Ticket';
  const busName   = ticket.trips?.buses?.name || ticket.bus_name || '—';
  const amount    = ticket.amount_paid || ticket.routes?.base_fare || 0;
  const expiresAt = ticket.expires_at || getTicketExpiry(ticket.booked_at)?.toISOString();

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `BusLoop-Ticket-${ticket.qr_code}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.75)',
      zIndex: 2000,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '12px 14px',
      animation: 'fadeIn 0.2s ease-out',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      <div style={{
        background: 'white',
        borderRadius: 22,
        width: '100%',
        maxWidth: 380,
        maxHeight: 'calc(100dvh - 24px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUpBig 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
      }}>
        {/* Success Header */}
        <div style={{
          background: 'linear-gradient(135deg, var(--success), var(--success))',
          padding: '24px 24px 20px',
          textAlign: 'center',
          position: 'relative',
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 12, right: 12,
              background: 'rgba(255,255,255,0.2)', border: 'none',
              borderRadius: '50%', width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'white',
            }}
          >
            <X size={16} />
          </button>

          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
            border: '3px solid rgba(255,255,255,0.4)',
          }}>
            <CheckCircle size={32} color="white" strokeWidth={2.5} />
          </div>
          <h2 style={{ color: 'white', marginBottom: 4, fontSize: '1.25rem' }}>Payment Successful!</h2>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.875rem' }}>
            Your ticket has been booked
          </p>
          <div style={{
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 12, padding: '8px 16px',
            display: 'inline-block', marginTop: 12,
            color: 'white', fontWeight: 700, fontSize: '1.125rem',
            letterSpacing: '0.02em',
          }}>
            ₹{Number(amount).toFixed(2)} paid
          </div>
        </div>

        <div style={{
          overflowY: 'auto',
          minHeight: 0,
          WebkitOverflowScrolling: 'touch',
        }}>
        {/* Ticket Body */}
        <div style={{ padding: '0 24px' }}>
          {/* Punch-hole divider */}
          <div style={{
            display: 'flex', alignItems: 'center', margin: '0 -24px',
          }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#F7F8FA', border: '1px solid var(--border)', flexShrink: 0 }} />
            <div style={{
              flex: 1,
              height: 1,
              background: 'repeating-linear-gradient(90deg, var(--border) 0, var(--border) 8px, transparent 8px, transparent 16px)',
            }} />
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#F7F8FA', border: '1px solid var(--border)', flexShrink: 0 }} />
          </div>

          {/* Journey details */}
          <div style={{ padding: '18px 0 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Ticket size={16} color="var(--brand)" />
              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                {routeName}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              {[
                ['Bus', busName],
                ['Ticket Code', ticket.qr_code],
                ['Date', formatDate(ticket.booked_at)],
                ['Validity', 'Board within 2 hours'],
                ['Expires', formatTicketExpiry(expiresAt).replace('Valid until ', '')],
                ['Status', 'Active ✓'],
              ].map(([label, value]) => (
                <div key={label} style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 12px', minWidth: 0 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: 1.35 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* QR Code */}
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <div style={{
                display: 'inline-block',
                background: 'white',
                borderRadius: 16,
                padding: 12,
                border: '2px solid var(--border)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              }}>
                <canvas
                  ref={canvasRef}
                  width={180}
                  height={180}
                  style={{ display: 'block', borderRadius: 8, width: 'min(180px, 56vw)', height: 'min(180px, 56vw)' }}
                />
              </div>
              <div style={{
                marginTop: 8, fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem', fontWeight: 700,
                color: 'var(--text-secondary)', letterSpacing: '0.12em',
              }}>
                {ticket.qr_code}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Show this QR to the ticket checker. Boarding window expires after 2 hours. No cancellation or refund after payment.
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: '12px 24px max(18px, env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          background: 'white',
          flexShrink: 0,
          boxShadow: '0 -8px 24px rgba(15,23,42,0.06)',
        }}>
          <button
            onClick={handleDownload}
            style={{
              width: '100%', padding: '13px',
              background: 'var(--success-bg)', border: '1.5px solid var(--success)',
              borderRadius: 14, cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 600,
              fontSize: '0.9375rem', color: 'var(--success)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Download size={17} /> Save QR to Device
          </button>
          <button
            onClick={onViewTickets}
            style={{
              width: '100%', padding: '13px',
              background: 'var(--brand)',
              border: 'none', borderRadius: 14, cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 700,
              fontSize: '0.9375rem', color: 'white',
              boxShadow: '0 4px 20px rgba(239,62,66,0.35)',
            }}
          >
            View My Tickets
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } }
        @keyframes slideUpBig { from { transform: translateY(60px); opacity: 0; } }
      `}</style>
    </div>
  );
}



