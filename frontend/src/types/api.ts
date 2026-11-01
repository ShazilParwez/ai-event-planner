export interface StandardResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: string[];
}

export interface HealthCheckResponse {
  status: string;
  environment: string;
  database_connected: boolean;
  ai_provider_mode: 'mock' | 'gemini' | 'fallback';
  ai_circuit_breaker: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  version: string;
}

