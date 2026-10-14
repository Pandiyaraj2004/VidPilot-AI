import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
const secret = process.env.SESSION_SECRET ?? randomBytes(32).toString("hex");
const sign = (v) => createHmac("sha256", secret).update(v).digest("hex");
function equal(a, b) { const left = Buffer.from(a), right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); }
export function signedMediaUrl(url) { const u = new URL(url); const until = String(Date.now() + 3600000); u.searchParams.set("until", until); u.searchParams.set("sig", sign(u.pathname + until)); return u.toString(); }
const attempts = new Map();
export function localSession(req, res) {
    const address = req.socket.remoteAddress ?? "";
    let localOrigin = false;
    try {
        const origin = new URL(req.headers.origin ?? "");
        localOrigin = (origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) || origin.origin === process.env.FRONTEND_URL;
    }
    catch { /* No origin is rejected. */ }
    // Socket addresses cannot be forged through proxy headers. Never allow this on a public host.
    if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address) || !localOrigin || req.headers["x-forwarded-for"]) {
        res.status(403).json({ error: "Open your private workspace link for remote access." });
        return;
    }
    const expiry = String(Date.now() + 12 * 3600000);
    res.json({ token: `${expiry}.${sign(expiry)}` });
}
export function login(req, res) {
    for (const [key, value] of attempts)
        if (value.until < Date.now())
            attempts.delete(key);
    const address = req.ip ?? "unknown", now = Date.now(), old = attempts.get(address);
    const record = old && old.until > now ? old : { count: 0, until: now + 600000 };
    record.count++;
    attempts.set(address, record);
    if (record.count > 10) {
        res.status(429).json({ error: "Too many login attempts. Try again in ten minutes." });
        return;
    }
    const password = process.env.ADMIN_PASSWORD;
    if (!password || typeof req.body.password !== "string" || !equal(req.body.password, password)) {
        res.status(401).json({ error: "Invalid password or server access is not configured." });
        return;
    }
    const expiry = String(now + 12 * 3600000);
    res.json({ token: `${expiry}.${sign(expiry)}` });
}
export function authenticate(req, res, next) {
    if (req.method === "POST" && req.path === "/maintenance/cleanup" && process.env.RETENTION_TOKEN && equal(req.headers.authorization ?? "", `Bearer ${process.env.RETENTION_TOKEN}`)) {
        next();
        return;
    }
    if (req.path === "/youtube/callback") {
        next();
        return;
    }
    const until = String(req.query.until ?? ""), sig = String(req.query.sig ?? "");
    if (req.method === "GET" && /^\/jobs\/[^/]+\/(?:scenes\/[^/]+\/audio|visuals\/[^/]+)$/.test(req.path) && Number(until) > Date.now() && equal(sig, sign("/api" + req.path + until))) {
        next();
        return;
    }
    const token = req.headers.authorization?.replace(/^Bearer /, "") ?? "";
    const [expiry, signature] = token.split(".");
    if (expiry && signature && Number(expiry) > Date.now() && equal(signature, sign(expiry))) {
        next();
        return;
    }
    res.status(401).json({ error: "Private workspace access is required." });
}
