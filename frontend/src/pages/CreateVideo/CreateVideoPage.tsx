import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/hooks/useToast";
import { createJob } from "@/services/jobs/jobService";
import { listVoices, previewVoice } from "@/services/voice/voicesService";
import { jobDetailsRoute } from "@/constants/routes";
import {
  CONTENT_CATEGORIES,
  VIDEO_STYLES,
  VISUAL_STYLES,
  type ContentCategory,
  type CreateJobInput,
  type VideoStyle,
  type VisualStyle,
  type VoiceOption,
  type YouTubeVisibility,
} from "@/types";
import { cn } from "@/utils/cn";
import { Info, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

type DurationPreset = "short" | "medium" | "long" | "custom";

const DURATION_PRESETS: { value: DurationPreset; label: string; hint: string; minutes?: number }[] = [
  { value: "short", label: "Short", hint: "1–3 minutes", minutes: 2 },
  { value: "medium", label: "Medium", hint: "3–5 minutes", minutes: 4 },
  { value: "long", label: "Long", hint: "5–10 minutes", minutes: 7 },
  { value: "custom", label: "Custom", hint: "You choose" },
];

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "ta", label: "Tamil" },
  { value: "hi", label: "Hindi" },
];

const MAX_CUSTOM_MINUTES = 180;
const MIN_VOICE_SPEED = 0.75;
const MAX_VOICE_SPEED = 1.5;

interface Draft {
  topic: string;
  useOwnScript: boolean;
  script: string;
  style: VideoStyle;
  contentCategory: ContentCategory;
  durationPreset: DurationPreset;
  customMinutes: string;
  language: string;
  voiceId: string;
  voiceSpeed: number;
  visualStyle: VisualStyle;
  subtitlesEnabled: boolean;
  thumbnailEnabled: boolean;
  approvalRequired: boolean;
  youtubeVisibility: YouTubeVisibility;
}

const DRAFT_KEY = "vidpilot:create-video-draft";

const DEFAULT_DRAFT: Draft = {
  topic: "",
  useOwnScript: false,
  script: "",
  style: "explainer",
  contentCategory: "general_knowledge",
  durationPreset: "medium",
  customMinutes: "5",
  language: "en",
  voiceId: "",
  voiceSpeed: 1.0,
  visualStyle: "automatic",
  subtitlesEnabled: true,
  thumbnailEnabled: true,
  approvalRequired: true,
  youtubeVisibility: "private",
};

function loadDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? { ...DEFAULT_DRAFT, ...(JSON.parse(raw) as Partial<Draft>) } : DEFAULT_DRAFT;
  } catch {
    return DEFAULT_DRAFT;
  }
}

interface FormErrors {
  topic?: string;
  script?: string;
  duration?: string;
}

export default function CreateVideoPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const submitLockRef = useRef(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  async function handlePreviewVoice() {
    if (!draft.voiceId || previewLoading) return;
    setPreviewLoading(true);
    try {
      const blob = await previewVoice(draft.voiceId, draft.voiceSpeed);
      const url = URL.createObjectURL(blob);
      if (previewAudioRef.current) {
        previewAudioRef.current.src = url;
        await previewAudioRef.current.play();
      }
    } catch (err) {
      showToast({
        variant: "error",
        title: "Unable to preview this voice",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setPreviewLoading(false);
    }
  }

  useEffect(() => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  useEffect(() => {
    let cancelled = false;
    setVoicesLoading(true);
    listVoices(draft.language)
      .then((voices) => {
        if (cancelled) return;
        setAvailableVoices(voices);
        setDraft((current) => {
          if (voices.some((voice) => voice.id === current.voiceId)) return current;
          return { ...current, voiceId: voices[0]?.id ?? "" };
        });
      })
      .catch(() => {
        if (!cancelled) setAvailableVoices([]);
      })
      .finally(() => {
        if (!cancelled) setVoicesLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Re-fetch whenever the language changes — Piper voices are per-language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.language]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit() {
    if (submitLockRef.current) return;

    const nextErrors: FormErrors = {};
    if (!draft.topic.trim()) {
      nextErrors.topic = "Please enter a video topic.";
    }
    if (draft.useOwnScript && !draft.script.trim()) {
      nextErrors.script = 'Please paste your script, or turn off "Use my own script".';
    }

    let durationSeconds: number | null = null;
    if (draft.durationPreset === "custom") {
      if (!draft.customMinutes.trim()) {
        nextErrors.duration = "Please specify the custom duration.";
      } else {
        const minutes = Number(draft.customMinutes);
        if (!Number.isFinite(minutes) || minutes <= 0) {
          nextErrors.duration = "Please enter a valid duration.";
        } else if (minutes > MAX_CUSTOM_MINUTES) {
          nextErrors.duration = `Duration must be ${MAX_CUSTOM_MINUTES} minutes or less.`;
        } else {
          durationSeconds = minutes * 60;
        }
      }
    } else {
      const preset = DURATION_PRESETS.find((p) => p.value === draft.durationPreset);
      durationSeconds = (preset?.minutes ?? 5) * 60;
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || durationSeconds === null) {
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);
    setSubmitError(null);

    const input: CreateJobInput = {
      topic: draft.topic.trim(),
      inputScript: draft.useOwnScript ? draft.script.trim() : null,
      style: draft.style,
      contentCategory: draft.contentCategory,
      durationSeconds,
      language: draft.language,
      voiceId: draft.voiceId,
      voiceSpeed: draft.voiceSpeed,
      visualStyle: draft.visualStyle,
      subtitlesEnabled: draft.subtitlesEnabled,
      thumbnailEnabled: draft.thumbnailEnabled,
      approvalRequired: draft.approvalRequired,
      youtubeVisibility: draft.youtubeVisibility,
    };

    try {
      const job = await createJob(input);
      sessionStorage.removeItem(DRAFT_KEY);
      showToast({ variant: "success", title: "Job created successfully", description: "Status: QUEUED" });
      navigate(jobDetailsRoute(job.id));
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to create this video job. Please check your connection and try again."
      );
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Create Video"
        description="Give VidPilot a topic and settings. It queues a job — production runs in later phases."
      />

      {submitError && (
        <div className="mb-4">
          <ErrorState title="Unable to create this video job." description={submitError} onRetry={handleSubmit} />
        </div>
      )}

      <Card>
        <CardContent className="space-y-6">
          <div>
            <label htmlFor="topic" className="mb-1.5 block text-sm font-medium text-text-primary">
              Topic
            </label>
            <Input
              id="topic"
              placeholder="What should the video be about?"
              value={draft.topic}
              onChange={(event) => update("topic", event.target.value)}
              aria-invalid={Boolean(errors.topic)}
            />
            {errors.topic && <p className="mt-1 text-sm text-error">{errors.topic}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-primary">Use my own script?</span>
              <Switch
                checked={draft.useOwnScript}
                onCheckedChange={(value) => update("useOwnScript", value)}
                label="Use my own script"
              />
            </div>
            {draft.useOwnScript && (
              <div className="mt-3">
                <label htmlFor="script" className="mb-1.5 block text-sm font-medium text-text-primary">
                  Full Script
                </label>
                <Textarea
                  id="script"
                  placeholder="Paste your script here…"
                  value={draft.script}
                  onChange={(event) => update("script", event.target.value)}
                  aria-invalid={Boolean(errors.script)}
                />
                {errors.script && <p className="mt-1 text-sm text-error">{errors.script}</p>}
                <p className="mt-1 text-xs text-text-muted">Skips AI script generation for this job.</p>
              </div>
            )}
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-text-primary">Video Style</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {VIDEO_STYLES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={!option.available}
                  onClick={() => update("style", option.value)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    "disabled:cursor-not-allowed disabled:opacity-40",
                    draft.style === option.value
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
            <label htmlFor="content-category" className="mb-1.5 block text-sm font-medium text-text-primary">
              Content Category
            </label>
            <Select
              id="content-category"
              value={draft.contentCategory}
              onChange={(event) => update("contentCategory", event.target.value as ContentCategory)}
            >
              {CONTENT_CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-text-muted">
              Sets the topic domain for the AI's writing tone and picks which background-music folder plays for this video.
            </p>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-text-primary">Duration</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DURATION_PRESETS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => update("durationPreset", option.value)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    draft.durationPreset === option.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-text-secondary hover:border-text-muted"
                  )}
                >
                  {option.label}
                  <span className="block text-xs text-text-muted">{option.hint}</span>
                </button>
              ))}
            </div>
            {draft.durationPreset === "custom" && (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  className="w-28"
                  value={draft.customMinutes}
                  onChange={(event) => update("customMinutes", event.target.value)}
                  aria-invalid={Boolean(errors.duration)}
                />
                <span className="text-sm text-text-secondary">minutes</span>
              </div>
            )}
            {errors.duration && <p className="mt-1 text-sm text-error">{errors.duration}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="language" className="mb-1.5 block text-sm font-medium text-text-primary">
                Language
              </label>
              <Select id="language" value={draft.language} onChange={(event) => update("language", event.target.value)}>
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
              {availableVoices.length > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Select
                      id="voice"
                      value={draft.voiceId}
                      onChange={(event) => update("voiceId", event.target.value)}
                      disabled={voicesLoading}
                    >
                      {(() => {
                        const genders = Array.from(new Set(availableVoices.map((v) => v.gender)));
                        // Only worth grouping once a language actually has more than one gender installed.
                        if (genders.length <= 1) {
                          return availableVoices.map((voice) => (
                            <option key={voice.id} value={voice.id}>
                              {voice.label}
                            </option>
                          ));
                        }
                        return genders.map((gender) => (
                          <optgroup key={gender} label={gender === "female" ? "Female" : "Male"}>
                            {availableVoices
                              .filter((voice) => voice.gender === gender)
                              .map((voice) => (
                                <option key={voice.id} value={voice.id}>
                                  {voice.label}
                                </option>
                              ))}
                          </optgroup>
                        ));
                      })()}
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={voicesLoading || previewLoading || !draft.voiceId}
                    loading={previewLoading}
                    onClick={handlePreviewVoice}
                    title="Preview this voice"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio ref={previewAudioRef} className="hidden" />
                </div>
              ) : (
                <Select id="voice" value="" disabled>
                  <option value="">{voicesLoading ? "Loading voices…" : "No voice installed"}</option>
                </Select>
              )}
              {!voicesLoading && availableVoices.length === 0 && (
                <p className="mt-1 text-xs text-warning">
                  No Piper voice is installed for this language yet. The script can still be generated — voice
                  generation will fail with a clear error until a voice is added.
                </p>
              )}
            </div>
          </div>

          {availableVoices.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="voice-speed" className="text-sm font-medium text-text-primary">
                  Voice Speed
                </label>
                <span className="text-sm text-text-secondary">{draft.voiceSpeed.toFixed(2)}x</span>
              </div>
              <Slider
                id="voice-speed"
                value={draft.voiceSpeed}
                onValueChange={(value) => update("voiceSpeed", value)}
                min={MIN_VOICE_SPEED}
                max={MAX_VOICE_SPEED}
                step={0.05}
              />
            </div>
          )}

          <div>
            <span className="mb-1.5 block text-sm font-medium text-text-primary">Visual Style</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {VISUAL_STYLES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => update("visualStyle", option.value)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    draft.visualStyle === option.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-text-secondary hover:border-text-muted"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-text-muted">Used by the visual-generation engine in a later phase.</p>
          </div>

          <div className="space-y-4 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">Subtitles</p>
              </div>
              <Switch checked={draft.subtitlesEnabled} onCheckedChange={(value) => update("subtitlesEnabled", value)} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">AI Thumbnail</p>
              </div>
              <Switch checked={draft.thumbnailEnabled} onCheckedChange={(value) => update("thumbnailEnabled", value)} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">Require Telegram Approval</p>
                <p className="text-xs text-text-secondary">Recommended — nothing publishes to YouTube without your review.</p>
              </div>
              <Switch checked={draft.approvalRequired} onCheckedChange={(value) => update("approvalRequired", value)} />
            </div>
            <div>
              <label htmlFor="visibility" className="mb-1.5 block text-sm font-medium text-text-primary">
                YouTube Visibility
              </label>
              <Select
                id="visibility"
                value={draft.youtubeVisibility}
                onChange={(event) => update("youtubeVisibility", event.target.value as YouTubeVisibility)}
                className="w-48"
              >
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
                <option value="public">Public</option>
              </Select>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-info/20 bg-info/10 p-4 text-sm text-info">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This creates a queued job. Script and voice generation run automatically once triggered from Job
              Details; visuals and rendering are produced in later phases.
            </p>
          </div>

          <Button onClick={handleSubmit} loading={submitting} disabled={submitting}>
            {submitting ? "Creating…" : "Create Video Job"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
