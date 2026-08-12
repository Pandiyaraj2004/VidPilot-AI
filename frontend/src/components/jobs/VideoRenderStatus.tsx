import { Loader2 } from "lucide-react";
import type { JobStatus } from "@/types";

const STAGE_LABEL: Partial<Record<JobStatus, string>> = {
  generating_visuals: "Choosing backgrounds and templates…",
  generating_subtitles: "Timing captions to narration audio…",
  rendering: "Rendering scenes with Remotion — this can take a minute or two…",
  video_validation: "Checking the rendered file…",
};

/**
 * The backend runs this as one blocking request per stage, same as script/
 * voice generation — no fake per-frame progress bar, just an honest label
 * for whichever stage is actually running right now.
 */
export function VideoRenderStatus({ status }: { status: JobStatus }) {
  const label = STAGE_LABEL[status] ?? "Rendering your video…";
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-elevated p-4">
      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-text-primary">Generating video…</p>
        <p className="text-xs text-text-secondary">{label}</p>
      </div>
    </div>
  );
}
