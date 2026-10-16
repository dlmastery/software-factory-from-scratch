import http from "node:http";
import { randomSlug as defaultRandomSlug } from "./slug.js";
import { createStore } from "./store.js";
import { isValidUrl } from "./url.js";

/**
 * Build the shortlinks HTTP server.
 *
 * Everything that is random or time-based can be injected, so tests stay deterministic:
 *   randomSlug  () => string   slug generator
 *   now         () => number   clock in milliseconds
 */
export function createApp({ store = createStore(), randomSlug = defaultRandomSlug, now = () => Date.now() } = {}) {
  return http.createServer(async (req, res) => {
    try {
      await route(req, res, { store, randomSlug, now });
    } catch {
      send(res, 500, { error: "internal error" });
    }
  });
}

async function route(req, res, ctx) {
  const { pathname } = new URL(req.url, "http://localhost");

  if (req.method === "GET" && pathname === "/health") return send(res, 200, { ok: true });

  if (req.method === "POST" && pathname === "/links") {
    const body = await readJson(req);
    if (!body || !isValidUrl(body.url)) return send(res, 400, { error: "invalid url" });
    const slug = ctx.randomSlug();
    const link = { slug, url: body.url, clicks: 0, createdAt: ctx.now() };
    ctx.store.set(link);
    return send(res, 201, { slug, url: link.url, shortUrl: `/${slug}` });
  }

  const stats = pathname.match(/^\/stats\/([^/]+)$/);
  if (req.method === "GET" && stats) {
    const link = ctx.store.get(stats[1]);
    return send(res, 200, { slug: link.slug, url: link.url, clicks: link.clicks, createdAt: link.createdAt });
  }

  const redirect = pathname.match(/^\/([^/]+)$/);
  if ((req.method === "GET" || req.method === "HEAD") && redirect) {
    const link = ctx.store.get(redirect[1]);
    if (!link) return send(res, 404, { error: "not found" });
    link.clicks += 1;
    res.writeHead(302, { location: link.url });
    return res.end();
  }

  return send(res, 404, { error: "not found" });
}

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
