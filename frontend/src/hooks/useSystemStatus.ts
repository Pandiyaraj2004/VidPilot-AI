import { getSystemStatus } from "@/services/api/statusService";
import type { SystemStatus } from "@/types";
import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 15000;

interface UseSystemStatusResult {
  status: SystemStatus | null;
  reachable: boolean;
}

export function useSystemStatus(pollIntervalMs = POLL_INTERVAL_MS): UseSystemStatusResult {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [reachable, setReachable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function load() {
      try {
        const result = await getSystemStatus();
        if (!cancelled) {
          setStatus(result);
          setReachable(true);
        }
      } catch {
        if (!cancelled) setReachable(false);
      }
    }

    load();
    if (pollIntervalMs > 0) {
      timer = window.setInterval(load, pollIntervalMs);
    }

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [pollIntervalMs]);

  return { status, reachable };
}
