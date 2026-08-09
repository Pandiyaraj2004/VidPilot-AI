import { AutomationCard } from "@/components/dashboard/AutomationCard";
import { CurrentVideoCard } from "@/components/dashboard/CurrentVideoCard";
import { RecentJobsCard } from "@/components/dashboard/RecentJobsCard";
import { SystemStatusCard } from "@/components/dashboard/SystemStatusCard";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { ROUTES } from "@/constants/routes";
import { Eye, Film, Plus, ThumbsUp, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const navigate = useNavigate();

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Videos Created" value="—" icon={Video} />
        <StatCard label="Awaiting Approval" value="—" icon={Film} />
        <StatCard label="Published" value="—" icon={ThumbsUp} />
        <StatCard label="Total Views" value="—" icon={Eye} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <CurrentVideoCard />
          <RecentJobsCard />
        </div>
        <div className="space-y-4">
          <SystemStatusCard />
          <AutomationCard />
        </div>
      </div>
    </div>
  );
}
