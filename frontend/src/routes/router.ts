import { AppShell } from "@/components/layout/AppShell";
import { ROUTES } from "@/constants/routes";
import { createBrowserRouter, redirect } from "react-router-dom";

function toDashboard() {
  return redirect(ROUTES.dashboard);
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AppShell,
    children: [
      { index: true, loader: toDashboard },
      {
        path: ROUTES.dashboard.slice(1),
        lazy: () => import("@/pages/Dashboard/DashboardPage").then((m) => ({ Component: m.default })),
      },
      {
        path: ROUTES.create.slice(1),
        lazy: () => import("@/pages/CreateVideo/CreateVideoPage").then((m) => ({ Component: m.default })),
      },
      {
        path: ROUTES.queue.slice(1),
        lazy: () => import("@/pages/VideoQueue/VideoQueuePage").then((m) => ({ Component: m.default })),
      },
      {
        path: ROUTES.published.slice(1),
        lazy: () => import("@/pages/PublishedVideos/PublishedVideosPage").then((m) => ({ Component: m.default })),
      },
      {
        path: ROUTES.analytics.slice(1),
        lazy: () => import("@/pages/Analytics/AnalyticsPage").then((m) => ({ Component: m.default })),
      },
      {
        path: ROUTES.scheduler.slice(1),
        lazy: () => import("@/pages/Scheduler/SchedulerPage").then((m) => ({ Component: m.default })),
      },
      {
        path: ROUTES.status.slice(1),
        lazy: () => import("@/pages/Status/StatusPage").then((m) => ({ Component: m.default })),
      },
      {
        path: ROUTES.telegram.slice(1),
        lazy: () => import("@/pages/Telegram/TelegramPage").then((m) => ({ Component: m.default })),
      },
      {
        path: ROUTES.settings.slice(1),
        lazy: () => import("@/pages/Settings/SettingsPage").then((m) => ({ Component: m.default })),
      },
      {
        path: "jobs/:jobId",
        lazy: () => import("@/pages/JobDetails/JobDetailsPage").then((m) => ({ Component: m.default })),
      },
      { path: "*", loader: toDashboard },
    ],
  },
]);
