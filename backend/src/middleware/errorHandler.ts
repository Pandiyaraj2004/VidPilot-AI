import type { NextFunction, Request, Response } from "express";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const message = err instanceof Error ? err.message : "Unexpected server error";
  const status = err instanceof Error && "status" in err ? Number((err as { status: number }).status) : 500;
  // eslint-disable-next-line no-console
  console.error("[VidPilot backend error]", err);
  res.status(Number.isFinite(status) ? status : 500).json({ error: message });
}
