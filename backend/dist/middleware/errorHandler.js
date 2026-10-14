export function notFoundHandler(req, res) {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
}
export function errorHandler(err, _req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
_next) {
    const message = err instanceof Error ? err.message : "Unexpected server error";
    const status = err instanceof Error && "status" in err ? Number(err.status) : 500;
    // eslint-disable-next-line no-console
    console.error("[VidPilot backend error]", err);
    res.status(Number.isFinite(status) ? status : 500).json({ error: message });
}
