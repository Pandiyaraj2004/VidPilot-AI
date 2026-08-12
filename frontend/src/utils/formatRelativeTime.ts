export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSeconds = Math.round(diffMs / 1000);

  if (diffSeconds < 60) return "Just now";

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return `${Math.round(seconds)}s`;
  return `${minutes} min`;
}

/** One-decimal seconds display for short scene-level audio clips, e.g. "12.4s". */
export function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(1)}s`;
}
