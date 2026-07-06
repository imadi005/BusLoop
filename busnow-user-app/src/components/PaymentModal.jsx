/**
 * PaymentModal — bottom sheet that appears when user clicks "Pay Now" on a bus.
 * Lets user select from/to stops, shows fare, then launches Razorpay.
 */
import { useEffect, useState } from 'react';
import { X, MapPin, ChevronDown, CreditCard, Shield, Loader } from 'lucide-react';

export default function PaymentModal({
  bus,
  stops,
  activeTrip,
  onClose,
  onPay,          // async (fromStopId, toStopId) → void
  paying,
  error,
}) {
  const regularStops = stops.filter(s => s.stop_type !== 'landmark');
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx,   setToIdx]   = useState(regularStops.length > 1 ? regularStops.length - 1 : 0);

  const fare         = bus.base_fare || bus.route_fare || bus.routes?.base_fare || 30;
  const color        = bus.route_color || 'var(--brand)';

  useEffect(() => {
    if (regularStops.length > 1) {
      setFromIdx(0);
      setToIdx(regularStops.length - 1);
    }
  }, [regularStops.length]);

  const fromStop = regularStops[fromIdx];
  const toStop   = regularStops[toIdx];
  const isInvalidJourney =
    !activeTrip?.id ||
    regularStops.length < 2 ||
    !fromStop?.id ||
    !toStop?.id ||
    fromStop.id === toStop.id ||
    Number(fromStop.stop_order ?? fromIdx) >= Number(toStop.stop_order ?? toIdx);

  const handlePay = () => {
    if (isInvalidJourney || paying) return;
    onPay(fromStop?.id || null, toStop?.id || null);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1500,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={paying ? undefined : onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '24px 24px 0 0',
          padding: '0 0 32px',
          maxHeight: '88vh',
          overflowY: 'auto',
          animation: 'slideUpSheet 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ textAlign: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 99, display: 'inline-block' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
              Book Your Ticket
            </h3>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {bus.name} · {bus.route_name || 'No route'}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={paying}
            style={{
              background: 'var(--bg-input)', border: 'none', borderRadius: '50%',
              width: 36, height: 36, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-secondary)', flexShrink: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Journey selector */}
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{
            background: '#F8FAFC', borderRadius: 16, padding: '16px',
            border: '1.5px solid var(--border)',
          }}>
            {/* FROM */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                From
              </div>
              {regularStops.length > 0 ? (
                <div style={{ position: 'relative' }}>
                  <MapPin size={14} color="var(--success)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                  <select
                    value={fromIdx}
                    onChange={e => setFromIdx(Number(e.target.value))}
                    disabled={paying}
                    style={{
                      width: '100%', padding: '10px 32px 10px 30px',
                      border: '1.5px solid var(--border)', borderRadius: 10,
                      background: 'white', fontSize: '0.9rem', fontWeight: 600,
                      color: 'var(--text-primary)', cursor: 'pointer',
                      appearance: 'none', fontFamily: 'inherit',
                    }}
                  >
                    {regularStops.map((s, i) => (
                      <option key={s.id || i} value={i}>{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} color="var(--text-muted)" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              ) : (
                <div style={{ padding: '10px 12px', background: 'white', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  {bus.route_origin || 'Origin'}
                </div>
              )}
            </div>

            {/* Route line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 2, height: 20, background: `linear-gradient(to bottom, var(--success), ${color})`, marginLeft: 7, borderRadius: 1 }} />
            </div>

            {/* TO */}
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                To
              </div>
              {regularStops.length > 1 ? (
                <div style={{ position: 'relative' }}>
                  <MapPin size={14} color={color} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                  <select
                    value={toIdx}
                    onChange={e => setToIdx(Number(e.target.value))}
                    disabled={paying}
                    style={{
                      width: '100%', padding: '10px 32px 10px 30px',
                      border: `1.5px solid ${color}60`, borderRadius: 10,
                      background: 'white', fontSize: '0.9rem', fontWeight: 600,
                      color: 'var(--text-primary)', cursor: 'pointer',
                      appearance: 'none', fontFamily: 'inherit',
                    }}
                  >
                    {regularStops.map((s, i) => (
                      <option key={s.id || i} value={i}>{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} color="var(--text-muted)" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              ) : (
                <div style={{ padding: '10px 12px', background: 'white', borderRadius: 10, border: `1.5px solid ${color}40`, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  {bus.route_destination || 'Destination'}
                </div>
              )}
            </div>
          </div>

          {isInvalidJourney && (
            <div style={{
              marginTop: 12,
              padding: '10px 12px',
              background: '#FFF7ED',
              border: '1.5px solid #FDBA74',
              borderRadius: 12,
              color: '#C2410C',
              fontSize: '0.8125rem',
              fontWeight: 600,
              lineHeight: 1.4,
            }}>
              {!activeTrip?.id
                ? 'This bus is not live right now.'
                : regularStops.length < 2
                ? 'This route needs at least two valid stops before booking.'
                : 'Destination must come after pickup on this route.'}
            </div>
          )}

          {/* Fare breakdown */}
          <div style={{
            margin: '16px 0',
            background: `linear-gradient(135deg, ${color}08, ${color}03)`,
            border: `1.5px solid ${color}20`,
            borderRadius: 14, padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Base Fare</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₹{Number(fare).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Booking Fee</span>
              <span style={{ fontWeight: 600, color: 'var(--success)' }}>FREE</span>
            </div>
            <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Total</span>
              <span style={{ fontWeight: 800, fontSize: '1.25rem', color: color }}>₹{Number(fare).toFixed(2)}</span>
            </div>
          </div>

          {/* Security note */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', background: 'var(--info-bg)',
            borderRadius: 10, marginBottom: 16,
          }}>
            <Shield size={14} color="var(--info)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.75rem', color: '#1D4ED8' }}>
              Secured by Razorpay · GPay, PhonePe, Paytm, BHIM &amp; Cards accepted
            </span>
          </div>

          <div style={{
            padding: '10px 12px',
            background: '#FFF7ED',
            border: '1.5px solid #FDBA74',
            borderRadius: 12,
            color: '#9A3412',
            fontSize: '0.78rem',
            fontWeight: 700,
            lineHeight: 1.4,
            marginBottom: 16,
          }}>
            No cancellation or refund after payment. Please confirm pickup and destination before paying.
          </div>
          {error && (
            <div style={{
              padding: '10px 12px',
              background: 'var(--brand-light)',
              border: '1.5px solid rgba(239,62,66,0.30)',
              borderRadius: 12,
              color: 'var(--brand-dark)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              lineHeight: 1.4,
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {/* Pay Now button */}
          <button
            onClick={handlePay}
            disabled={paying || isInvalidJourney}
            style={{
              width: '100%', padding: '16px',
              background: (paying || isInvalidJourney) ? '#CBD5E0' : 'var(--brand)',
              border: 'none', borderRadius: 16, cursor: (paying || isInvalidJourney) ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', fontWeight: 700,
              fontSize: '1rem', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: paying ? 'none' : '0 4px 20px rgba(239,62,66,0.4)',
              transition: 'all 0.2s',
            }}
          >
            {paying ? (
              <>
                <Loader size={18} style={{ animation: 'spin 0.8s linear infinite' }} />
                Processing…
              </>
            ) : (
              <>
                <CreditCard size={18} />
                Pay ₹{Number(fare).toFixed(2)}
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } }
        @keyframes slideUpSheet { from { transform: translateY(100%); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

