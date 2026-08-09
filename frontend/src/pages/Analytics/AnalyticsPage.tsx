import { PageHeader } from "@/components/common/PageHeader";
import { ChartPlaceholder } from "@/components/common/ChartPlaceholder";
import { StatCard } from "@/components/ui/StatCard";
import { Eye, MessageCircle, ThumbsUp, TrendingUp, Users } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="YouTube Analytics" description="Analytics will appear here once your YouTube channel is connected." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Views" value="—" icon={Eye} />
        <StatCard label="Likes" value="—" icon={ThumbsUp} />
        <StatCard label="Comments" value="—" icon={MessageCircle} />
        <StatCard label="Watch Time" value="—" icon={TrendingUp} />
        <StatCard label="Subscribers" value="—" icon={Users} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartPlaceholder title="Views Over Time" />
        <ChartPlaceholder title="Watch Time" />
        <ChartPlaceholder title="Subscriber Growth" />
        <ChartPlaceholder title="Video Performance" />
      </div>
    </div>
  );
}
