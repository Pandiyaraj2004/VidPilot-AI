import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusIndicator, type StatusTone } from "@/components/ui/StatusIndicator";
import { useSystemStatus } from "@/hooks/useSystemStatus";

interface StatusRow {
  label: string;
  tone: StatusTone;
  text: string;
}

function connectionRow(label: string, connected: boolean, reachable: boolean): StatusRow {
  if (!reachable) return { label, tone: "neutral", text: "Unknown" };
  return connected ? { label, tone: "success", text: "Connected" } : { label, tone: "neutral", text: "Not Connected" };
}

export function SystemStatusCard() {
  const { status, reachable } = useSystemStatus();

  const rows: StatusRow[] = [
    { label: "VidPilot", tone: "success", text: "Operational" },
    reachable
      ? connectionRow("Database", status?.database === "connected", true)
      : { label: "Database", tone: "neutral", text: "Backend not reachable" },
    { label: "Automation", tone: "neutral", text: "Not active" },
    connectionRow("Telegram", status?.telegram === "connected", reachable),
    connectionRow("YouTube", status?.youtube === "connected", reachable),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">{row.label}</span>
            <StatusIndicator tone={row.tone} label={row.text} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
