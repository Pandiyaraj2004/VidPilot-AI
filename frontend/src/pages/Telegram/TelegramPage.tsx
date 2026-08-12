import { FlowDiagram, type FlowStep } from "@/components/common/FlowDiagram";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { useSystemStatus } from "@/hooks/useSystemStatus";

const TELEGRAM_FLOW: FlowStep[] = [
  { label: "Generated Video", tone: "automatic" },
  { label: "Quality Check", tone: "automatic" },
  { label: "Telegram", tone: "automatic" },
  { label: "You watch", tone: "manual" },
  { label: "Approve / Reject", tone: "manual" },
];

export default function TelegramPage() {
  const { status } = useSystemStatus();
  const connected = status?.telegram === "connected";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Telegram Approval" description="Approve or reject rendered videos from your phone before they publish." />

      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
        </CardHeader>
        <CardContent>
          <FlowDiagram steps={TELEGRAM_FLOW} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary">Status</span>
            {connected ? (
              <StatusIndicator tone="success" label="Connected" />
            ) : (
              <StatusIndicator tone="neutral" label="Not Connected" />
            )}
          </div>
          <p className="text-sm text-text-secondary">
            {connected
              ? "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are configured. When a job passes quality control, use its \"Send for Telegram Approval\" button on the Job Details page — the video and Approve/Reject buttons will arrive in this chat."
              : "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in the backend's .env to enable this (see the README's Telegram setup section). There's no in-app connect flow — a bot is configured entirely via those two values."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
