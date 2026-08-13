import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ROUTES } from "@/constants/routes";
import { useNavigate } from "react-router-dom";
import { useSystemStatus } from "@/hooks/useSystemStatus";

export function AutomationCard() {
  const navigate = useNavigate();
  const { status, reachable } = useSystemStatus();
  const sched = status?.schedulerState;

  const getPipelineStatus = () => {
    if (!sched) return "Unknown";
    if (sched.currentlyProcessing && sched.currentlyProcessing.length > 0) {
      return "Running (Processing)";
    }
    if (sched.waitingForApprovalCount > 0) {
      return "Waiting Approval";
    }
    if (sched.approvedWaitingToUploadCount > 0) {
      return "Uploading";
    }
    return "Idle / Standby";
  };

  const formatTime = (isoString: string | null, timezone?: string) => {
    if (!isoString) return "Not scheduled";
    try {
      const options: Intl.DateTimeFormatOptions = {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      };
      if (timezone && timezone !== "UTC") {
        options.timeZone = timezone;
      }
      return new Date(isoString).toLocaleTimeString([], options) + (timezone ? ` (${timezone})` : "");
    } catch {
      return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  };

  const isEnabled = reachable && sched?.automationEnabled;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automation Engine</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-text-secondary">
          {isEnabled
            ? `The scheduler is running in the background. It will automatically generate and process new videos every ${sched.intervalHours} hours.`
            : "The background video scheduler is currently disabled. Enable it to begin automatic video production slots."}
        </p>
        
        <div className="grid grid-cols-2 gap-3 text-sm border-t border-border pt-3">
          <div>
            <p className="text-text-secondary">Status</p>
            <p className={`mt-0.5 font-bold uppercase text-xs ${isEnabled ? "text-success animate-pulse" : "text-text-secondary"}`}>
              {isEnabled ? "Enabled" : "Disabled"}
            </p>
          </div>
          <div>
            <p className="text-text-secondary">Next generation</p>
            <p className="mt-0.5 font-medium text-text-primary">
              {isEnabled ? formatTime(sched.nextGenerationAt, sched.timezone) : "Not scheduled"}
            </p>
          </div>
          <div>
            <p className="text-text-secondary">Interval</p>
            <p className="mt-0.5 font-medium text-text-primary">
              {sched ? `Every ${sched.intervalHours} hours` : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-text-secondary">Timezone</p>
            <p className="mt-0.5 font-medium text-text-primary">
              {sched?.timezone || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-text-secondary">Approval Mode</p>
            <p className="mt-0.5 font-medium text-text-primary">
              {sched ? (sched.requireApproval ? "Telegram Required" : "Auto Upload") : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-text-secondary">Current Pipeline</p>
            <p className="mt-0.5 font-medium text-accent">
              {isEnabled ? getPipelineStatus() : "Inactive"}
            </p>
          </div>
        </div>

        <Button variant="secondary" size="sm" onClick={() => navigate(ROUTES.scheduler)} className="w-full mt-2">
          Configure Scheduler
        </Button>
      </CardContent>
    </Card>
  );
}
