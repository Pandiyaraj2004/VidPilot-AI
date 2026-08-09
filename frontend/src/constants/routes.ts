export const ROUTES = {
  dashboard: "/dashboard",
  create: "/create",
  queue: "/queue",
  published: "/published",
  analytics: "/analytics",
  scheduler: "/scheduler",
  telegram: "/telegram",
  settings: "/settings",
} as const;

export type RouteKey = keyof typeof ROUTES;
