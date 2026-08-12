import { JobsTable } from "@/components/jobs/JobsTable";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonTable } from "@/components/ui/LoadingState";
import { ROUTES } from "@/constants/routes";
import type { VideoJob } from "@/types";
import { ListVideo } from "lucide-react";
import { useNavigate } from "react-router-dom";

const RECENT_LIMIT = 5;

export interface RecentJobsCardProps {
  jobs: VideoJob[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onChanged: () => void;
}

export function RecentJobsCard({ jobs, loading, error, onRetry, onChanged }: RecentJobsCardProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Jobs</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && <SkeletonTable rows={3} />}
        {!loading && error && <ErrorState title="Unable to load recent jobs." description={error} onRetry={onRetry} />}
        {!loading && !error && jobs.length === 0 && (
          <EmptyState
            icon={ListVideo}
            title="No video jobs yet."
            action={<Button size="sm" onClick={() => navigate(ROUTES.create)}>Create Video</Button>}
          />
        )}
        {!loading && !error && jobs.length > 0 && (
          <JobsTable jobs={jobs.slice(0, RECENT_LIMIT)} onChanged={onChanged} />
        )}
      </CardContent>
    </Card>
  );
}
