import { cn } from "@/utils/cn";

export type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

const dotClasses: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  info: "bg-info",
  neutral: "bg-text-muted",
};

const textClasses: Record<StatusTone, string> = {
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
  info: "text-info",
  neutral: "text-text-muted",
};

export interface StatusIndicatorProps {
  tone: StatusTone;
  label: string;
  className?: string;
}

/** Always pairs the color dot with a text label — status must never be color-only. */
export function StatusIndicator({ tone, label, className }: StatusIndicatorProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", className)}>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClasses[tone])} aria-hidden="true" />
      <span className={textClasses[tone]}>{label}</span>
    </span>
  );
}
