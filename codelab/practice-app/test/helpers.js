import { createApp } from "../src/app.js";

/**
 * Start an app on a free port and return a small client.
 *
 *   const app = await start();                         // or start({ now: () => 0, randomSlug })
 *   const res = await app.post("/links", { url: "https://example.com" });
 *   res.status, res.headers.get("location"), res.body
 *   await app.close();
 */
export async function start(options = {}) {
  const server = createApp(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  server.unref(); // a failed assertion before close() must not keep the test process alive
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      redirect: "manual",
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }
    return { status: res.status, headers: res.headers, body: json };
  };
  return {
    base,
    get: (path) => request("GET", path),
    head: (path) => request("HEAD", path),
    post: (path, body) => request("POST", path, body),
    delete: (path) => request("DELETE", path),
    close: () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  };
}
