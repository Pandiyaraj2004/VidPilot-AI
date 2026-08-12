import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/hooks/useToast";
import { getAutomationState, saveSchedulerConfig, triggerGenerationNow } from "@/services/scheduler/schedulerConfigService";
import { apiGet } from "@/services/api/client";
import { VIDEO_STYLES, type SchedulerConfig, type VideoJob, type YouTubeVisibility } from "@/types";
import { Play, Calendar, CheckCircle, XCircle, Activity } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";

const DURATION_OPTIONS = [
  { value: 35, label: "Shorts (30–45s)" },
  { value: 60, label: "60 seconds" },
  { value: 180, label: "3 minutes" },
];

const VISIBILITY_OPTIONS: { value: YouTubeVisibility; label: string }[] = [
  { value: "private", label: "Private" },
  { value: "unlisted", label: "Unlisted" },
  { value: "public", label: "Public (Shorts)" },
];

export default function SchedulerPage() {
  const { showToast } = useToast();
  const [config, setConfig] = useState<SchedulerConfig | null>(null);
  const [historyLog, setHistoryLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [latestJob, setLatestJob] = useState<VideoJob | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const state = await getAutomationState();
        if (active) {
          setConfig(state.config);
          setHistoryLog(state.history);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          showToast({ variant: "error", title: "Could not load scheduler configuration" });
          setLoading(false);
        }
      }
      // Also load latest job for QC tile
      try {
        const job = await apiGet<VideoJob>("/jobs/latest");
        if (active) setLatestJob(job);
      } catch {
        // No jobs yet — that's fine
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  function update<K extends keyof SchedulerConfig>(key: K, value: SchedulerConfig[K]) {
    if (!config) return;
    setConfig((current) => current ? { ...current, [key]: value } : null);
  }

  async function handleSave() {
    if (!config) return;
    try {
      const saved = await saveSchedulerConfig(config);
      setConfig(saved);
      showToast({ variant: "success", title: "Scheduler settings saved successfully!" });
    } catch {
      showToast({ variant: "error", title: "Failed to save scheduler settings" });
    }
  }

  async function handleRunNow() {
    setTriggering(true);
    try {
      await triggerGenerationNow();
      showToast({ variant: "success", title: "Production pipeline triggered immediately!" });
    } catch (e: any) {
      showToast({ variant: "error", title: `Trigger failed: ${e.message}` });
    } finally {
      setTriggering(false);
    }
  }

  if (loading || !config) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-text-secondary text-sm">Loading automation state...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Scheduler & Automation"
        description="Configure your fully automated YouTube publication pipeline. Real elapsed-time scheduler runs in the background."
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Controls Card */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Automation Status</p>
                  <p className="text-xs text-text-secondary">Toggle the background video scheduler service.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${config.automationEnabled ? "bg-success animate-pulse" : "bg-text-secondary"}`} />
                  <span className="text-xs font-bold uppercase">{config.automationEnabled ? "Enabled" : "Disabled"}</span>
                  <Switch checked={config.automationEnabled} onCheckedChange={(value) => update("automationEnabled", value)} />
                </div>
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
                <p className="mt-1 text-xs text-text-secondary">Calculated drift-free: anchors next run exactly on previous run + interval.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="default-style" className="mb-1.5 block text-sm font-medium text-text-primary">
                    Default Content Style
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
                    Duration Setup
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
                  <p className="text-sm font-medium text-text-primary">Require Telegram Approval</p>
                  <p className="text-sm text-text-secondary">Every video waits for your explicit Approve tap before YouTube publishing.</p>
                </div>
                <Switch checked={config.requireApproval} onCheckedChange={(value) => update("requireApproval", value)} />
              </div>

              <div>
                <label htmlFor="visibility" className="mb-1.5 block text-sm font-medium text-text-primary">
                  YouTube Target Visibility
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

              <div className="flex gap-3 border-t border-border pt-4">
                <Button onClick={handleSave}>Save Settings</Button>
                <Button variant="secondary" onClick={handleRunNow} disabled={triggering}>
                  <Play className="mr-1.5 h-4 w-4" />
                  {triggering ? "Starting..." : "Generate Now"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info Card */}
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Next Production Slot
              </h3>
              <div className="rounded-lg bg-background p-3 text-xs space-y-2 border border-border">
                <div>
                  <span className="text-text-secondary">Next Run:</span>
                  <p className="font-semibold text-text-primary">
                    {config.nextGenerationAt ? new Date(config.nextGenerationAt).toLocaleString() : "Never (Scheduler Disabled)"}
                  </p>
                </div>
                <div>
                  <span className="text-text-secondary">Last Run:</span>
                  <p className="font-semibold text-text-primary">
                    {config.lastGenerationAt ? new Date(config.lastGenerationAt).toLocaleString() : "None"}
                  </p>
                </div>
                <div>
                  <span className="text-text-secondary">Last Job Created:</span>
                  <p className="font-semibold text-text-primary font-mono text-accent">
                    {latestJob?.id || "None"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <h3 className="text-sm font-bold text-text-primary">Safety Protocols</h3>
              <ul className="text-xs text-text-secondary space-y-2 list-disc pl-4">
                <li>Non-blocking: Waiting approvals do not delay next scheduled runs.</li>
                <li>Drift-free: Runs anchor perfectly on intervals.</li>
                <li>Safe validation: Requires complete Quality Control PASS before uploads.</li>
              </ul>
            </CardContent>
          </Card>

          {/* Latest Job QC Tile */}
          {latestJob && (
            <Card>
              <CardContent className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-bold text-text-primary">
                  <Activity className="h-4 w-4" /> Latest Job
                </h3>
                <p className="truncate text-xs font-medium text-text-primary">{latestJob.content?.title ?? latestJob.topic}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary">Status:</span>
                  <span className="text-xs font-semibold text-accent capitalize">{latestJob.status.replace(/_/g, " ")}</span>
                </div>
                {latestJob.qualityReport && (
                  <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold ${
                    latestJob.qualityReport.score >= 70
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-error/30 bg-error/10 text-error"
                  }`}>
                    {latestJob.qualityReport.score >= 70
                      ? <CheckCircle className="h-3.5 w-3.5" />
                      : <XCircle className="h-3.5 w-3.5" />}
                    QC Score: {latestJob.qualityReport.score}/100 — {latestJob.qualityReport.score >= 70 ? "PASS" : "FAIL"}
                  </div>
                )}
                <Link
                  to={ROUTES.status}
                  className="block rounded-lg border border-border px-2.5 py-1.5 text-center text-xs font-medium text-text-secondary transition hover:border-accent hover:text-accent"
                >
                  View Live Status →
                </Link>
              </CardContent>
            </Card>
          )}

        </div>
      </div>

      {/* History Timeline */}
      <Card>
        <CardContent className="space-y-4">
          <h3 className="text-sm font-bold text-text-primary">Automation Event Timeline</h3>
          {historyLog.length === 0 ? (
            <p className="text-xs text-text-secondary py-4 text-center">No automated events logged yet.</p>
          ) : (
            <div className="border-l-2 border-border pl-4 space-y-4">
              {historyLog.map((event, idx) => (
                <div key={idx} className="relative text-xs">
                  <div className="absolute -left-[21px] top-1 bg-card rounded-full p-0.5">
                    {event.eventType === "failed" ? (
                      <XCircle className="h-3.5 w-3.5 text-error" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5 text-success" />
                    )}
                  </div>
                  <span className="text-[10px] text-text-secondary">{new Date(event.timestamp).toLocaleString()}</span>
                  <p className="font-medium text-text-primary mt-0.5">{event.message}</p>
                  {event.jobId && (
                    <div className="mt-1 flex gap-2 text-[10px] text-text-secondary">
                      <span>Job: <strong className="font-mono text-accent">{event.jobId}</strong></span>
                      {event.topic && <span>Topic: "{event.topic}"</span>}
                      {event.category && <span>Category: {event.category}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
