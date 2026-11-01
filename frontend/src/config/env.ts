/**
 * Environment configuration with validation and default fallbacks.
 * Never stores or exposes secrets in frontend client code.
 */

interface ClientEnvironment {
  readonly apiBaseUrl: string;
  readonly appTitle: string;
  readonly appEnv: 'development' | 'production' | 'test';
  readonly isDevelopment: boolean;
  readonly isProduction: boolean;
}

const getEnvVar = (key: keyof ImportMetaEnv, defaultValue: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || defaultValue;
  }
  return defaultValue;
};

export const env: ClientEnvironment = {
  apiBaseUrl: getEnvVar('VITE_API_BASE_URL', 'http://localhost:8000/api/v1'),
  appTitle: getEnvVar('VITE_APP_TITLE', 'AI Event Planner'),
  appEnv: (getEnvVar('VITE_APP_ENV', 'development') as ClientEnvironment['appEnv']),
  isDevelopment: typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV),
  isProduction: typeof import.meta !== 'undefined' && Boolean(import.meta.env?.PROD),
};
