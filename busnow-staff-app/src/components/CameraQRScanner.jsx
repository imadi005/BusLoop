import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { AlertCircle, Camera, RefreshCw, X } from 'lucide-react';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const isPlayInterrupted = (err) => err?.name === 'AbortError' || String(err?.message || '').includes('interrupted by a new load request');

export default function CameraQRScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const closingRef = useRef(false);

  const [status, setStatus] = useState('starting');
  const [errorMsg, setErrorMsg] = useState('');
  const [detected, setDetected] = useState(false);

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const close = () => {
    closingRef.current = true;
    stopCamera();
    onClose();
  };

  const scanLoop = async () => {
    if (closingRef.current || !videoRef.current || !canvasRef.current) return;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth && video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
        if (code?.data) {
          setDetected(true);
          stopCamera();
          setTimeout(() => onResult(code.data), 250);
          return;
        }
      }
    } catch {
      // Some browsers throw while the video is warming up. Retry on the next tick.
    }

    rafRef.current = requestAnimationFrame(scanLoop);
  };

  const startCamera = async () => {
    closingRef.current = false;
    stopCamera();
    setStatus('starting');
    setErrorMsg('');
    setDetected(false);

    try {
      if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
        throw new Error('Camera needs HTTPS on phone browsers. Use the installed app or open a secure HTTPS link.');
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera is not available in this browser. Enter the ticket code manually.');
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
        rafRef.current = requestAnimationFrame(scanLoop);
      }
    } catch (err) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow camera access and try again.'
        : err?.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : err?.message || 'Camera could not be started.';
      setErrorMsg(msg);
      setStatus('error');
      stopCamera();
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      closingRef.current = true;
      stopCamera();
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 2200,
      background: '#0B1020',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 4,
        padding: 'calc(env(safe-area-inset-top) + 12px) 16px 12px',
        background: 'linear-gradient(to bottom, rgba(2,6,23,0.82), transparent)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <button onClick={close} style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.18)',
          background: 'rgba(255,255,255,0.12)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <X size={18} />
        </button>
        <div>
          <div style={{ color: 'white', fontWeight: 800 }}>Scan Ticket QR</div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.78rem' }}>
            Point camera at passenger ticket
          </div>
        </div>
      </div>

      <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 56% 56% at 50% 50%, transparent 45%, rgba(2,6,23,0.68) 100%)',
        }} />
        <div style={{
          width: 246,
          height: 246,
          borderRadius: 22,
          border: detected ? '2px solid var(--success)' : '2px solid rgba(255,255,255,0.22)',
          position: 'relative',
          zIndex: 1,
          background: detected ? 'rgba(16,185,129,0.12)' : 'transparent',
        }}>
          {[['top', 'left'], ['top', 'right'], ['bottom', 'left'], ['bottom', 'right']].map(([v, h]) => (
            <div key={`${v}-${h}`} style={{
              position: 'absolute',
              [v]: -2,
              [h]: -2,
              width: 36,
              height: 36,
              borderColor: detected ? 'var(--success)' : 'var(--success)',
              borderStyle: 'solid',
              borderWidth: `${v === 'top' ? 4 : 0}px ${h === 'right' ? 4 : 0}px ${v === 'bottom' ? 4 : 0}px ${h === 'left' ? 4 : 0}px`,
              borderRadius: `${v === 'top' && h === 'left' ? 14 : 0}px ${v === 'top' && h === 'right' ? 14 : 0}px ${v === 'bottom' && h === 'right' ? 14 : 0}px ${v === 'bottom' && h === 'left' ? 14 : 0}px`,
            }} />
          ))}

          {status === 'active' && !detected && (
            <div style={{
              position: 'absolute',
              left: '8%',
              right: '8%',
              height: 2,
              background: 'linear-gradient(90deg, transparent, var(--success), transparent)',
              boxShadow: '0 0 16px rgba(16,185,129,0.8)',
              animation: 'ticketQrScan 1.8s ease-in-out infinite',
            }} />
          )}
        </div>

        <div style={{
          marginTop: 24,
          zIndex: 2,
          borderRadius: 99,
          padding: '9px 18px',
          background: 'rgba(2,6,23,0.72)',
          color: 'white',
          fontSize: '0.84rem',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          {status === 'starting' && <><RefreshCw size={14} style={{ animation: 'ticketQrSpin 0.8s linear infinite' }} /> Starting camera...</>}
          {status === 'active' && !detected && <><Camera size={14} /> Scanning for ticket QR...</>}
          {detected && <span style={{ color: 'var(--success)', fontWeight: 800 }}>QR detected</span>}
        </div>
      </div>

      {status === 'error' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 8,
          background: 'linear-gradient(180deg, #FFF7F7 0%, #FFFFFF 52%, #F6F7FB 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 28,
          textAlign: 'center',
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 22,
            background: 'var(--brand-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            border: '1px solid rgba(239,62,66,0.20)',
          }}>
            <AlertCircle size={30} color="var(--danger)" />
          </div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Camera Unavailable</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 18, maxWidth: 300 }}>
            {errorMsg}
          </p>
          <button onClick={startCamera} style={{
            padding: '12px 24px',
            borderRadius: 14,
            border: 'none',
            background: 'var(--brand)',
            color: 'white',
            fontWeight: 800,
            cursor: 'pointer',
            marginBottom: 10,
            boxShadow: 'var(--shadow-brand)',
          }}>
            Try Again
          </button>
          <button onClick={close} style={{
            padding: '10px 20px',
            borderRadius: 14,
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            color: 'var(--text-secondary)',
            fontWeight: 700,
            cursor: 'pointer',
          }}>
            Enter Code Manually
          </button>
        </div>
      )}

      <style>{`
        @keyframes ticketQrScan { 0%{top:8%} 50%{top:88%} 100%{top:8%} }
        @keyframes ticketQrSpin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
