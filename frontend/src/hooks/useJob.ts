import { ApiError } from "@/services/api/client";
import { getJob } from "@/services/jobs/jobService";
import type { VideoJob } from "@/types";
import { useCallback, useEffect, useState } from "react";

interface UseJobResult {
  job: VideoJob | null;
  loading: boolean;
  error: string | null;
  notFound: boolean;
  refetch: () => void;
}

const POLL_INTERVAL_MS = 4000;

export function useJob(id: string | undefined, pollIntervalMs = POLL_INTERVAL_MS): UseJobResult {
  const [job, setJob] = useState<VideoJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [refetchToken, setRefetchToken] = useState(0);

  // Slow down polling when job reaches a terminal status to reduce DB reads
  const isActive = job 
    ? !["ready", "failed", "published", "cancelled", "draft", "approved", "rejected"].includes(job.status) 
    : true;
  const effectiveInterval = pollIntervalMs > 0 ? (isActive ? pollIntervalMs : 60000) : 0;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let timer: number | undefined;

    async function load(isBackground: boolean) {
      if (!isBackground) setLoading(true);
      try {
        const result = await getJob(id as string);
        if (!cancelled) {
          setJob(result);
          setError(null);
          setNotFound(false);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 404) {
            setNotFound(true);
          } else {
            setError(err instanceof Error ? err.message : "Unable to load this video job.");
          }
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
  }, [id, effectiveInterval, refetchToken]);

  const refetch = useCallback(() => setRefetchToken((t) => t + 1), []);

  return { job, loading, error, notFound, refetch };
}
