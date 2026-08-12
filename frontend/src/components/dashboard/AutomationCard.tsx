import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ROUTES } from "@/constants/routes";
import { useNavigate } from "react-router-dom";

export function AutomationCard() {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automation Engine</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-text-secondary">
          Not active yet. The scheduler will automatically create video jobs on your configured interval in a future phase.
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-text-secondary">Status</p>
            <p className="mt-0.5 font-medium text-text-primary">Not active</p>
          </div>
          <div>
            <p className="text-text-secondary">Next generation</p>
            <p className="mt-0.5 font-medium text-text-primary">Not scheduled</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate(ROUTES.scheduler)}>
          Configure Scheduler
        </Button>
      </CardContent>
    </Card>
  );
}
