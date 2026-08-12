import { ThemeToggle } from "@/components/common/ThemeToggle";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/hooks/useToast";
import { useYoutubeStatus } from "@/hooks/useYoutubeStatus";
import { getAutomationState, saveSchedulerConfig } from "@/services/scheduler/schedulerConfigService";
import { getAppSettings, saveAppSettings } from "@/services/settings/settingsService";
import { youtubeService } from "@/services/youtube/youtubeService";
import { VIDEO_STYLES, DEFAULT_SCHEDULER_CONFIG, type AppSettings, type IntegrationState, type SchedulerConfig } from "@/types";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "ta", label: "Tamil" },
  { value: "hi", label: "Hindi" },
];

const DURATION_OPTIONS = [
  { value: 60, label: "60 seconds" },
  { value: 180, label: "3 minutes" },
  { value: 300, label: "5 minutes" },
  { value: 600, label: "10 minutes" },
];

// YouTube gets its own real connection card below — not shown in this
// generic placeholder list, which would otherwise contradict it.
const INTEGRATIONS: IntegrationState[] = [
  { key: "gemini", label: "Gemini", configured: false },
  { key: "openrouter", label: "OpenRouter", configured: false },
  { key: "telegram", label: "Telegram", configured: false },
  { key: "firebase", label: "Firebase", configured: false },
];

function YoutubeConnectionCard() {
  const { showToast } = useToast();
  const { status, loading, refetch } = useYoutubeStatus();
  const [searchParams, setSearchParams] = useSearchParams();
  const [disconnecting, setDisconnecting] = useState(false);

  // The backend redirects the whole browser back here after the real Google
  // consent flow completes — read the outcome once, then strip it from the
  // URL so a refresh doesn't re-show the same toast.
  useEffect(() => {
    const outcome = searchParams.get("youtube");
    if (!outcome) return;

    if (outcome === "connected") {
      showToast({ variant: "success", title: "YouTube connected" });
      refetch();
    } else if (outcome === "denied") {
      showToast({ variant: "error", title: "YouTube connection was cancelled." });
    } else if (outcome === "error") {
      const reason = searchParams.get("reason");
      showToast({
        variant: "error",
        title: "Unable to connect YouTube.",
        description: reason ? `Reason: ${reason}` : undefined,
      });
    }

    const next = new URLSearchParams(searchParams);
    next.delete("youtube");
    next.delete("reason");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per redirect, not on every searchParams identity change
  }, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await youtubeService.disconnect();
      showToast({ variant: "success", title: "YouTube disconnected" });
      refetch();
    } catch (err) {
      showToast({
        variant: "error",
        title: "Unable to disconnect YouTube.",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>YouTube</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <p className="text-sm text-text-secondary">Checking connection…</p>}

        {!loading && status?.connected && status.channel && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {status.channel.thumbnailUrl && (
                <img src={status.channel.thumbnailUrl} alt="" className="h-10 w-10 rounded-full" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="success">Connected</Badge>
                </div>
                <p className="mt-1 text-sm font-medium text-text-primary">{status.channel.title}</p>
              </div>
            </div>
            <Button variant="secondary" onClick={handleDisconnect} loading={disconnecting} disabled={disconnecting}>
              Disconnect
            </Button>
          </div>
        )}

        {!loading && !status?.connected && (
          <div className="flex items-center justify-between gap-4">
            <div>
              <Badge variant="neutral">Not connected</Badge>
              <p className="mt-1 text-sm text-text-secondary">
                {status?.configured
                  ? "Connect your YouTube channel to publish approved videos."
                  : "Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET on the backend before connecting."}
              </p>
            </div>
            <Button
              onClick={() => {
                // A real full-page navigation to Google's consent screen —
                // never a fetch(); the browser itself must follow the
                // redirect chain out to accounts.google.com and back.
                window.location.href = youtubeService.authUrl();
              }}
              disabled={!status?.configured}
            >
              Connect YouTube
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { showToast } = useToast();
  const [appSettings, setAppSettings] = useState<AppSettings>(() => getAppSettings());
  const [schedulerConfig, setSchedulerConfig] = useState<SchedulerConfig>(DEFAULT_SCHEDULER_CONFIG);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const state = await getAutomationState();
        if (active) {
          setSchedulerConfig(state.config);
        }
      } catch {
        // Fallback to DEFAULT_SCHEDULER_CONFIG is already set
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  function updateAppSettings<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setAppSettings((current) => ({ ...current, [key]: value }));
  }

  function updateScheduler<K extends keyof SchedulerConfig>(key: K, value: SchedulerConfig[K]) {
    setSchedulerConfig((current) => ({ ...current, [key]: value }));
  }

  function handleSave() {
    saveAppSettings(appSettings);
    saveSchedulerConfig(schedulerConfig);
    showToast({ variant: "success", title: "Settings saved successfully" });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Settings" description="Application preferences, defaults, and integration status." />

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="app-name" className="mb-1.5 block text-sm font-medium text-text-primary">
              Application Name
            </label>
            <Input
              id="app-name"
              value={appSettings.applicationName}
              onChange={(event) => updateAppSettings("applicationName", event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="app-language" className="mb-1.5 block text-sm font-medium text-text-primary">
              Language
            </label>
            <Select
              id="app-language"
              value={appSettings.language}
              onChange={(event) => updateAppSettings("language", event.target.value)}
              className="w-48"
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-text-muted">Stored for future use — the interface is English-only in Phase 1.</p>
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-text-primary">Theme</span>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Video Defaults</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="default-style" className="mb-1.5 block text-sm font-medium text-text-primary">
              Default Style
            </label>
            <Select
              id="default-style"
              value={schedulerConfig.defaultStyle}
              onChange={(event) => updateScheduler("defaultStyle", event.target.value as SchedulerConfig["defaultStyle"])}
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
              value={schedulerConfig.defaultDurationSeconds}
              onChange={(event) => updateScheduler("defaultDurationSeconds", Number(event.target.value))}
            >
              {DURATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="default-language" className="mb-1.5 block text-sm font-medium text-text-primary">
              Default Language
            </label>
            <Select
              id="default-language"
              value={schedulerConfig.defaultLanguage}
              onChange={(event) => updateScheduler("defaultLanguage", event.target.value)}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="default-voice" className="mb-1.5 block text-sm font-medium text-text-primary">
              Default Voice
            </label>
            <Select id="default-voice" value={appSettings.defaultVoice} disabled>
              <option value="default">Default Voice</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary">Automation Enabled</span>
            <Switch
              checked={schedulerConfig.automationEnabled}
              onCheckedChange={(value) => updateScheduler("automationEnabled", value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary">Require Approval</span>
            <Switch
              checked={schedulerConfig.requireApproval}
              onCheckedChange={(value) => updateScheduler("requireApproval", value)}
            />
          </div>
          <div>
            <label htmlFor="interval" className="mb-1.5 block text-sm font-medium text-text-primary">
              Interval (hours)
            </label>
            <Input
              id="interval"
              type="number"
              min={1}
              className="w-32"
              value={schedulerConfig.intervalHours}
              onChange={(event) => updateScheduler("intervalHours", Number(event.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <YoutubeConnectionCard />

      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {INTEGRATIONS.map((integration) => (
            <div key={integration.key} className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">{integration.label}</span>
              <Badge variant="neutral">Not configured</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={handleSave}>Save Changes</Button>
    </div>
  );
}
