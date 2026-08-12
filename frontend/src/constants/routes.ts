export const ROUTES = {
  dashboard: "/dashboard",
  create: "/create",
  queue: "/queue",
  published: "/published",
  analytics: "/analytics",
  scheduler: "/scheduler",
  status: "/status",
  telegram: "/telegram",
  settings: "/settings",
} as const;

export type RouteKey = keyof typeof ROUTES;

export function jobDetailsRoute(jobId: string): string {
  return `/jobs/${jobId}`;
}
