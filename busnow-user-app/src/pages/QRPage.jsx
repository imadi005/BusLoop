import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import { AlertCircle, Camera, Keyboard, QrCode, RefreshCw, Search, X } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import { busService, tripService } from '../services/api';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const isPlayInterrupted = (err) => err?.name === 'AbortError' || String(err?.message || '').includes('interrupted by a new load request');

function cleanValue(value) {
  return String(value || '').trim();
}

function parseBusQr(raw) {
  const text = cleanValue(raw);
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    const busId = cleanValue(parsed.bus_id || parsed.busId || parsed.bus || parsed.id);
    const tripId = cleanValue(parsed.trip_id || parsed.tripId || parsed.trip);
    if (UUID_RE.test(busId)) return { type: 'bus', id: busId };
    if (UUID_RE.test(tripId)) return { type: 'trip', id: tripId };
  } catch {
    // QR is not JSON.
  }

  try {
    const url = new URL(text);
    const busFromPath = url.pathname.match(/\/bus\/([0-9a-f-]{36})/i)?.[1];
    const tripFromPath = url.pathname.match(/\/trip\/([0-9a-f-]{36})/i)?.[1];
    const busId = cleanValue(url.searchParams.get('bus_id') || url.searchParams.get('busId') || url.searchParams.get('bus') || busFromPath);
    const tripId = cleanValue(url.searchParams.get('trip_id') || url.searchParams.get('tripId') || url.searchParams.get('trip') || tripFromPath);
    if (UUID_RE.test(busId)) return { type: 'bus', id: busId };
    if (UUID_RE.test(tripId)) return { type: 'trip', id: tripId };
  } catch {
    // QR is not a URL.
  }

  const prefixed = text.match(/^(bus|bus_id|trip|trip_id):\s*([0-9a-f-]{36})$/i);
  if (prefixed && UUID_RE.test(prefixed[2])) {
    return { type: prefixed[1].toLowerCase().startsWith('trip') ? 'trip' : 'bus', id: prefixed[2] };
  }

  if (UUID_RE.test(text)) return { type: 'bus', id: text };
  return null;
}

export default function QRPage() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const lockedRef = useRef(false);

  const [status, setStatus] = useState('starting');
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const [resolving, setResolving] = useState(false);

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const resolveScan = async (raw) => {
    if (lockedRef.current) return;
    const parsed = parseBusQr(raw);
    if (!parsed) {
      setError('This is not a valid BusLoop bus QR.');
      return;
    }

    lockedRef.current = true;
    setResolving(true);
    setError('');

    try {
      let busId = parsed.type === 'bus' ? parsed.id : null;
      if (parsed.type === 'trip') {
        const trip = await tripService.getById(parsed.id);
        busId = trip?.bus_id;
      }

      if (!busId) throw new Error('Bus not found for this QR.');
      await busService.getById(busId);
      stopCamera();
      navigate(`/bus/${busId}`);
    } catch (err) {
      lockedRef.current = false;
      setResolving(false);
      setError(err?.message || 'Could not open this bus. Please try another QR.');
    }
  };

  const scanFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || lockedRef.current) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) {
        resolveScan(code.data);
        return;
      }
    }

    rafRef.current = requestAnimationFrame(scanFrame);
  };

  const startCamera = async () => {
    stopCamera();
    lockedRef.current = false;
    setStatus('starting');
    setError('');

    try {
      if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
        throw new Error('Camera needs HTTPS on phone browsers. Use the installed app or open a secure HTTPS link.');
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera scanning is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        video.muted = true;
        video.setAttribute('playsinline', true);
        video.setAttribute('webkit-playsinline', true);

        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await video.play();
            break;
          } catch (err) {
            if (!isPlayInterrupted(err) || attempt === 2) throw err;
            await delay(180);
          }
        }

        setStatus('active');
        rafRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Camera permission denied. Allow camera access or enter the code manually.'
        : err?.message || 'Camera could not be started.';
      setStatus('error');
      setError(msg);
      stopCamera();
    }
  };

  useEffect(() => {
    startCamera();
    return stopCamera;
  }, []);

  const submitManual = () => resolveScan(manual);

  return (
    <div className="page">
      <AppHeader title="Scan Bus QR" />
      <div className="page-content" style={{ paddingBottom: 110 }}>
        <div style={{
          background: status === 'active' ? '#0B1020' : 'linear-gradient(180deg, #FFF7F7 0%, #FFFFFF 52%, #F6F7FB 100%)',
          borderRadius: 22,
          overflow: 'hidden',
          minHeight: 360,
          position: 'relative',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-md)',
        }}>
          <video ref={videoRef} muted playsInline style={{ width: '100%', height: 360, objectFit: 'cover', display: status === 'active' ? 'block' : 'none' }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {status !== 'active' && (
            <div style={{
              height: 360,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              color: 'var(--text-primary)',
              gap: 12,
              textAlign: 'center',
              padding: 28,
            }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: 22,
                background: 'var(--brand-light)',
                border: '1px solid rgba(239,62,66,0.20)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--brand)',
              }}>
                {status === 'starting'
                  ? <RefreshCw size={30} style={{ animation: 'spin 0.8s linear infinite' }} />
                  : <AlertCircle size={32} />}
              </div>
              <div style={{ fontWeight: 800 }}>{status === 'starting' ? 'Starting camera...' : 'Camera unavailable'}</div>
              {error && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5, maxWidth: 310 }}>{error}</p>}
              {status === 'error' && (
                <button className="btn btn--primary" onClick={startCamera} style={{ borderRadius: 14, boxShadow: 'var(--shadow-brand)' }}>
                  <Camera size={16} /> Try Camera Again
                </button>
              )}
            </div>
          )}

          {status === 'active' && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 230, height: 230, border: '3px solid rgba(255,255,255,0.85)', borderRadius: 24, boxShadow: '0 0 0 999px rgba(15,23,42,0.42)' }} />
              <div style={{ position: 'absolute', bottom: 24, left: 20, right: 20, color: 'white', textAlign: 'center', fontWeight: 700, textShadow: '0 2px 12px rgba(0,0,0,0.55)' }}>
                Point camera at the QR inside the bus
              </div>
            </div>
          )}

          {resolving && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', gap: 10, fontWeight: 800 }}>
              <RefreshCw size={20} style={{ animation: 'spin 0.8s linear infinite' }} />
              Opening bus...
            </div>
          )}
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <QrCode size={19} color="var(--brand)" />
            </div>
            <div>
              <div style={{ fontWeight: 800, color: 'var(--text)' }}>Bus QR ticket booking</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Scan bus QR, then pay online and generate ticket</div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Manual QR Code</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                placeholder="Paste bus_id, trip_id, URL, or JSON"
                style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
              />
              <button className="btn btn--primary" onClick={submitManual} disabled={!manual.trim() || resolving} style={{ borderRadius: 12 }}>
                <Search size={16} />
              </button>
            </div>
          </div>

          {error && status === 'active' && (
            <div style={{ marginTop: 12, background: 'var(--brand-light)', color: 'var(--brand-dark)', border: '1px solid rgba(239,62,66,0.30)', borderRadius: 12, padding: '10px 12px', fontSize: '0.82rem', fontWeight: 600 }}>
              {error}
            </div>
          )}

          <button className="btn btn--secondary btn--full" onClick={() => navigate(-1)} style={{ marginTop: 14 }}>
            <X size={16} /> Close Scanner
          </button>
        </div>
      </div>
      <BottomNav />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
