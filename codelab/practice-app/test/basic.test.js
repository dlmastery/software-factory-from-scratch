import { test } from "node:test";
import assert from "node:assert/strict";
import { start } from "./helpers.js";

test("health check answers ok", async () => {
  const app = await start();
  const res = await app.get("/health");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
  await app.close();
});

test("creating a link returns its slug", async () => {
  const app = await start();
  const res = await app.post("/links", { url: "https://example.com/docs" });
  assert.equal(res.status, 201);
  assert.match(res.body.slug, /^[a-z0-9]{6}$/);
  assert.equal(res.body.shortUrl, `/${res.body.slug}`);
  await app.close();
});

test("a slug redirects to its url and counts the click", async () => {
  const app = await start();
  const { body } = await app.post("/links", { url: "https://example.com/a" });
  const res = await app.get(`/${body.slug}`);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "https://example.com/a");
  const stats = await app.get(`/stats/${body.slug}`);
  assert.equal(stats.body.clicks, 1);
  await app.close();
});

test("an empty url is rejected", async () => {
  const app = await start();
  const res = await app.post("/links", { url: "" });
  assert.equal(res.status, 400);
  await app.close();
});

test("an unknown slug returns 404", async () => {
  const app = await start();
  const res = await app.get("/nope42");
  assert.equal(res.status, 404);
  await app.close();
});
