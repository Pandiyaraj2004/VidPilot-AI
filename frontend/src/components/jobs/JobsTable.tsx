import { JobStatusBadge } from "@/components/common/JobStatusBadge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { jobDetailsRoute } from "@/constants/routes";
import { useToast } from "@/hooks/useToast";
import { cancelJob, generateScript, generateVoice, retryJob } from "@/services/jobs/jobService";
import { VIDEO_STYLE_LABELS, type VideoJob } from "@/types";
import { formatDuration, formatRelativeTime } from "@/utils/formatRelativeTime";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const CANCELLABLE = new Set([
  "draft",
  "queued",
  "generating_script",
  "script_ready",
  "script_review",
  "generating_voice",
  "voice_ready",
  "generating_visuals",
  "generating_subtitles",
  "rendering",
  "video_validation",
  "generating_thumbnail",
  "quality_check",
  "ready",
  "awaiting_approval",
  "regenerating",
]);

export interface JobsTableProps {
  jobs: VideoJob[];
  onChanged?: () => void;
}

export function JobsTable({ jobs, onChanged }: JobsTableProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [cancelTarget, setCancelTarget] = useState<VideoJob | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleConfirmCancel() {
    if (!cancelTarget) return;
    setBusyId(cancelTarget.id);
    try {
      await cancelJob(cancelTarget.id);
      showToast({ variant: "success", title: "Job cancelled" });
      onChanged?.();
    } catch (error) {
      showToast({
        variant: "error",
        title: "Unable to cancel this job",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusyId(null);
      setCancelTarget(null);
    }
  }

  async function handleRetry(job: VideoJob) {
    setBusyId(job.id);
    try {
      await retryJob(job.id);
      showToast({ variant: "success", title: "Job re-queued" });
      onChanged?.();
    } catch (error) {
      showToast({
        variant: "error",
        title: "Unable to retry this job",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleGenerate(job: VideoJob) {
    setBusyId(job.id);
    try {
      await generateScript(job.id);
      showToast({ variant: "success", title: "Script ready" });
      onChanged?.();
    } catch (error) {
      showToast({
        variant: "error",
        title: "We couldn't generate the script right now.",
        description: error instanceof Error ? error.message : undefined,
      });
      onChanged?.();
    } finally {
      setBusyId(null);
    }
  }

  async function handleGenerateVoice(job: VideoJob) {
    setBusyId(job.id);
    try {
      const updated = await generateVoice(job.id);
      showToast(
        updated.status === "voice_ready"
          ? { variant: "success", title: "Voice ready" }
          : { variant: "error", title: "Voice generation failed", description: updated.lastError ?? undefined }
      );
      onChanged?.();
    } catch (error) {
      showToast({
        variant: "error",
        title: "We couldn't generate the voice right now.",
        description: error instanceof Error ? error.message : undefined,
      });
      onChanged?.();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Topic</TableHeaderCell>
            <TableHeaderCell>Style</TableHeaderCell>
            <TableHeaderCell>Duration</TableHeaderCell>
            <TableHeaderCell>Created</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Actions</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell>
                <button
                  type="button"
                  onClick={() => navigate(jobDetailsRoute(job.id))}
                  className="text-left font-medium text-text-primary hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                >
                  {job.topic}
                </button>
              </TableCell>
              <TableCell className="text-text-secondary">{VIDEO_STYLE_LABELS[job.style]}</TableCell>
              <TableCell className="text-text-secondary">{formatDuration(job.durationSeconds)}</TableCell>
              <TableCell className="text-text-secondary">{formatRelativeTime(job.createdAt)}</TableCell>
              <TableCell>
                <JobStatusBadge status={job.status} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {CANCELLABLE.has(job.status) && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busyId === job.id}
                      onClick={() => setCancelTarget(job)}
                    >
                      Cancel
                    </Button>
                  )}
                  {job.status === "failed" && (
                    <Button variant="secondary" size="sm" disabled={busyId === job.id} onClick={() => handleRetry(job)}>
                      Retry
                    </Button>
                  )}
                  {job.status === "queued" && (
                    <Button
                      size="sm"
                      loading={busyId === job.id}
                      disabled={busyId === job.id}
                      onClick={() => handleGenerate(job)}
                    >
                      Generate Script
                    </Button>
                  )}
                  {job.status === "script_ready" && (
                    <Button
                      size="sm"
                      loading={busyId === job.id}
                      disabled={busyId === job.id}
                      onClick={() => handleGenerateVoice(job)}
                    >
                      Generate Voice
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => navigate(jobDetailsRoute(job.id))}>
                    View Details
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancel this video job?"
        description="This job will not be processed."
        confirmLabel="Cancel Job"
        cancelLabel="Keep Job"
        destructive
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </>
  );
}
