export const ENABLE_DEMO_MODE = import.meta.env.VITE_ENABLE_DEMO_MODE === 'true';
export const ALLOW_LOCAL_MOCKS = import.meta.env.DEV && import.meta.env.VITE_ALLOW_LOCAL_MOCKS === 'true';
export const SHOW_DEMO_LOGIN = ENABLE_DEMO_MODE && import.meta.env.VITE_SHOW_DEMO_LOGIN === 'true';

export const canUseMockData = () => ENABLE_DEMO_MODE || ALLOW_LOCAL_MOCKS;

export const appModeLabel = ENABLE_DEMO_MODE
  ? 'demo'
  : import.meta.env.PROD
    ? 'production'
    : 'development';
