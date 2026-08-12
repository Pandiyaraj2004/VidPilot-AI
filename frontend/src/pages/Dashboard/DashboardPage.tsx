import { PageHeader } from "@/components/common/PageHeader";
import { AutomationCard } from "@/components/dashboard/AutomationCard";
import { CurrentVideoCard } from "@/components/dashboard/CurrentVideoCard";
import { RecentJobsCard } from "@/components/dashboard/RecentJobsCard";
import { SystemStatusCard } from "@/components/dashboard/SystemStatusCard";
import { WorkflowSummaryCard } from "@/components/dashboard/WorkflowSummaryCard";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { ROUTES } from "@/constants/routes";
import { useJobs } from "@/hooks/useJobs";
import { getJobStatusGroup } from "@/types";
import { AlertTriangle, CheckCircle2, Clapperboard, Clock, Film, ListVideo, Mic, Plus, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { jobs, loading, error, refetch } = useJobs();

  const counts = useMemo(() => {
    const result = {
      total: jobs.length,
      queued: 0,
      generatingScript: 0,
      scriptReady: 0,
      generatingVoice: 0,
      voiceReady: 0,
      rendering: 0,
      videoReady: 0,
      failed: 0,
    };
    const RENDERING_STATUSES = new Set(["generating_visuals", "generating_subtitles", "rendering", "video_validation"]);
    for (const job of jobs) {
      if (job.status === "generating_script" || job.status === "regenerating") result.generatingScript += 1;
      else if (job.status === "script_ready") result.scriptReady += 1;
      else if (job.status === "generating_voice") result.generatingVoice += 1;
      else if (job.status === "voice_ready") result.voiceReady += 1;
      else if (RENDERING_STATUSES.has(job.status)) result.rendering += 1;
      else if (job.status === "video_ready") result.videoReady += 1;
      else if (getJobStatusGroup(job.status) === "queued") result.queued += 1;
      else if (getJobStatusGroup(job.status) === "failed") result.failed += 1;
    }
    return result;
  }, [jobs]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={getGreeting()}
        description="Your VidPilot workspace"
        actions={
          <Button onClick={() => navigate(ROUTES.create)}>
            <Plus className="h-4 w-4" />
            Create Video
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-9">
        <StatCard label="Total Jobs" value={loading || error ? "—" : counts.total} icon={ListVideo} />
        <StatCard label="Queued" value={loading || error ? "—" : counts.queued} icon={Clock} />
        <StatCard label="Generating Script" value={loading || error ? "—" : counts.generatingScript} icon={Sparkles} />
        <StatCard label="Script Ready" value={loading || error ? "—" : counts.scriptReady} icon={CheckCircle2} />
        <StatCard label="Generating Voice" value={loading || error ? "—" : counts.generatingVoice} icon={Mic} />
        <StatCard label="Voice Ready" value={loading || error ? "—" : counts.voiceReady} icon={CheckCircle2} />
        <StatCard label="Rendering" value={loading || error ? "—" : counts.rendering} icon={Clapperboard} />
        <StatCard label="Video Ready" value={loading || error ? "—" : counts.videoReady} icon={Film} />
        <StatCard label="Failed" value={loading || error ? "—" : counts.failed} icon={AlertTriangle} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <CurrentVideoCard job={jobs[0] ?? null} loading={loading} error={error} onRetry={refetch} />
          <RecentJobsCard jobs={jobs} loading={loading} error={error} onRetry={refetch} onChanged={refetch} />
        </div>
        <div className="space-y-4">
          <SystemStatusCard />
          <WorkflowSummaryCard />
          <AutomationCard />
        </div>
      </div>
    </div>
  );
}
