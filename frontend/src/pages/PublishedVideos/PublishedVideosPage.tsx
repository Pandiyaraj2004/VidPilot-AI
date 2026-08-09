import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Upload } from "lucide-react";

export default function PublishedVideosPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Published Videos" description="Everything VidPilot has uploaded to YouTube." />

      <Card>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Video</TableHeaderCell>
                <TableHeaderCell>Title</TableHeaderCell>
                <TableHeaderCell>Published</TableHeaderCell>
                <TableHeaderCell>Views</TableHeaderCell>
                <TableHeaderCell>Likes</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </TableRow>
            </TableHead>
          </Table>
          <EmptyState icon={Upload} title="No published videos yet." description="Videos will appear here once YouTube is connected and a job is published." />
        </CardContent>
      </Card>
    </div>
  );
}
