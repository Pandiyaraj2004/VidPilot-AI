import { ApprovalNotRequested, ApprovalStatusCard } from "@/components/jobs/ApprovalStatusCard";
import { JobStatusBadge } from "@/components/common/JobStatusBadge";
import { PipelinePreview } from "@/components/jobs/PipelinePreview";
import { ScriptGenerationStatus } from "@/components/jobs/ScriptGenerationStatus";
import { ScriptPreview } from "@/components/jobs/ScriptPreview";
import { QualityCheckPending, QualityReportCard, RunQualityCheckButton } from "@/components/jobs/QualityReportCard";
import { VideoPlayer } from "@/components/jobs/VideoPlayer";
import { VideoRenderStatus } from "@/components/jobs/VideoRenderStatus";
import { VoiceGenerationStatus } from "@/components/jobs/VoiceGenerationStatus";
import { VoiceScenesList } from "@/components/jobs/VoiceScenesList";
import { YoutubePublicationCard } from "@/components/jobs/YoutubePublicationCard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageLoader } from "@/components/ui/LoadingState";
import { Textarea } from "@/components/ui/Textarea";
import { ROUTES } from "@/constants/routes";
import { useJob } from "@/hooks/useJob";
import { useToast } from "@/hooks/useToast";
import { jobVideoUrl } from "@/services/jobs/jobRepository";
import {
  cancelJob,
  generateScript,
  generateVoice,
  regenerateScript,
  regenerateSceneVisual,
  regenerateSceneVoice,
  regenerateVoice,
  renderVideo,
  retryJob,
  runQualityCheck,
  sendApprovalRequest,
  uploadToYoutube,
} from "@/services/jobs/jobService";
import { AI_PROVIDER_LABELS, VIDEO_STYLE_LABELS, VISUAL_STYLE_LABELS, VOICE_PROVIDER_LABELS, type JobStatus } from "@/types";
import { formatDuration } from "@/utils/formatRelativeTime";
import { FileQuestion, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

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

const RENDERING_STATUSES = new Set<JobStatus>(["generating_visuals", "generating_subtitles", "rendering", "video_validation"]);

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 text-sm last:border-b-0">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}

export default function JobDetailsPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { job, loading, error, notFound, refetch } = useJob(jobId);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showRegenerateForm, setShowRegenerateForm] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [busySceneId, setBusySceneId] = useState<string | null>(null);
  const [busyVisualSceneId, setBusyVisualSceneId] = useState<string | null>(null);
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [isCheckingQuality, setIsCheckingQuality] = useState(false);
  const [isSendingApproval, setIsSendingApproval] = useState(false);
  const [isUploadingToYoutube, setIsUploadingToYoutube] = useState(false);
  const generationLockRef = useRef(false);
  const voiceLockRef = useRef(false);
  const renderLockRef = useRef(false);
  const qualityLockRef = useRef(false);
  const approvalLockRef = useRef(false);
  const youtubeUploadLockRef = useRef(false);

  if (loading) return <PageLoader label="Loading job…" />;

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          icon={FileQuestion}
          title="Job not found."
          description="This video job doesn't exist, or may have been removed."
          action={<Button onClick={() => navigate(ROUTES.queue)}>Back to Queue</Button>}
        />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState title="Unable to load this video job." description={error ?? undefined} onRetry={refetch} />
      </div>
    );
  }

  async function handleConfirmCancel() {
    if (!job) return;
    setBusy(true);
    try {
      await cancelJob(job.id);
      showToast({ variant: "success", title: "Job cancelled" });
      refetch();
    } catch (err) {
      showToast({ variant: "error", title: "Unable to cancel this job", description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
      setConfirmCancel(false);
    }
  }

  async function handleRetry() {
    if (!job) return;
    setBusy(true);
    try {
      await retryJob(job.id);
      showToast({ variant: "success", title: "Job re-queued" });
      refetch();
    } catch (err) {
      showToast({ variant: "error", title: "Unable to retry this job", description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate() {
    if (!job || generationLockRef.current) return;
    generationLockRef.current = true;
    setIsGenerating(true);
    try {
      await generateScript(job.id);
      showToast({ variant: "success", title: "Script ready" });
    } catch (err) {
      showToast({
        variant: "error",
        title: "We couldn't generate the script right now.",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      generationLockRef.current = false;
      setIsGenerating(false);
      refetch();
    }
  }

  async function handleRegenerate() {
    if (!job || generationLockRef.current) return;
    generationLockRef.current = true;
    setIsGenerating(true);
    try {
      await regenerateScript(job.id, instruction.trim() || undefined);
      showToast({ variant: "success", title: "Script regenerated" });
      setShowRegenerateForm(false);
      setInstruction("");
    } catch (err) {
      showToast({
        variant: "error",
        title: "We couldn't regenerate the script right now.",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      generationLockRef.current = false;
      setIsGenerating(false);
      refetch();
    }
  }

  async function handleGenerateVoice() {
    if (!job || voiceLockRef.current) return;
    voiceLockRef.current = true;
    setIsGeneratingVoice(true);
    try {
      const updated = await generateVoice(job.id);
      showToast(
        updated.status === "voice_ready"
          ? { variant: "success", title: "Voice ready" }
          : { variant: "error", title: "Voice generation failed", description: updated.lastError ?? undefined }
      );
    } catch (err) {
      showToast({
        variant: "error",
        title: "We couldn't generate the voice right now.",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      voiceLockRef.current = false;
      setIsGeneratingVoice(false);
      refetch();
    }
  }

  async function handleRegenerateVoice() {
    if (!job || voiceLockRef.current) return;
    voiceLockRef.current = true;
    setIsGeneratingVoice(true);
    try {
      const updated = await regenerateVoice(job.id);
      showToast(
        updated.status === "voice_ready"
          ? { variant: "success", title: "Voice regenerated" }
          : { variant: "error", title: "Voice generation failed", description: updated.lastError ?? undefined }
      );
    } catch (err) {
      showToast({
        variant: "error",
        title: "We couldn't regenerate the voice right now.",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      voiceLockRef.current = false;
      setIsGeneratingVoice(false);
      refetch();
    }
  }

  async function handleRegenerateScene(sceneId: string) {
    if (!job || busySceneId) return;
    setBusySceneId(sceneId);
    try {
      const updated = await regenerateSceneVoice(job.id, sceneId);
      const scene = updated.content?.scenes.find((s) => s.id === sceneId);
      if (scene?.audio?.status === "ready") {
        showToast({ variant: "success", title: "Scene voice regenerated" });
      } else {
        showToast({
          variant: "error",
          title: "Unable to regenerate this scene",
          description: scene?.audio?.error ?? updated.lastError ?? undefined,
        });
      }
    } catch (err) {
      showToast({
        variant: "error",
        title: "We couldn't regenerate this scene.",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusySceneId(null);
      refetch();
    }
  }

  async function handleRegenerateVisual(sceneId: string) {
    if (!job || busyVisualSceneId) return;
    setBusyVisualSceneId(sceneId);
    try {
      const updated = await regenerateSceneVisual(job.id, sceneId);
      const scene = updated.content?.scenes.find((s) => s.id === sceneId);
      if (scene?.visual?.status === "ready") {
        showToast({ variant: "success", title: "Scene visual regenerated" });
      } else {
        showToast({
          variant: "error",
          title: "Unable to regenerate this scene's visual",
          description: scene?.visual?.error ?? updated.lastError ?? undefined,
        });
      }
    } catch (err) {
      showToast({
        variant: "error",
        title: "We couldn't regenerate this scene's visual.",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusyVisualSceneId(null);
      refetch();
    }
  }

  async function handleRenderVideo() {
    if (!job || renderLockRef.current) return;
    renderLockRef.current = true;
    setIsRenderingVideo(true);
    try {
      const updated = await renderVideo(job.id);
      showToast(
        updated.status === "video_ready"
          ? { variant: "success", title: "Video ready" }
          : { variant: "error", title: "Video rendering failed", description: updated.lastError ?? undefined }
      );
    } catch (err) {
      showToast({
        variant: "error",
        title: "We couldn't render the video right now.",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      renderLockRef.current = false;
      setIsRenderingVideo(false);
      refetch();
    }
  }

  async function handleRunQualityCheck() {
    if (!job || qualityLockRef.current) return;
    qualityLockRef.current = true;
    setIsCheckingQuality(true);
    try {
      const updated = await runQualityCheck(job.id);
      showToast(
        updated.qualityReport?.status === "FAIL"
          ? { variant: "error", title: "Quality check failed", description: "See the quality report below for details." }
          : { variant: "success", title: `Quality check ${updated.qualityReport?.status ?? "complete"}` }
      );
    } catch (err) {
      showToast({
        variant: "error",
        title: "We couldn't run the quality check right now.",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      qualityLockRef.current = false;
      setIsCheckingQuality(false);
      refetch();
    }
  }

  async function handleSendApproval() {
    if (!job || approvalLockRef.current) return;
    approvalLockRef.current = true;
    setIsSendingApproval(true);
    try {
      await sendApprovalRequest(job.id);
      showToast({ variant: "success", title: "Sent to Telegram", description: "Check your Telegram for the video and Approve/Reject buttons." });
    } catch (err) {
      showToast({
        variant: "error",
        title: "We couldn't send this for Telegram approval.",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      approvalLockRef.current = false;
      setIsSendingApproval(false);
      refetch();
    }
  }

  async function handleUploadToYoutube() {
    if (!job || youtubeUploadLockRef.current) return;
    youtubeUploadLockRef.current = true;
    setIsUploadingToYoutube(true);
    try {
      const updated = await uploadToYoutube(job.id);
      showToast(
        updated.youtube?.status === "uploaded"
          ? { variant: "success", title: "Published to YouTube" }
          : { variant: "error", title: "YouTube upload failed", description: updated.youtube?.lastError ?? updated.lastError ?? undefined }
      );
    } catch (err) {
      showToast({
        variant: "error",
        title: "We couldn't upload this to YouTube right now.",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      youtubeUploadLockRef.current = false;
      setIsUploadingToYoutube(false);
      refetch();
    }
  }

  const generatingNow = isGenerating || job.status === "generating_script" || job.status === "regenerating";
  const hasContent = Boolean(job.content);
  const generatingVoiceNow = isGeneratingVoice || job.status === "generating_voice";
  // voiceGeneration/videoRender are only ever set once that stage has been attempted at
  // least once — so a FAILED job's furthest-set record tells us which stage failed.
  const scriptFailed = job.status === "failed" && !job.voiceGeneration;
  const voiceFailed = job.status === "failed" && Boolean(job.voiceGeneration) && !job.videoRender;
  // A render that actually finished (videoRender.status === "ready") but
  // then failed quality control is a QC failure, not a render failure —
  // distinguished so the two show different cards/actions below.
  const renderFailed = job.status === "failed" && Boolean(job.videoRender) && job.videoRender?.status !== "ready";
  const qualityFailed = job.status === "failed" && job.videoRender?.status === "ready" && Boolean(job.qualityReport);
  const hasVoiceAttempt = Boolean(job.content?.scenes.some((scene) => scene.audio));
  const voiceReady = job.voiceGeneration?.status === "ready";
  const renderingNow = isRenderingVideo || RENDERING_STATUSES.has(job.status);
  // Deliberately NOT gated on job.status === "video_ready": once quality
  // control runs, the job moves on to quality_check/ready/failed, but the
  // rendered video itself is still there and should stay visible/playable.
  const videoReady = job.videoRender?.status === "ready";
  const qualityCheckingNow = isCheckingQuality || job.status === "quality_check";

  // Mirrors the backend's real guard in uploadVideoForJob — shown here only
  // as a helpful inline reason; the backend re-checks all of this itself
  // and is the actual enforcement point.
  const alreadyPublished = job.youtube?.status === "uploaded";
  const canUploadToYoutube =
    !alreadyPublished &&
    job.approval?.status === "approved" &&
    job.approval.renderVersion === job.renderVersion &&
    job.qualityReport?.status === "PASS" &&
    videoReady;
  const youtubeIneligibleReason = alreadyPublished
    ? undefined
    : job.approval?.status !== "approved"
      ? "This job must be approved on Telegram before it can be uploaded."
      : job.approval.renderVersion !== job.renderVersion
        ? "The video was re-rendered after approval — send it for approval again."
        : job.qualityReport?.status !== "PASS"
          ? "This job's quality check must PASS (not just WARN) before uploading."
          : !videoReady
            ? "There is no rendered video to upload yet."
            : undefined;
  const showYoutubeCard = Boolean(job.youtube) || job.approval?.status === "approved";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-text-secondary">Video Job</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-text-primary">{job.topic}</h1>
          <JobStatusBadge status={job.status} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Input</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <SettingRow label="Topic" value={job.topic} />
          <SettingRow label="Script" value={job.inputScript ? job.inputScript : "Not provided"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <SettingRow label="Style" value={VIDEO_STYLE_LABELS[job.style]} />
          <SettingRow label="Duration" value={formatDuration(job.durationSeconds)} />
          <SettingRow label="Language" value={job.language.toUpperCase()} />
          <SettingRow label="Voice" value={`${job.voiceId || "Not selected"} (${job.voiceSpeed.toFixed(2)}x)`} />
          <SettingRow label="Visual Style" value={VISUAL_STYLE_LABELS[job.visualStyle]} />
          <SettingRow label="Subtitles" value={job.subtitlesEnabled ? "ON" : "OFF"} />
          <SettingRow label="Thumbnail" value={job.thumbnailEnabled ? "ON" : "OFF"} />
          <SettingRow label="Approval" value={job.approvalRequired ? "ON" : "OFF"} />
          <SettingRow
            label="YouTube"
            value={job.youtubeVisibility.charAt(0).toUpperCase() + job.youtubeVisibility.slice(1)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Script</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {scriptFailed && (
            <ErrorState
              title="Script generation failed."
              description={job.lastError ?? "An unexpected error occurred."}
            />
          )}

          {generatingNow && <ScriptGenerationStatus />}

          {!generatingNow && hasContent && job.content && (
            <>
              {job.scriptProvider && (
                <p className="text-xs text-text-muted">
                  Generated by {AI_PROVIDER_LABELS[job.scriptProvider]}
                  {job.scriptModel ? ` · ${job.scriptModel}` : ""}
                </p>
              )}
              <ScriptPreview content={job.content} />

              {!showRegenerateForm ? (
                <Button variant="secondary" disabled={isGenerating} onClick={() => setShowRegenerateForm(true)}>
                  Regenerate Script
                </Button>
              ) : (
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <div>
                    <label htmlFor="regen-instruction" className="mb-1.5 block text-sm font-medium text-text-primary">
                      What should change? <span className="text-text-muted">(optional)</span>
                    </label>
                    <Textarea
                      id="regen-instruction"
                      placeholder="Make the hook stronger…"
                      value={instruction}
                      onChange={(event) => setInstruction(event.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button onClick={handleRegenerate} loading={isGenerating} disabled={isGenerating}>
                      <Sparkles className="h-4 w-4" />
                      Regenerate
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={isGenerating}
                      onClick={() => {
                        setShowRegenerateForm(false);
                        setInstruction("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {!generatingNow && !hasContent && !scriptFailed && (
            <div>
              <p className="text-sm text-text-secondary">Waiting for AI generation.</p>
              {job.status === "queued" && (
                <Button className="mt-3" onClick={handleGenerate} loading={isGenerating} disabled={isGenerating}>
                  <Sparkles className="h-4 w-4" />
                  Generate Script
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {hasContent && job.content && (
        <Card>
          <CardHeader>
            <CardTitle>Voice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {voiceFailed && (
              <ErrorState
                title="Voice generation failed."
                description={job.lastError ?? "An unexpected error occurred."}
              />
            )}

            {generatingVoiceNow && <VoiceGenerationStatus sceneCount={job.content.scenes.length} />}

            {!generatingVoiceNow && hasVoiceAttempt && (
              <>
                {job.voiceGeneration?.provider && job.voiceGeneration.totalDurationSeconds != null && (
                  <p className="text-xs text-text-muted">
                    Generated by {VOICE_PROVIDER_LABELS[job.voiceGeneration.provider]} · total{" "}
                    {formatDuration(job.voiceGeneration.totalDurationSeconds)}
                  </p>
                )}
                <VoiceScenesList
                  jobId={job.id}
                  scenes={job.content.scenes}
                  busySceneId={busySceneId}
                  disabled={isGeneratingVoice}
                  onRegenerateScene={handleRegenerateScene}
                  onRegenerateVisual={handleRegenerateVisual}
                  busyVisualSceneId={busyVisualSceneId}
                />
                <Button variant="secondary" disabled={isGeneratingVoice} loading={isGeneratingVoice} onClick={handleRegenerateVoice}>
                  Regenerate All Voice
                </Button>
              </>
            )}

            {!generatingVoiceNow && !hasVoiceAttempt && (
              <div>
                <p className="text-sm text-text-secondary">Waiting for Voice Engine.</p>
                {job.status === "script_ready" && (
                  <Button className="mt-3" onClick={handleGenerateVoice} loading={isGeneratingVoice} disabled={isGeneratingVoice}>
                    <Sparkles className="h-4 w-4" />
                    Generate Voice
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(voiceReady || renderingNow || renderFailed || videoReady) && (
        <Card>
          <CardHeader>
            <CardTitle>Video</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderFailed && (
              <ErrorState title="Video rendering failed." description={job.lastError ?? "An unexpected error occurred."} />
            )}

            {renderingNow && <VideoRenderStatus status={job.status} />}

            {!renderingNow && videoReady && job.videoRender && (
              <>
                <VideoPlayer src={jobVideoUrl(job.id)} metadata={job.videoRender} />
                <Button variant="secondary" disabled={isRenderingVideo} loading={isRenderingVideo} onClick={handleRenderVideo}>
                  Regenerate Video
                </Button>
              </>
            )}

            {!renderingNow && !videoReady && (voiceReady || renderFailed) && (
              <div>
                <p className="text-sm text-text-secondary">Waiting for the Video Engine.</p>
                <Button className="mt-3" onClick={handleRenderVideo} loading={isRenderingVideo} disabled={isRenderingVideo}>
                  <Sparkles className="h-4 w-4" />
                  Generate Video
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(videoReady || qualityCheckingNow || qualityFailed || job.qualityReport) && (
        <Card>
          <CardHeader>
            <CardTitle>Quality Check</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {qualityCheckingNow && <QualityCheckPending />}

            {!qualityCheckingNow && job.qualityReport && (
              <>
                <QualityReportCard report={job.qualityReport} />
                <RunQualityCheckButton onClick={handleRunQualityCheck} loading={isCheckingQuality} />
              </>
            )}

            {!qualityCheckingNow && !job.qualityReport && videoReady && (
              <div>
                <p className="text-sm text-text-secondary">
                  Run a quality check before this video can be approved — it checks the actual rendered file's technical quality, audio,
                  captions, visuals, sync, and metadata.
                </p>
                <div className="mt-3">
                  <RunQualityCheckButton onClick={handleRunQualityCheck} loading={isCheckingQuality} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(job.approval || job.status === "ready") && (
        <Card>
          <CardHeader>
            <CardTitle>Approval</CardTitle>
          </CardHeader>
          <CardContent>
            {job.approval ? (
              <ApprovalStatusCard approval={job.approval} onSend={handleSendApproval} sending={isSendingApproval} />
            ) : (
              <ApprovalNotRequested onSend={handleSendApproval} sending={isSendingApproval} />
            )}
          </CardContent>
        </Card>
      )}

      {showYoutubeCard && (
        <Card>
          <CardHeader>
            <CardTitle>Publish</CardTitle>
          </CardHeader>
          <CardContent>
            <YoutubePublicationCard
              youtube={job.youtube}
              eligible={canUploadToYoutube}
              ineligibleReason={youtubeIneligibleReason}
              onUpload={handleUploadToYoutube}
              uploading={isUploadingToYoutube}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <PipelinePreview
            status={job.status}
            scriptProvider={job.scriptProvider}
            voiceProvider={job.voiceGeneration?.provider}
            renderTemplate={job.renderTemplate}
            qualityReport={job.qualityReport}
            approval={job.approval}
            youtube={job.youtube}
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        {CANCELLABLE.has(job.status) && (
          <Button variant="secondary" disabled={busy || isGenerating || isGeneratingVoice} onClick={() => setConfirmCancel(true)}>
            Cancel
          </Button>
        )}
        {job.status === "failed" && (
          <Button variant="secondary" disabled={busy} onClick={handleRetry}>
            Retry
          </Button>
        )}
        <Button variant="ghost" onClick={() => navigate(ROUTES.queue)}>
          Back to Queue
        </Button>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this video job?"
        description="This job will not be processed."
        confirmLabel="Cancel Job"
        cancelLabel="Keep Job"
        destructive
        onConfirm={handleConfirmCancel}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
}
