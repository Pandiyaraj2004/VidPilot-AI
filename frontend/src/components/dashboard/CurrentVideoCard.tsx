import { JobStatusBadge } from "@/components/common/JobStatusBadge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonCard } from "@/components/ui/LoadingState";
import { jobDetailsRoute, ROUTES } from "@/constants/routes";
import type { VideoJob } from "@/types";
import { Film } from "lucide-react";
import { useNavigate } from "react-router-dom";

export interface CurrentVideoCardProps {
  job: VideoJob | null;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function CurrentVideoCard({ job, loading, error, onRetry }: CurrentVideoCardProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest Job</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <SkeletonCard />
        ) : error ? (
          <ErrorState title="Unable to load the latest job." description={error} onRetry={onRetry} />
        ) : job ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-text-primary">{job.topic}</p>
              <div className="mt-1">
                <JobStatusBadge status={job.status} />
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => navigate(jobDetailsRoute(job.id))}>
              View Details
            </Button>
          </div>
        ) : (
          <EmptyState
            icon={Film}
            title="No videos yet."
            description="Create your first AI video and it will appear here."
            action={<Button size="sm" onClick={() => navigate(ROUTES.create)}>Create Video</Button>}
          />
        )}
      </CardContent>
    </Card>
  );
}
