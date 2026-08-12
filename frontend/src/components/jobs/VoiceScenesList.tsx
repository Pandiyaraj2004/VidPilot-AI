import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { sceneAudioUrl } from "@/services/voice/voicesService";
import type { AudioStatus, VideoScene } from "@/types";
import { formatSeconds } from "@/utils/formatRelativeTime";

const AUDIO_STATUS_VARIANT: Record<AudioStatus, BadgeVariant> = {
  pending: "neutral",
  generating: "info",
  ready: "success",
  failed: "error",
};

const AUDIO_STATUS_LABEL: Record<AudioStatus, string> = {
  pending: "Pending",
  generating: "Generating",
  ready: "Ready",
  failed: "Failed",
};

// --- Phase 5 metadata helpers ---

const EMOTION_EMOJI: Record<string, string> = {
  curiosity:   "🔍",
  motivation:  "💪",
  mystery:     "🕵️",
  excitement:  "⚡",
  calm:        "🌊",
  dramatic:    "🎭",
  informative: "📚",
  surprise:    "✨",
  serious:     "🎯",
  humorous:    "😄",
};

const SCENE_ROLE_LABEL: Record<string, string> = {
  hook:        "Hook",
  question:    "Question",
  clue:        "Clue",
  reveal:      "Reveal",
  fact:        "Fact",
  build:       "Build",
  action:      "Action",
  conclusion:  "Conclusion",
  transition:  "Transition",
};

const MOTION_LABEL: Record<string, string> = {
  zoom_in:        "Zoom In",
  zoom_out:       "Zoom Out",
  pan_left:       "Pan Left",
  pan_right:      "Pan Right",
  pan_up:         "Pan Up",
  slow_cinematic: "Cinematic",
  fast_impact:    "Impact",
  static:         "Static",
};

// --- Phase 5 upgrade: internet visual sourcing helpers ---

const MEDIA_ICON: Record<string, string> = { color: "🎨", image: "🖼", video: "📹" };

const PROVIDER_LABEL: Record<string, string> = {
  pixabay: "Pixabay",
  pexels: "Pexels",
  wikimedia: "Wikimedia",
  procedural: "Procedural",
};

const TRANSITION_LABEL: Record<string, string> = {
  cut: "Cut",
  crossfade: "Crossfade",
  fade: "Fade",
  zoom: "Zoom",
  slide: "Slide",
};

function energyLabel(energy: number | undefined): string {
  if (energy === undefined) return "—";
  if (energy >= 0.65) return "High";
  if (energy >= 0.35) return "Medium";
  return "Low";
}

/** Small pill for displaying scene metadata chips. */
function MetaChip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-elevated px-2.5 py-0.5 text-xs text-text-secondary" title={label}>
      <span>{icon}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

export interface VoiceScenesListProps {
  jobId: string;
  scenes: VideoScene[];
  busySceneId: string | null;
  disabled?: boolean;
  onRegenerateScene: (sceneId: string) => void;
  /** Phase 5 upgrade — re-searches this scene's internet visuals without touching voice/script. */
  onRegenerateVisual: (sceneId: string) => void;
  busyVisualSceneId: string | null;
}

export function VoiceScenesList({
  jobId,
  scenes,
  busySceneId,
  disabled,
  onRegenerateScene,
  onRegenerateVisual,
  busyVisualSceneId,
}: VoiceScenesListProps) {
  return (
    <div className="space-y-2">
      {scenes
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((scene, index) => {
          const status = scene.audio?.status ?? "pending";
          const busy = busySceneId === scene.id;
          const visual = scene.visual;
          const hasPhase5Data = !!(scene.emotion || scene.energy !== undefined || scene.sceneRole);
          const segmentCount = visual?.segments?.length ?? 0;
          const primaryMotion = visual?.segments?.[0]?.cameraMotion;

          return (
            <div key={scene.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text-primary">Scene {index + 1}</p>
                    {scene.sceneRole && (
                      <span className="text-xs text-text-muted">· {SCENE_ROLE_LABEL[scene.sceneRole] ?? scene.sceneRole}</span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-text-secondary">{scene.narration}</p>
                </div>
                <Badge variant={AUDIO_STATUS_VARIANT[status]}>{AUDIO_STATUS_LABEL[status]}</Badge>
              </div>

              {/* Phase 5 scene metadata chips */}
              {hasPhase5Data && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {scene.emotion && (
                    <MetaChip
                      icon={EMOTION_EMOJI[scene.emotion] ?? "🎭"}
                      label="Emotion"
                      value={scene.emotion.charAt(0).toUpperCase() + scene.emotion.slice(1)}
                    />
                  )}
                  {scene.energy !== undefined && (
                    <MetaChip
                      icon="⚡"
                      label="Energy"
                      value={energyLabel(scene.energy)}
                    />
                  )}
                  {visual?.status === "ready" && segmentCount > 0 && (
                    <MetaChip icon="🖼" label="Visuals" value={`${segmentCount} segment${segmentCount !== 1 ? "s" : ""}`} />
                  )}
                  {visual?.status === "ready" && primaryMotion && (
                    <MetaChip icon="🎬" label="Motion" value={MOTION_LABEL[primaryMotion] ?? primaryMotion} />
                  )}
                  {visual?.captionStyle && visual.captionStyle !== "normal" && (
                    <MetaChip icon="💬" label="Caption" value={visual.captionStyle.charAt(0).toUpperCase() + visual.captionStyle.slice(1)} />
                  )}
                </div>
              )}

              {/* Highlight words */}
              {scene.highlightWords && scene.highlightWords.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {scene.highlightWords.slice(0, 5).map((word) => (
                    <span
                      key={word}
                      className="rounded bg-accent/15 px-1.5 py-0.5 text-xs font-semibold text-accent"
                    >
                      {word}
                    </span>
                  ))}
                </div>
              )}

              {/* Phase 5 upgrade: per-segment visual sourcing timeline */}
              {visual?.status === "ready" && segmentCount > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {visual.segments!.map((seg, segIndex) => {
                    const asset = visual.assets?.find((a) => a.id === seg.assetId);
                    const providerLabel = seg.fallbackUsed
                      ? "Fallback"
                      : PROVIDER_LABEL[asset?.provider ?? "procedural"];
                    return (
                      <span
                        key={seg.id}
                        title={`Segment ${segIndex + 1}: ${MOTION_LABEL[seg.cameraMotion] ?? seg.cameraMotion} · ${TRANSITION_LABEL[seg.transition] ?? seg.transition}${asset ? ` · ${asset.query}` : ""}`}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                          seg.fallbackUsed ? "bg-warning/15 text-warning" : "bg-surface-elevated text-text-secondary"
                        }`}
                      >
                        <span>{MEDIA_ICON[seg.mediaKind]}</span>
                        <span>{providerLabel}</span>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Attribution — preserved now so a future credits/description system can use it */}
              {visual?.assets?.some((a) => a.attributionRequired && a.attributionText) && (
                <div className="mt-1.5 space-y-0.5">
                  {visual.assets
                    .filter((a) => a.attributionRequired && a.attributionText)
                    .map((a) => (
                      <p key={a.id} className="text-xs text-text-muted">
                        {a.attributionText}
                      </p>
                    ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                {status === "ready" && (
                  <>
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <audio controls preload="none" src={sceneAudioUrl(jobId, scene.id)} className="h-8 max-w-full" />
                    {scene.audio?.duration !== undefined && (
                      <span className="text-xs text-text-muted">{formatSeconds(scene.audio.duration)}</span>
                    )}
                  </>
                )}
                {status === "failed" && scene.audio?.error && (
                  <p className="text-xs text-error">{scene.audio.error}</p>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  loading={busy}
                  disabled={disabled || busy}
                  onClick={() => onRegenerateScene(scene.id)}
                >
                  Regenerate
                </Button>
                {status === "ready" && visual?.status === "ready" && segmentCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={busyVisualSceneId === scene.id}
                    disabled={disabled || busyVisualSceneId === scene.id}
                    onClick={() => onRegenerateVisual(scene.id)}
                  >
                    Regenerate Visual
                  </Button>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}
