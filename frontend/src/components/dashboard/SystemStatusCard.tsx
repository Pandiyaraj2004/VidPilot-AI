import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusIndicator, type StatusTone } from "@/components/ui/StatusIndicator";

interface StatusRow {
  label: string;
  tone: StatusTone;
  text: string;
}

const ROWS: StatusRow[] = [
  { label: "VidPilot", tone: "success", text: "Operational" },
  { label: "Database", tone: "neutral", text: "Not connected" },
  { label: "Automation", tone: "neutral", text: "Not configured" },
  { label: "Telegram", tone: "neutral", text: "Not Connected" },
  { label: "YouTube", tone: "neutral", text: "Not Connected" },
];

export function SystemStatusCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {ROWS.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">{row.label}</span>
            <StatusIndicator tone={row.tone} label={row.text} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
