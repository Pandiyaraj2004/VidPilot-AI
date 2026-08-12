import { CheckCircle2, ExternalLink, Upload, XCircle } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { YouTubePublication } from "@/types";

const STATUS_BADGE: Record<YouTubePublication["status"], BadgeVariant> = {
  not_uploaded: "neutral",
  uploading: "info",
  uploaded: "success",
  failed: "error",
};

const STATUS_LABEL: Record<YouTubePublication["status"], string> = {
  not_uploaded: "Not uploaded",
  uploading: "Uploading…",
  uploaded: "Published",
  failed: "Upload failed",
};

export function YoutubePublicationCard({
  youtube,
  eligible,
  ineligibleReason,
  onUpload,
  uploading,
}: {
  youtube: YouTubePublication | null;
  eligible: boolean;
  ineligibleReason?: string;
  onUpload: () => void;
  uploading: boolean;
}) {
  const status = youtube?.status ?? "not_uploaded";

  return (
    <div className="rounded-lg border border-border bg-surface-elevated p-4">
      <div className="flex items-center gap-2">
        {status === "uploaded" && <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />}
        {status === "failed" && <XCircle className="h-4 w-4 text-error" aria-hidden="true" />}
        <h3 className="text-sm font-semibold text-text-primary">YouTube</h3>
        <Badge variant={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</Badge>
      </div>

      {status === "uploaded" && youtube?.url && (
        <div className="mt-2 space-y-1 text-xs text-text-secondary">
          <p>Uploaded {youtube.uploadedAt ? new Date(youtube.uploadedAt).toLocaleString() : ""}</p>
          <p>Privacy: {youtube.privacyStatus}</p>
          {youtube.containsSyntheticMedia && <p>Marked as containing AI-generated/synthetic content.</p>}
          <a
            href={youtube.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Open on YouTube
          </a>
        </div>
      )}

      {status === "failed" && youtube?.lastError && (
        <p className="mt-3 rounded-md bg-error/10 px-3 py-2 text-xs text-error">{youtube.lastError}</p>
      )}

      {status !== "uploaded" && (
        <>
          {!eligible && ineligibleReason && <p className="mt-2 text-xs text-text-secondary">{ineligibleReason}</p>}
          <Button
            variant="secondary"
            className="mt-3"
            disabled={!eligible || uploading}
            loading={uploading}
            onClick={onUpload}
          >
            <Upload className="h-4 w-4" />
            {status === "failed" ? "Retry Upload" : "Upload to YouTube"}
          </Button>
        </>
      )}
    </div>
  );
}
