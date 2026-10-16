import http from "node:http";
import { randomSlug as defaultRandomSlug } from "./slug.js";
import { createStore } from "./store.js";
import { isValidUrl } from "./url.js";

const CUSTOM_SLUG = /^[a-z0-9-]{3,32}$/;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

/**
 * Reference solution: all nine actionable issues resolved.
 *
 * Everything that is random or time-based can be injected, so tests stay deterministic:
 *   randomSlug  () => string   slug generator
 *   now         () => number   clock in milliseconds
 */
export function createApp({ store = createStore(), randomSlug = defaultRandomSlug, now = () => Date.now() } = {}) {
  const hits = new Map(); // client ip -> timestamps of recent creates (issue #9)
  return http.createServer(async (req, res) => {
    try {
      await route(req, res, { store, randomSlug, now, hits });
    } catch {
      send(res, 500, { error: "internal error" });
    }
  });
}

async function route(req, res, ctx) {
  const { pathname, searchParams } = new URL(req.url, "http://localhost");

  if (req.method === "GET" && pathname === "/health") return send(res, 200, { ok: true });

  if (req.method === "POST" && pathname === "/links") {
    const retryAfter = rateLimit(ctx, req.socket.remoteAddress ?? "unknown");
    if (retryAfter) return send(res, 429, { error: "rate limited" }, { "retry-after": String(retryAfter) });

    const body = await readJson(req);
    if (!body || !isValidUrl(body.url)) return send(res, 400, { error: "invalid url" });

    let slug;
    if (body.slug !== undefined) {
      if (typeof body.slug !== "string" || !CUSTOM_SLUG.test(body.slug)) return send(res, 400, { error: "invalid slug" });
      if (ctx.store.has(body.slug)) return send(res, 409, { error: "slug taken" });
      slug = body.slug;
    } else {
      do slug = ctx.randomSlug();
      while (ctx.store.has(slug));
    }

    let expiresAt = null;
    if (body.expiresInSeconds !== undefined) {
      if (!Number.isInteger(body.expiresInSeconds) || body.expiresInSeconds <= 0) {
        return send(res, 400, { error: "invalid expiresInSeconds" });
      }
      expiresAt = ctx.now() + body.expiresInSeconds * 1000;
    }

    ctx.store.set({ slug, url: body.url, clicks: 0, createdAt: ctx.now(), expiresAt });
    return send(res, 201, { slug, url: body.url, shortUrl: `/${slug}` });
  }

  if (req.method === "GET" && pathname === "/links") return list(res, ctx, searchParams);

  const del = pathname.match(/^\/links\/([^/]+)$/);
  if (req.method === "DELETE" && del) {
    if (!ctx.store.delete(del[1])) return send(res, 404, { error: "not found" });
    res.writeHead(204);
    return res.end();
  }

  const stats = pathname.match(/^\/stats\/([^/]+)$/);
  if (req.method === "GET" && stats) {
    const link = ctx.store.get(stats[1]);
    if (!link) return send(res, 404, { error: "not found" });
    return send(res, 200, view(link));
  }

  const redirect = pathname.match(/^\/([^/]+)$/);
  if ((req.method === "GET" || req.method === "HEAD") && redirect) {
    const link = ctx.store.get(redirect[1]);
    if (!link) return send(res, 404, { error: "not found" });
    if (link.expiresAt !== null && ctx.now() >= link.expiresAt) return send(res, 410, { error: "expired" });
    if (req.method === "GET") link.clicks += 1;
    res.writeHead(302, { location: link.url });
    return res.end();
  }

  return send(res, 404, { error: "not found" });
}

/** Issue #8: creation order is insertion order, so the cursor is simply a position in that order. */
function list(res, ctx, params) {
  let limit = 20;
  if (params.has("limit")) {
    const raw = params.get("limit");
    if (!/^\d+$/.test(raw) || Number(raw) < 1) return send(res, 400, { error: "invalid limit" });
    limit = Math.min(Number(raw), 100);
  }
  const all = ctx.store.all();
  let startAt = 0;
  const cursor = params.get("cursor");
  if (cursor) {
    // The cursor is the slug of the last item on the previous page.
    const i = all.findIndex((l) => l.slug === cursor);
    if (i === -1) return send(res, 400, { error: "invalid cursor" });
    startAt = i + 1;
  }
  const items = all.slice(startAt, startAt + limit);
  const more = startAt + limit < all.length;
  return send(res, 200, { items: items.map(view), nextCursor: more ? items.at(-1).slug : null });
}

/** Issue #9: sliding one-minute window per client. Returns seconds to wait, or 0 when allowed. */
function rateLimit(ctx, ip) {
  const t = ctx.now();
  const recent = (ctx.hits.get(ip) ?? []).filter((at) => t - at < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    ctx.hits.set(ip, recent);
    return Math.max(1, Math.ceil((recent[0] + RATE_WINDOW_MS - t) / 1000));
  }
  recent.push(t);
  ctx.hits.set(ip, recent);
  return 0;
}

const view = (l) => ({ slug: l.slug, url: l.url, clicks: l.clicks, createdAt: l.createdAt });

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
