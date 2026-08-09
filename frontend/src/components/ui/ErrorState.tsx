import { Button } from "@/components/ui/Button";
import { AlertTriangle } from "lucide-react";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong.",
  description = "We couldn't load this section.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="rounded-full bg-error/10 p-3">
        <AlertTriangle className="h-6 w-6 text-error" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary">{title}</p>
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}
