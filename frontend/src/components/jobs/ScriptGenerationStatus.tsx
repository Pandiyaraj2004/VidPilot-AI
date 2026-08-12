import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const STEPS = ["Analyzing topic", "Creating structure", "Writing scenes", "Validating content"];
const STEP_INTERVAL_MS = 3000;

/**
 * Honest, qualitative status only — this is a client-side rotation through
 * plausible phases of a single blocking generation call, not a real
 * progress percentage. We genuinely don't know which step the AI provider
 * is on inside one request, so we never claim a number here.
 */
export function ScriptGenerationStatus() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStepIndex((index) => (index + 1) % STEPS.length);
    }, STEP_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-elevated p-4">
      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-text-primary">Generating your script…</p>
        <p className="text-xs text-text-secondary">{STEPS[stepIndex]}</p>
      </div>
    </div>
  );
}
