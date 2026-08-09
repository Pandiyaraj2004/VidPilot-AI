import { NAV_ITEMS } from "@/constants/navigation";
import { cn } from "@/utils/cn";
import { X } from "lucide-react";
import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { createPortal } from "react-dom";

export interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
      <nav
        aria-label="Primary"
        className="relative flex h-full w-72 max-w-[80vw] flex-col bg-surface p-3 shadow-xl"
      >
        <div className="flex items-center justify-between px-2 py-2">
          <span className="text-sm font-semibold text-text-primary">Menu</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-md p-1.5 text-text-muted hover:bg-surface-elevated hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 flex-1 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>,
    document.body
  );
}
