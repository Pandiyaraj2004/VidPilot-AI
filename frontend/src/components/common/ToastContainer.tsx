import type { ToastVariant } from "@/context/toastContextObject";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/utils/cn";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createPortal } from "react-dom";

const variantIcon: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
};

const variantClasses: Record<ToastVariant, string> = {
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  error: "text-error",
};

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = variantIcon[toast.variant];
        return (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-surface-elevated p-4 shadow-lg"
          >
            <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", variantClasses[toast.variant])} aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">{toast.title}</p>
              {toast.description && <p className="mt-0.5 text-sm text-text-secondary">{toast.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="text-text-muted hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
}
