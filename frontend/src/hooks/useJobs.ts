import { listJobs } from "@/services/jobs/jobService";
import type { JobStatus, VideoJob } from "@/types";
import { useCallback, useEffect, useState } from "react";

export interface UseJobsFilter {
  status?: JobStatus;
  search?: string;
}

interface UseJobsResult {
  jobs: VideoJob[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const POLL_INTERVAL_MS = 5000;

/**
 * Polls the backend for the job list. Real Firestore listeners would push
 * updates instantly, but the frontend never talks to Firestore directly
 * (see README) — polling is the Phase 2 stand-in for "real-time enough,"
 * upgradeable to Server-Sent Events later without changing this hook's shape.
 */
export function useJobs(filter?: UseJobsFilter, pollIntervalMs = POLL_INTERVAL_MS): UseJobsResult {
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchToken, setRefetchToken] = useState(0);

  const status = filter?.status;
  const search = filter?.search;

  // Optimize DB reads: if list contains no active processing jobs, slow down polling to 30s
  const hasActiveJob = jobs.some(job => 
    !["ready", "failed", "published", "cancelled", "approved", "rejected", "draft"].includes(job.status)
  );
  const effectiveInterval = pollIntervalMs > 0 ? (hasActiveJob ? pollIntervalMs : 30000) : 0;

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function load(isBackground: boolean) {
      if (!isBackground) setLoading(true);
      try {
        const result = await listJobs({ status, search });
        if (!cancelled) {
          setJobs(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load video jobs.");
        }
      } finally {
        if (!cancelled && !isBackground) setLoading(false);
      }
    }

    load(false);
    if (effectiveInterval > 0) {
      timer = window.setInterval(() => load(true), effectiveInterval);
    }

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [status, search, effectiveInterval, refetchToken]);

  const refetch = useCallback(() => setRefetchToken((t) => t + 1), []);

  return { jobs, loading, error, refetch };
}
