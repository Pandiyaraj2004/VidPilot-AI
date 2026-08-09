import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/hooks/useToast";
import { contentEngine } from "@/services/ai/contentEngine";
import { VIDEO_STYLES, type VideoStyle } from "@/types";
import { cn } from "@/utils/cn";
import { Info, Sparkles } from "lucide-react";
import { useState } from "react";

type DurationPreset = "60" | "180" | "300" | "600" | "custom";

const DURATION_OPTIONS: { value: DurationPreset; label: string }[] = [
  { value: "60", label: "60 seconds" },
  { value: "180", label: "3 minutes" },
  { value: "300", label: "5 minutes" },
  { value: "600", label: "10 minutes" },
  { value: "custom", label: "Custom" },
];

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "ta", label: "Tamil" },
  { value: "hi", label: "Hindi" },
];

export default function CreateVideoPage() {
  const { showToast } = useToast();
  const [topic, setTopic] = useState("");
  const [script, setScript] = useState("");
  const [style, setStyle] = useState<VideoStyle>("text");
  const [duration, setDuration] = useState<DurationPreset>("300");
  const [customMinutes, setCustomMinutes] = useState("5");
  const [language, setLanguage] = useState("en");
  const [submitting, setSubmitting] = useState(false);

  const durationSeconds = duration === "custom" ? Number(customMinutes || 0) * 60 : Number(duration);

  async function handleGenerate() {
    setSubmitting(true);
    try {
      await contentEngine.generate({
        topic,
        script: script || undefined,
        style,
        durationSeconds,
        language,
        voice: "default",
      });
    } catch (error) {
      showToast({
        variant: "info",
        title: "Generation engine coming in Phase 3",
        description: error instanceof Error ? error.message : "AI video generation isn't connected yet.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Create Video" description="Describe a topic and VidPilot will plan the rest — once the content engine ships." />

      <div className="mb-4 flex items-start gap-3 rounded-lg border border-info/20 bg-info/10 p-4 text-sm text-info">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>The generation engine will be enabled in Phase 3. This form is fully wired up, but clicking Generate won't call any AI provider yet.</p>
      </div>

      <Card>
        <CardContent className="space-y-6">
          <div>
            <label htmlFor="topic" className="mb-1.5 block text-sm font-medium text-text-primary">
              Topic
            </label>
            <Input
              id="topic"
              placeholder="What should the video be about?"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
            />
          </div>

          <div>
            <label htmlFor="script" className="mb-1.5 block text-sm font-medium text-text-primary">
              Full Script <span className="text-text-muted">(Optional)</span>
            </label>
            <Textarea
              id="script"
              placeholder="Paste your script here…"
              value={script}
              onChange={(event) => setScript(event.target.value)}
            />
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-text-primary">Video Style</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {VIDEO_STYLES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={!option.available}
                  onClick={() => setStyle(option.value)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    "disabled:cursor-not-allowed disabled:opacity-40",
                    style === option.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-text-secondary hover:border-text-muted"
                  )}
                >
                  {option.label}
                  {!option.available && <span className="ml-1 text-xs text-text-muted">(Soon)</span>}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-text-primary">Target Duration</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {DURATION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDuration(option.value)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    duration === option.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-text-secondary hover:border-text-muted"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {duration === "custom" && (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  className="w-28"
                  value={customMinutes}
                  onChange={(event) => setCustomMinutes(event.target.value)}
                />
                <span className="text-sm text-text-secondary">minutes</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="language" className="mb-1.5 block text-sm font-medium text-text-primary">
                Language
              </label>
              <Select id="language" value={language} onChange={(event) => setLanguage(event.target.value)}>
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="voice" className="mb-1.5 block text-sm font-medium text-text-primary">
                Voice
              </label>
              <Select id="voice" value="default" disabled>
                <option value="default">Default Voice</option>
              </Select>
            </div>
          </div>

          <Button onClick={handleGenerate} loading={submitting} disabled={!topic.trim() || submitting}>
            <Sparkles className="h-4 w-4" />
            Generate Video
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
