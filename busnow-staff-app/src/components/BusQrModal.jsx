import { useEffect, useRef } from 'react';
import { Copy, Download, QrCode } from 'lucide-react';
import { drawTicketQR } from '../utils/qrCanvas';

export default function BusQrModal({ bus, routeLabel, accentClass = 'btn--driver', onClose, onNotify }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!bus?.id || !canvasRef.current) return;
    drawTicketQR(canvasRef.current, bus.id, { size: 220, dark: '#101828', light: '#ffffff' });
  }, [bus]);

  if (!bus) return null;

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    const safeName = String(bus.registration_no || bus.name || 'bus').replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '');
    link.download = `${safeName || 'bus'}-passenger-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    onNotify?.('Bus QR downloaded.');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bus.id);
      onNotify?.('Bus QR ID copied.');
    } catch {
      onNotify?.('Copy failed. Long-press the ID to copy.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(event) => event.stopPropagation()} style={{ textAlign: 'center' }}>
        <div className="modal-handle" />
        <div style={{
          width: 58, height: 58, borderRadius: 18, margin: '0 auto 12px',
          background: 'var(--driver-bg)', color: 'var(--driver)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid var(--border)',
        }}>
          <QrCode size={28} />
        </div>
        <h3 style={{ marginBottom: 4 }}>Passenger Booking QR</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', marginBottom: 14 }}>
          {bus.name}{routeLabel ? ` · ${routeLabel}` : ''}
        </p>
        <div style={{
          width: 244, height: 244, padding: 12, margin: '0 auto 14px',
          background: 'white', borderRadius: 20, border: '1px solid var(--border)',
          boxShadow: '0 12px 32px rgba(16,24,40,0.08)',
        }}>
          <canvas ref={canvasRef} width="220" height="220" style={{ width: 220, height: 220, display: 'block' }} />
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.45, marginBottom: 14 }}>
          Passengers open BusLoop, tap Scan, and scan this QR to book this bus.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <button className={`btn ${accentClass}`} style={{ borderRadius: 14 }} onClick={handleDownload}>
            <Download size={16} /> Download
          </button>
          <button className="btn btn--secondary" style={{ borderRadius: 14 }} onClick={handleCopy}>
            <Copy size={16} /> Copy ID
          </button>
        </div>
        <button className="btn btn--secondary btn--full" style={{ borderRadius: 14 }} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
