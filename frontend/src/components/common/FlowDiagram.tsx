import { Badge } from "@/components/ui/Badge";
import { cn } from "@/utils/cn";
import { Check } from "lucide-react";

export type FlowStepTone = "manual" | "automatic";
export type FlowStepStatus = "waiting" | "active" | "done";

export interface FlowStep {
  label: string;
  tone?: FlowStepTone;
  status?: FlowStepStatus;
  hint?: string;
}

export interface FlowDiagramProps {
  steps: FlowStep[];
  className?: string;
}

const TONE_LABEL: Record<FlowStepTone, string> = {
  manual: "YOU",
  automatic: "AUTOMATIC",
};

function markerClasses(status: FlowStepStatus | undefined): string {
  if (status === "done") return "border-success bg-success text-white";
  if (status === "active") return "border-primary bg-primary text-white";
  return "border-border bg-surface text-text-muted";
}

/**
 * Vertical manual/automatic workflow timeline, reused by the Job Details
 * pipeline preview, the Telegram/Published Videos explainer flows, and the
 * Dashboard workflow summary card.
 */
export function FlowDiagram({ steps, className }: FlowDiagramProps) {
  return (
    <ol className={cn("space-y-0", className)}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li key={`${step.label}-${index}`} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast && (
              <span className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-border" aria-hidden="true" />
            )}
            <span
              className={cn(
                "z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                markerClasses(step.status)
              )}
            >
              {step.status === "done" ? <Check className="h-4 w-4" /> : index + 1}
            </span>
            <div className="flex flex-1 flex-col gap-1 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">{step.label}</p>
                {step.hint && <p className="text-xs text-text-secondary">{step.hint}</p>}
              </div>
              <div className="flex items-center gap-2">
                {step.tone && (
                  <Badge variant={step.tone === "manual" ? "primary" : "neutral"}>{TONE_LABEL[step.tone]}</Badge>
                )}
                {step.status && (
                  <span className="text-xs text-text-muted">
                    {step.status === "waiting" ? "○ Waiting" : step.status === "active" ? "● In progress" : "✓ Done"}
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
