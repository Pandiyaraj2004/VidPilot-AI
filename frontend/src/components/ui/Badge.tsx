import { cn } from "@/utils/cn";
import type { HTMLAttributes } from "react";

export type BadgeVariant = "neutral" | "primary" | "success" | "warning" | "error" | "info";

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-surface-elevated text-text-secondary border-border",
  primary: "bg-primary/10 text-primary border-primary/20",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  error: "bg-error/10 text-error border-error/20",
  info: "bg-info/10 text-info border-info/20",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
