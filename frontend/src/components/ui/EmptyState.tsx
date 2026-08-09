import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      {Icon && (
        <div className="rounded-full bg-surface-elevated p-3">
          <Icon className="h-6 w-6 text-text-muted" aria-hidden="true" />
        </div>
      )}
      <div>
        <p className="text-sm font-medium text-text-primary">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-text-secondary">{description}</p>}
      </div>
      {action}
    </div>
  );
}
