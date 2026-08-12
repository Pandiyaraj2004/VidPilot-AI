import { CheckCircle2, ChevronDown, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import type { QualityCategory, QualityCheckResult, QualityReport } from "@/types";

const CATEGORY_LABEL: Record<QualityCategory, string> = {
  video: "Technical Video",
  audio: "Audio",
  captions: "Captions",
  visuals: "Visuals",
  sync: "Synchronization",
  metadata: "Metadata",
  content: "Content Relevance",
  license: "Licensing",
};

const STATUS_BADGE: Record<QualityReport["status"], BadgeVariant> = {
  PASS: "success",
  WARN: "warning",
  FAIL: "error",
};

function StatusIcon({ status }: { status: QualityCheckResult["status"] }) {
  if (status === "PASS") return <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />;
  if (status === "WARN") return <CheckCircle2 className="h-4 w-4 text-warning" aria-hidden="true" />;
  return <XCircle className="h-4 w-4 text-error" aria-hidden="true" />;
}

function CategoryRow({ category, result }: { category: QualityCategory; result: QualityCheckResult }) {
  const [open, setOpen] = useState(false);
  const hasDetails = result.issues.length > 0;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 py-2 text-left"
        onClick={() => hasDetails && setOpen((v) => !v)}
        disabled={!hasDetails}
      >
        <div className="flex items-center gap-2">
          <StatusIcon status={result.status} />
          <span className="text-sm text-text-primary">{CATEGORY_LABEL[category]}</span>
        </div>
        {hasDetails && (
          <ChevronDown className={cn("h-4 w-4 text-text-secondary transition-transform", open && "rotate-180")} aria-hidden="true" />
        )}
      </button>
      {open && hasDetails && (
        <ul className="mb-2 space-y-1 pl-6 text-xs text-text-secondary">
          {result.issues.map((issue, i) => (
            <li key={i} className={issue.severity === "critical" || issue.severity === "error" ? "text-error" : "text-warning"}>
              {issue.sceneId ? `[${issue.sceneId}] ` : ""}
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const CATEGORY_ORDER: QualityCategory[] = ["video", "audio", "captions", "visuals", "sync", "metadata", "content", "license"];

export function QualityReportCard({ report }: { report: QualityReport }) {
  return (
    <div className="rounded-lg border border-border bg-surface-elevated p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">Quality Check</h3>
          <Badge variant={STATUS_BADGE[report.status]}>{report.status}</Badge>
        </div>
        <span className="text-sm font-medium text-text-secondary">{report.score}/100</span>
      </div>

      <div className="mt-3">
        {CATEGORY_ORDER.map((category) => (
          <CategoryRow key={category} category={category} result={report[category]} />
        ))}
      </div>

      {report.status === "FAIL" && (
        <p className="mt-3 rounded-md bg-error/10 px-3 py-2 text-xs text-error">
          This video did not pass quality control and is not eligible for approval yet. Fix the issues above and regenerate the affected
          scene(s), then run the quality check again.
        </p>
      )}

      <p className="mt-2 text-[11px] text-text-secondary">Checked {new Date(report.checkedAt).toLocaleString()}</p>
    </div>
  );
}

export function QualityCheckPending() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-elevated p-4">
      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-text-primary">Quality checking…</p>
        <p className="text-xs text-text-secondary">Analyzing the rendered video, audio, captions, and metadata…</p>
      </div>
    </div>
  );
}

export function RunQualityCheckButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <Button variant="secondary" disabled={loading} loading={loading} onClick={onClick}>
      Run Quality Check
    </Button>
  );
}
