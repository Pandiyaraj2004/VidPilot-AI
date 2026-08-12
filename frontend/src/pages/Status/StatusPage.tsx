import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { apiGet } from "@/services/api/client";
import { ROUTES, jobDetailsRoute } from "@/constants/routes";
import type { VideoJob } from "@/types";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Video,
  Send,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

const POLL_INTERVAL_MS = 15000;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    draft: { color: "bg-surface text-text-secondary", label: "Draft" },
    queued: { color: "bg-blue-500/20 text-blue-400", label: "Queued" },
    generating_script: { color: "bg-violet-500/20 text-violet-400", label: "Generating Script" },
    script_ready: { color: "bg-violet-500/20 text-violet-400", label: "Script Ready" },
    generating_voice: { color: "bg-cyan-500/20 text-cyan-400", label: "Generating Voice" },
    voice_ready: { color: "bg-cyan-500/20 text-cyan-400", label: "Voice Ready" },
    generating_visuals: { color: "bg-orange-500/20 text-orange-400", label: "Generating Visuals" },
    generating_subtitles: { color: "bg-orange-500/20 text-orange-400", label: "Generating Subtitles" },
    rendering: { color: "bg-amber-500/20 text-amber-400", label: "Rendering" },
    video_validation: { color: "bg-amber-500/20 text-amber-400", label: "Validating" },
    video_ready: { color: "bg-yellow-500/20 text-yellow-400", label: "Video Ready" },
    quality_check: { color: "bg-yellow-500/20 text-yellow-400", label: "Quality Check" },
    ready: { color: "bg-success/20 text-success", label: "Ready" },
    awaiting_approval: { color: "bg-blue-500/20 text-blue-400 animate-pulse", label: "Awaiting Approval" },
    approved: { color: "bg-success/20 text-success", label: "Approved" },
    rejected: { color: "bg-error/20 text-error", label: "Rejected" },
    uploading: { color: "bg-violet-500/20 text-violet-400 animate-pulse", label: "Uploading" },
    published: { color: "bg-success/20 text-success", label: "Published ✓" },
    failed: { color: "bg-error/20 text-error", label: "Failed" },
    cancelled: { color: "bg-surface text-text-secondary", label: "Cancelled" },
  };
  const cfg = map[status] ?? { color: "bg-surface text-text-secondary", label: status };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function QualityBadge({ score }: { score: number }) {
  const pass = score >= 70;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
        pass ? "bg-success/20 text-success" : "bg-error/20 text-error"
      }`}
    >
      {pass ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      QC {score}/100 — {pass ? "PASS" : "FAIL"}
    </span>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-3 last:border-0">
      <span className="text-xs text-text-secondary">{label}</span>
      <span className="text-xs font-medium text-text-primary">{children}</span>
    </div>
  );
}

export default function StatusPage() {
  const [job, setJob] = useState<VideoJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchLatest(silent = false) {
    if (!silent) setRefreshing(true);
    try {
      const latest = await apiGet<VideoJob>("/jobs/latest");
      setJob(latest);
      setLastUpdated(new Date());
    } catch {
      // 404 means no jobs yet — that's fine
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const isActive = job 
    ? !["ready", "failed", "published", "cancelled", "draft", "approved", "rejected"].includes(job.status) 
    : true;
  const effectiveInterval = isActive ? POLL_INTERVAL_MS : 60000;

  useEffect(() => {
    void fetchLatest();
    intervalRef.current = setInterval(() => void fetchLatest(true), effectiveInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [effectiveInterval]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Live Pipeline Status"
        description="Real-time view of the latest automated production job. Refreshes every 15 seconds."
      />

      {/* Top bar */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span
            className={`h-2 w-2 rounded-full ${refreshing ? "bg-accent animate-pulse" : "bg-success"}`}
          />
          {refreshing ? "Refreshing…" : lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : "Connecting…"}
        </div>
        <button
          onClick={() => void fetchLatest()}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-background hover:text-text-primary disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Activity className="h-6 w-6 animate-pulse text-accent" />
          <span className="ml-3 text-sm text-text-secondary">Loading latest job…</span>
        </div>
      ) : !job ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Clock className="h-10 w-10 text-text-secondary opacity-40" />
            <p className="text-sm font-medium text-text-secondary">No jobs yet</p>
            <p className="text-xs text-text-secondary">
              Enable the scheduler or{" "}
              <Link to={ROUTES.create} className="text-accent underline underline-offset-2">
                create a video manually
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main job card */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-text-primary">{job.content?.title ?? job.topic}</p>
                    <p className="mt-0.5 truncate text-xs text-text-secondary font-mono">{job.id}</p>
                  </div>
                  <StatusBadge status={job.status} />
                </div>

                <div className="rounded-lg border border-border bg-background p-1">
                  <InfoRow label="Topic">{job.topic}</InfoRow>
                  <InfoRow label="Style">{job.style}</InfoRow>
                  <InfoRow label="Language">{job.language}</InfoRow>
                  <InfoRow label="Duration">{job.durationSeconds}s</InfoRow>
                  <InfoRow label="Created">{new Date(job.createdAt).toLocaleString()}</InfoRow>
                  {job.lastError && (
                    <InfoRow label="Last Error">
                      <span className="text-error">{job.lastError}</span>
                    </InfoRow>
                  )}
                </div>

                <Link
                  to={jobDetailsRoute(job.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-accent hover:text-accent"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View Full Job Details
                </Link>
              </CardContent>
            </Card>

            {/* Quality Report */}
            {job.qualityReport ? (
              <Card>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-text-primary">Quality Control Report</h3>
                    <QualityBadge score={job.qualityReport.score} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(
                      [
                        "video",
                        "audio",
                        "captions",
                        "visuals",
                        "sync",
                        "metadata",
                        "content",
                        "license",
                      ] as const
                    ).map((cat) => {
                      const result = job.qualityReport![cat as keyof typeof job.qualityReport];
                      if (!result || typeof result !== "object" || !("status" in result)) return null;
                      const r = result as { status: string };
                      return (
                        <div
                          key={cat}
                          className={`rounded-lg border p-2 text-center text-xs font-medium capitalize ${
                            r.status === "PASS"
                              ? "border-success/30 bg-success/10 text-success"
                              : r.status === "WARN"
                              ? "border-warning/30 bg-warning/10 text-warning"
                              : "border-error/30 bg-error/10 text-error"
                          }`}
                        >
                          {cat}
                          <div className="mt-0.5 text-[10px] opacity-70">{r.status}</div>
                        </div>
                      );
                    })}
                  </div>

                  {job.qualityReport.failures.length > 0 && (
                    <div className="rounded-lg border border-error/20 bg-error/5 p-3 space-y-1.5">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-error">
                        <AlertTriangle className="h-3.5 w-3.5" /> Failures
                      </p>
                      {job.qualityReport.failures.map((f, i) => (
                        <p key={i} className="text-xs text-text-secondary">
                          • {f.message}
                        </p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </div>

          {/* Sidebar: Approval + YouTube */}
          <div className="space-y-6">
            {/* Approval status */}
            <Card>
              <CardContent className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-bold text-text-primary">
                  <Send className="h-4 w-4" /> Telegram Approval
                </h3>
                {job.approval ? (
                  <div className="space-y-2">
                    <InfoRow label="Status">
                      <StatusBadge status={job.approval.status} />
                    </InfoRow>
                    {job.approval.sentAt && (
                      <InfoRow label="Sent">{new Date(job.approval.sentAt).toLocaleString()}</InfoRow>
                    )}
                    {job.approval.decidedAt && (
                      <InfoRow label="Decided">{new Date(job.approval.decidedAt).toLocaleString()}</InfoRow>
                    )}
                    {job.approval.reason && <InfoRow label="Reason">{job.approval.reason}</InfoRow>}
                  </div>
                ) : (
                  <p className="text-xs text-text-secondary">No approval sent yet.</p>
                )}
              </CardContent>
            </Card>

            {/* YouTube status */}
            <Card>
              <CardContent className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-bold text-text-primary">
                  <Video className="h-4 w-4" /> YouTube
                </h3>
                {job.youtube?.url ? (
                  <div className="space-y-2">
                    <InfoRow label="Status">
                      <span className="text-success font-bold">Published</span>
                    </InfoRow>
                    <InfoRow label="Video ID">{job.youtube.videoId}</InfoRow>
                    <a
                      href={job.youtube.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/20"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Watch on YouTube
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-text-secondary">Not yet uploaded.</p>
                )}
              </CardContent>
            </Card>

            {/* Quick links */}
            <Card>
              <CardContent className="space-y-2">
                <h3 className="text-sm font-bold text-text-primary">Quick Links</h3>
                <Link
                  to={ROUTES.scheduler}
                  className="block rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary transition hover:border-accent hover:text-accent"
                >
                  ⚙️ Scheduler Settings
                </Link>
                <Link
                  to={ROUTES.telegram}
                  className="block rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary transition hover:border-accent hover:text-accent"
                >
                  💬 Telegram Config
                </Link>
                <Link
                  to={ROUTES.queue}
                  className="block rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary transition hover:border-accent hover:text-accent"
                >
                  📋 All Jobs Queue
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
