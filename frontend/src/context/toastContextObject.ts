import { createContext } from "react";

export type ToastVariant = "success" | "info" | "warning" | "error";

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
}

export interface ToastContextValue {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
