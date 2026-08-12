import { youtubeService, type YouTubeStatus } from "@/services/youtube/youtubeService";
import { useCallback, useEffect, useState } from "react";

interface UseYoutubeStatusResult {
  status: YouTubeStatus | null;
  loading: boolean;
  refetch: () => void;
}

/** Real connected-channel status from the backend — never assumed from job data or cached client-side state. */
export function useYoutubeStatus(): UseYoutubeStatusResult {
  const [status, setStatus] = useState<YouTubeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    youtubeService
      .getStatus()
      .then((result) => {
        if (!cancelled) setStatus(result);
      })
      .catch(() => {
        if (!cancelled) setStatus({ connected: false, channel: null, configured: false });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  return { status, loading, refetch };
}
