import { PageHeader } from "@/components/common/PageHeader";
import { JobsTable } from "@/components/jobs/JobsTable";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { SkeletonTable } from "@/components/ui/LoadingState";
import { Tabs } from "@/components/ui/Tabs";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useJobs } from "@/hooks/useJobs";
import { ROUTES } from "@/constants/routes";
import { getJobStatusGroup, type JobStatusGroup } from "@/types";
import { ListVideo, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type QueueFilter = "all" | JobStatusGroup;

const FILTERS: { value: QueueFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "queued", label: "Queued" },
  { value: "processing", label: "Processing" },
  { value: "awaiting_approval", label: "Awaiting Approval" },
  { value: "published", label: "Published" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function VideoQueuePage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);

  // Filtering happens client-side over the full (capped) job list — the
  // queue's status groups don't map 1:1 to a single backend JobStatus value,
  // so a per-group server query isn't a good fit here (see JobStatusGroup).
  const { jobs, loading, error, refetch } = useJobs();

  const filteredJobs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return jobs.filter((job) => {
      if (filter !== "all" && getJobStatusGroup(job.status) !== filter) return false;
      if (term && !job.topic.toLowerCase().includes(term) && !job.id.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [jobs, filter, search]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Video Queue" description="Track every job from topic to publish." />

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs items={FILTERS} value={filter} onChange={(value) => setFilter(value as QueueFilter)} className="overflow-x-auto" />
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                placeholder="Search by topic or job ID…"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {loading && <SkeletonTable rows={4} />}

          {!loading && error && <ErrorState title="Unable to load video jobs." description={error} onRetry={refetch} />}

          {!loading && !error && filteredJobs.length === 0 && jobs.length === 0 && (
            <EmptyState
              icon={ListVideo}
              title="No video jobs yet."
              description="Create your first video to start your VidPilot pipeline."
              action={<Button onClick={() => navigate(ROUTES.create)}>Create Video</Button>}
            />
          )}

          {!loading && !error && filteredJobs.length === 0 && jobs.length > 0 && (
            <EmptyState icon={ListVideo} title="No video jobs found." description="Try a different filter or search term." />
          )}

          {!loading && !error && filteredJobs.length > 0 && <JobsTable jobs={filteredJobs} onChanged={refetch} />}
        </CardContent>
      </Card>
    </div>
  );
}
