const ENDPOINT = import.meta.env.VITE_ERROR_LOG_ENDPOINT || '';
const APP_NAME = 'busnow-user';

const safePayload = (error, context = {}) => ({
  app: APP_NAME,
  mode: import.meta.env.MODE,
  message: error?.message || String(error || 'Unknown error'),
  stack: error?.stack || null,
  context,
  path: window.location.pathname,
  timestamp: new Date().toISOString(),
});

export function captureError(error, context = {}) {
  const payload = safePayload(error, context);
  console.error(`[${APP_NAME}]`, payload.message, payload.context);

  if (!ENDPOINT) return;
  try {
    navigator.sendBeacon?.(ENDPOINT, new Blob([JSON.stringify(payload)], { type: 'application/json' }))
      || fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
  } catch {
    // Never let logging break the app.
  }
}

export function initObservability() {
  window.addEventListener('error', (event) => {
    captureError(event.error || event.message, { source: 'window.error' });
  });
  window.addEventListener('unhandledrejection', (event) => {
    captureError(event.reason, { source: 'unhandledrejection' });
  });
}
