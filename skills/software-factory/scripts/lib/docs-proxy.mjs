// Live documentation with the key kept OUTSIDE the agent.
//
// In the video, Upstash Box attaches the Context7 key to outbound requests from outside the box,
// so the agent never sees it. Locally we get the same property with a tiny proxy owned by the runner:
// agents call http://127.0.0.1:<port>/search, the proxy adds the Authorization header and forwards
// to Context7. The key lives only in the runner's memory; agentEnv() strips it from every agent.
import http from "node:http";
import { appendFileSync } from "node:fs";

export async function startDocsProxy({ endpoint, apiKey, logFile }) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname !== "/search" || !url.searchParams.get("query")) {
      res.writeHead(404, { "content-type": "text/plain" });
      return res.end("usage: GET /search?query=<question>&library=<name>\n");
    }
    const caller = String(req.headers["x-factory-caller"] ?? "unknown").slice(0, 60);
    appendFileSync(logFile, `${new Date().toISOString()}\t${caller}\t${url.searchParams.getAll("library").join(",")}\t${url.searchParams.get("query")}\n`);
    try {
      const upstream = await fetch(`${endpoint}?${url.searchParams}`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        signal: AbortSignal.timeout(30_000),
      });
      res.writeHead(upstream.status, { "content-type": upstream.headers.get("content-type") ?? "text/plain" });
      res.end(await upstream.text());
    } catch (err) {
      res.writeHead(502, { "content-type": "text/plain" });
      res.end(`docs lookup failed: ${err.message}\n`);
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
}
