/**
 * CameraQRScanner
 * ─────────────────
 * Opens the device's back camera, renders a live viewfinder and continuously
 * decodes frames with jsQR. Calls onResult(rawText) as soon as a QR code is found.
 */
import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { X, RefreshCw, Camera, AlertCircle } from 'lucide-react';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const isPlayInterrupted = (err) => err?.name === 'AbortError' || String(err?.message || '').includes('interrupted by a new load request');

export default function CameraQRScanner({ onResult, onClose }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const streamRef = useRef(null);

  const [status, setStatus] = useState('starting'); // 'starting' | 'active' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [detected, setDetected] = useState(false);

  /* ── Start camera ─────────────────────────────────────────── */
  const startCamera = async () => {
    stopCamera();
    setStatus('starting');
    setErrorMsg('');
    try {
      if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
        throw new Error('Camera needs HTTPS on phone browsers. Use the installed app or open a secure HTTPS link.');
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera is not available in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        video.muted = true;
        video.setAttribute('playsinline', true); // iOS
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
        scanLoop();
      }
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow camera access in your browser settings.'
        : err.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : `Camera error: ${err.message}`;
      setErrorMsg(msg);
      setStatus('error');
    }
  };

  /* ── Continuous scan loop ─────────────────────────────────── */
  const scanLoop = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const tick = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (w && h) {
          canvas.width  = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, w, h);
          const imageData = ctx.getImageData(0, 0, w, h);
          const code = jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' });
          if (code?.data) {
            setDetected(true);
            stopCamera();
            // Small delay so the user sees the "detected" flash
            setTimeout(() => onResult(code.data), 300);
            return;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  /* ── Stop camera ──────────────────────────────────────────── */
  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0B1020',
      zIndex: 2000,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Hidden canvas for frame processing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* ── Top bar ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        padding: 'calc(env(safe-area-inset-top) + 12px) 16px 12px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={() => { stopCamera(); onClose(); }} style={{
          width: 38, height: 38, borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'white', flexShrink: 0,
        }}>
          <X size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>Scan UPI QR</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginTop: 1 }}>
            Point at the QR code on the bus
          </div>
        </div>
      </div>

      {/* ── Camera feed ── */}
      <video
        ref={videoRef}
        muted
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* ── Viewfinder overlay ── */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        {/* Dark vignette corners */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 55% 55% at 50% 50%, transparent 48%, rgba(0,0,0,0.55) 100%)',
        }} />

        {/* Scan frame */}
        <div style={{
          width: 240, height: 240, position: 'relative',
          borderRadius: 20,
          border: detected ? '2px solid var(--success)' : '2px solid rgba(255,255,255,0.15)',
          transition: 'border-color 0.3s',
          background: detected ? 'rgba(16,185,129,0.1)' : 'transparent',
          zIndex: 2,
        }}>
          {/* Animated corner brackets */}
          {[
            { top: -2, left: -2,    borderTopWidth: 3,    borderLeftWidth: 3,    borderRadius: '12px 0 0 0' },
            { top: -2, right: -2,   borderTopWidth: 3,    borderRightWidth: 3,   borderRadius: '0 12px 0 0' },
            { bottom: -2, left: -2,  borderBottomWidth: 3, borderLeftWidth: 3,    borderRadius: '0 0 0 12px' },
            { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3,   borderRadius: '0 0 12px 0' },
          ].map((s, i) => (
            <div key={i} style={{
              position: 'absolute', width: 32, height: 32,
              borderStyle: 'solid',
              borderColor: detected ? 'var(--success)' : 'var(--brand)',
              borderWidth: 0,
              transition: 'border-color 0.3s',
              ...s,
            }} />
          ))}

          {/* Scan line */}
          {status === 'active' && !detected && (
            <div style={{
              position: 'absolute', left: '6%', right: '6%', height: 2,
              background: 'linear-gradient(90deg, transparent, var(--brand), transparent)',
              boxShadow: '0 0 10px var(--brand), 0 0 20px rgba(239,62,66,0.4)',
              animation: 'qrScan 2s ease-in-out infinite',
            }} />
          )}

          {/* Detected flash */}
          {detected && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 18,
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'qrPop 0.3s cubic-bezier(0.34,1.56,0.64,1)',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Status label */}
        <div style={{
          marginTop: 24, zIndex: 2,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
          borderRadius: 99, padding: '8px 20px',
        }}>
          {status === 'starting' && (
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <RefreshCw size={13} style={{ animation: 'qrSpin 1s linear infinite' }} />
              Starting camera...
            </div>
          )}
          {status === 'active' && !detected && (
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8125rem', fontWeight: 500 }}>
              Scanning for QR code...
            </div>
          )}
          {detected && (
            <div style={{ color: 'var(--success)', fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              QR detected
            </div>
          )}
        </div>
      </div>

      {/* ── Error state ── */}
      {status === 'error' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 32, gap: 16,
          background: 'linear-gradient(180deg, #FFF7F7 0%, #FFFFFF 52%, #F6F7FB 100%)',
        }}>
          <div style={{ width: 64, height: 64, borderRadius: 22, background: 'var(--brand-light)', border: '1px solid rgba(239,62,66,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={30} color="var(--brand)" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '1.08rem', marginBottom: 8 }}>Camera Unavailable</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5, maxWidth: 310 }}>{errorMsg}</div>
          </div>
          <button onClick={startCamera} style={{
            padding: '12px 28px', background: 'var(--brand)', color: 'white', border: 'none', borderRadius: 14,
            fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: 'var(--shadow-brand)',
          }}>
            <RefreshCw size={15} /> Try Again
          </button>
          <button onClick={() => { stopCamera(); onClose(); }} style={{
            padding: '10px 24px', background: 'var(--bg-card)', color: 'var(--text-secondary)',
            border: '1px solid var(--border)', borderRadius: 14,
            fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
          }}>
            Go Back
          </button>
        </div>
      )}

      <style>{`
        @keyframes qrScan { 0% { top: 8%; } 50% { top: 84%; } 100% { top: 8%; } }
        @keyframes qrSpin { to { transform: rotate(360deg); } }
        @keyframes qrPop  { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}
