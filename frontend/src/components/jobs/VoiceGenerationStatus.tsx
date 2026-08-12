import { Loader2 } from "lucide-react";

/**
 * The backend runs Piper for each scene in one blocking call — it doesn't
 * stream per-scene progress back, so this deliberately does NOT show a
 * ticking "Scene N/8" counter or a fake percentage. Naming the scene count
 * up front is the honest amount of detail we actually have.
 */
export function VoiceGenerationStatus({ sceneCount }: { sceneCount?: number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-elevated p-4">
      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-text-primary">Generating voice…</p>
        <p className="text-xs text-text-secondary">
          {sceneCount ? `Generating narration audio for ${sceneCount} scene${sceneCount === 1 ? "" : "s"}.` : "Generating narration audio."}
        </p>
      </div>
    </div>
  );
}
