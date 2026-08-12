import { apiGet } from "@/services/api/client";
import type { SystemStatus } from "@/types";

export function getSystemStatus(): Promise<SystemStatus> {
  return apiGet<SystemStatus>("/status");
}
