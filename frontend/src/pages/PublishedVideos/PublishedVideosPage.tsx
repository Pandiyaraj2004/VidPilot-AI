import { FlowDiagram, type FlowStep } from "@/components/common/FlowDiagram";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageLoader } from "@/components/ui/LoadingState";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { useJobs } from "@/hooks/useJobs";
import { jobDetailsRoute } from "@/constants/routes";
import { ExternalLink, Upload } from "lucide-react";
import { Link } from "react-router-dom";

const PUBLISHING_FLOW: FlowStep[] = [
  { label: "Approved", tone: "manual", status: "done" },
  { label: "YouTube Upload", tone: "automatic", status: "done" },
  { label: "Published", tone: "automatic", status: "done" },
  { label: "Analytics", tone: "automatic", status: "waiting", hint: "Coming in a later phase" },
];

export default function PublishedVideosPage() {
  const { jobs, loading, error, refetch } = useJobs({ status: "published" });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Published Videos" description="Everything VidPilot has actually uploaded to YouTube." />

      <Card>
        <CardHeader>
          <CardTitle>How publishing works</CardTitle>
        </CardHeader>
        <CardContent>
          <FlowDiagram steps={PUBLISHING_FLOW} />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {loading && <PageLoader label="Loading published videos…" />}

          {!loading && error && <ErrorState title="Unable to load published videos." description={error} onRetry={refetch} />}

          {!loading && !error && jobs.length === 0 && (
            <EmptyState
              icon={Upload}
              title="No published videos yet."
              description="Videos appear here once YouTube is connected and a job has been uploaded."
            />
          )}

          {!loading && !error && jobs.length > 0 && (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Title</TableHeaderCell>
                  <TableHeaderCell>Published</TableHeaderCell>
                  <TableHeaderCell>Privacy</TableHeaderCell>
                  <TableHeaderCell>Video ID</TableHeaderCell>
                  <TableHeaderCell>Link</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Link to={jobDetailsRoute(job.id)} className="font-medium hover:underline">
                        {job.content?.title ?? job.topic}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {job.youtube?.uploadedAt ? new Date(job.youtube.uploadedAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={job.youtube?.privacyStatus === "public" ? "success" : "neutral"}>
                        {job.youtube?.privacyStatus ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{job.youtube?.videoId ?? "—"}</TableCell>
                    <TableCell>
                      {job.youtube?.url && (
                        <a
                          href={job.youtube.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Watch
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
