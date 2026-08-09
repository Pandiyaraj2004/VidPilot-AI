import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { useToast } from "@/hooks/useToast";
import { telegramService } from "@/services/telegram/telegramService";

export default function TelegramPage() {
  const { showToast } = useToast();

  async function handleConnect() {
    try {
      await telegramService.connect();
    } catch (error) {
      showToast({
        variant: "info",
        title: "Telegram integration coming in Phase 7",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Telegram Approval" description="Approve or reject rendered videos from your phone before they publish." />

      <Card>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary">Status</span>
            <StatusIndicator tone="neutral" label="Not Connected" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Bot</span>
            <span className="text-text-primary">Not configured</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Chat</span>
            <span className="text-text-primary">Not configured</span>
          </div>
          <Button variant="secondary" onClick={handleConnect}>
            Connect Telegram
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
