import { ThemeToggle } from "@/components/common/ThemeToggle";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { Menu } from "lucide-react";

export interface TopBarProps {
  onOpenMenu: () => void;
}

export function TopBar({ onOpenMenu }: TopBarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open navigation menu"
          className="shrink-0 rounded-md p-2 text-text-secondary hover:bg-surface-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-white">
            V
          </div>
          <span className="truncate text-sm font-semibold text-text-primary">VidPilot AI</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <StatusIndicator tone="success" label="System Operational" className="hidden sm:inline-flex" />
        <ThemeToggle />
      </div>
    </header>
  );
}
