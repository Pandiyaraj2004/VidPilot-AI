import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { JOB_STATUS_LABELS, type JobStatus } from "@/types";

const STATUS_VARIANT: Record<JobStatus, BadgeVariant> = {
  draft: "neutral",
  queued: "neutral",
  generating_script: "info",
  script_ready: "success",
  script_review: "warning",
  generating_voice: "info",
  voice_ready: "success",
  generating_visuals: "info",
  generating_subtitles: "info",
  rendering: "info",
  video_validation: "info",
  video_ready: "success",
  generating_thumbnail: "info",
  quality_check: "info",
  ready: "warning",
  awaiting_approval: "warning",
  rejected: "error",
  regenerating: "info",
  approved: "success",
  uploading: "info",
  processing: "info",
  published: "success",
  failed: "error",
  cancelled: "error",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{JOB_STATUS_LABELS[status]}</Badge>;
}
