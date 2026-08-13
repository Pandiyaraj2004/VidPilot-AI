export type ServiceConnectionState = "connected" | "not_connected" | "degraded";

export interface SystemStatus {
  vidpilot: "operational" | "degraded" | "down";
  database: "connected" | "disconnected";
  automation: "ready" | "not_configured" | "running";
  telegram: ServiceConnectionState;
  youtube: ServiceConnectionState;
  schedulerState?: any;
}

export type IntegrationKey = "gemini" | "openrouter" | "telegram" | "youtube" | "supabase" | "firebase";

export interface IntegrationState {
  key: IntegrationKey;
  label: string;
  configured: boolean;
}
