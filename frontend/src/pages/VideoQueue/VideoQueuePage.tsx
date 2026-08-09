import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { ListVideo, Search } from "lucide-react";
import { useState } from "react";

type QueueFilter = "all" | "queued" | "generating" | "rendering" | "awaiting_approval" | "approved" | "published" | "failed";

const FILTERS: { value: QueueFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "queued", label: "Queued" },
  { value: "generating", label: "Generating" },
  { value: "rendering", label: "Rendering" },
  { value: "awaiting_approval", label: "Awaiting Approval" },
  { value: "approved", label: "Approved" },
  { value: "published", label: "Published" },
  { value: "failed", label: "Failed" },
];

export default function VideoQueuePage() {
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [search, setSearch] = useState("");

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
                placeholder="Search videos…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <EmptyState icon={ListVideo} title="No video jobs found." />
        </CardContent>
      </Card>
    </div>
  );
}
