import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/hooks/useToast";
import { getSchedulerConfig, saveSchedulerConfig } from "@/services/scheduler/schedulerConfigService";
import { VIDEO_STYLES, type SchedulerConfig, type YouTubeVisibility } from "@/types";
import { useState } from "react";

const DURATION_OPTIONS = [
  { value: 60, label: "60 seconds" },
  { value: 180, label: "3 minutes" },
  { value: 300, label: "5 minutes" },
  { value: 600, label: "10 minutes" },
];

const VISIBILITY_OPTIONS: { value: YouTubeVisibility; label: string }[] = [
  { value: "private", label: "Private" },
  { value: "unlisted", label: "Unlisted" },
  { value: "public", label: "Public" },
];

export default function SchedulerPage() {
  const { showToast } = useToast();
  const [config, setConfig] = useState<SchedulerConfig>(() => getSchedulerConfig());

  function update<K extends keyof SchedulerConfig>(key: K, value: SchedulerConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function handleSave() {
    saveSchedulerConfig(config);
    showToast({ variant: "success", title: "Scheduler settings saved" });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Scheduler"
        description="Automation isn't running yet — this configures what a future generation cycle will use."
      />

      <Card>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Automation</p>
              <p className="text-sm text-text-secondary">Turn on scheduled generation once it ships in Phase 9.</p>
            </div>
            <Switch checked={config.automationEnabled} onCheckedChange={(value) => update("automationEnabled", value)} />
          </div>

          <div>
            <label htmlFor="interval" className="mb-1.5 block text-sm font-medium text-text-primary">
              Generation Interval (hours)
            </label>
            <Input
              id="interval"
              type="number"
              min={1}
              value={config.intervalHours}
              onChange={(event) => update("intervalHours", Number(event.target.value))}
              className="w-32"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="default-style" className="mb-1.5 block text-sm font-medium text-text-primary">
                Default Style
              </label>
              <Select
                id="default-style"
                value={config.defaultStyle}
                onChange={(event) => update("defaultStyle", event.target.value as SchedulerConfig["defaultStyle"])}
              >
                {VIDEO_STYLES.map((option) => (
                  <option key={option.value} value={option.value} disabled={!option.available}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="default-duration" className="mb-1.5 block text-sm font-medium text-text-primary">
                Default Duration
              </label>
              <Select
                id="default-duration"
                value={config.defaultDurationSeconds}
                onChange={(event) => update("defaultDurationSeconds", Number(event.target.value))}
              >
                {DURATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Require Approval</p>
              <p className="text-sm text-text-secondary">Every video waits for your Telegram approval before publishing.</p>
            </div>
            <Switch checked={config.requireApproval} onCheckedChange={(value) => update("requireApproval", value)} />
          </div>

          <div>
            <label htmlFor="visibility" className="mb-1.5 block text-sm font-medium text-text-primary">
              YouTube Visibility
            </label>
            <Select
              id="visibility"
              value={config.youtubeVisibility}
              onChange={(event) => update("youtubeVisibility", event.target.value as YouTubeVisibility)}
              className="w-48"
            >
              {VISIBILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <Button onClick={handleSave}>Save Settings</Button>
        </CardContent>
      </Card>
    </div>
  );
}
