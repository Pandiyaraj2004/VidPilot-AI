import {
  BarChart3,
  Clock,
  LayoutDashboard,
  ListVideo,
  Send,
  Settings,
  Sparkles,
  Upload,
} from "lucide-react";
import type { ComponentType } from "react";
import { ROUTES } from "./routes";

export interface NavItem {
  label: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: ROUTES.dashboard, icon: LayoutDashboard },
  { label: "Create Video", path: ROUTES.create, icon: Sparkles },
  { label: "Video Queue", path: ROUTES.queue, icon: ListVideo },
  { label: "Published Videos", path: ROUTES.published, icon: Upload },
  { label: "Analytics", path: ROUTES.analytics, icon: BarChart3 },
  { label: "Scheduler", path: ROUTES.scheduler, icon: Clock },
  { label: "Telegram", path: ROUTES.telegram, icon: Send },
  { label: "Settings", path: ROUTES.settings, icon: Settings },
];
