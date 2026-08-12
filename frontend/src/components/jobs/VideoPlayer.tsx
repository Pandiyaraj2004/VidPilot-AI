import type { VideoRenderMetadata } from "@/types";
import { formatDuration } from "@/utils/formatRelativeTime";

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface VideoPlayerProps {
  src: string;
  metadata: VideoRenderMetadata;
}

/** The finished video, streamed from the backend's own video-serving route — never a raw filesystem path. */
export function VideoPlayer({ src, metadata }: VideoPlayerProps) {
  return (
    <div className="space-y-2">
      <video controls preload="metadata" className="w-full rounded-lg border border-border bg-black" src={src}>
        Your browser does not support video playback.
      </video>
      <p className="text-xs text-text-muted">
        {metadata.width}×{metadata.height} · {metadata.fps}fps · {metadata.videoCodec}/{metadata.audioCodec}
        {metadata.durationSeconds != null ? ` · ${formatDuration(metadata.durationSeconds)}` : ""}
        {metadata.fileSizeBytes != null ? ` · ${formatFileSize(metadata.fileSizeBytes)}` : ""}
      </p>
    </div>
  );
}
