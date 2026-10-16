import { test } from "node:test";
import assert from "node:assert/strict";
import { start } from "../test/helpers.js";

// Issue #6: expiring links, driven by the injectable clock.
test("a link expires after expiresInSeconds", async () => {
  let t = 1_000_000;
  const app = await start({ now: () => t });
  const { body } = await app.post("/links", { url: "https://example.com/soon", expiresInSeconds: 60 });
  t += 59_000;
  assert.equal((await app.get(`/${body.slug}`)).status, 302);
  t += 1_000;
  const res = await app.get(`/${body.slug}`);
  assert.equal(res.status, 410);
  assert.deepEqual(res.body, { error: "expired" });
  assert.equal((await app.get(`/stats/${body.slug}`)).body.clicks, 1);
  await app.close();
});

test("links without expiresInSeconds never expire", async () => {
  let t = 0;
  const app = await start({ now: () => t });
  const { body } = await app.post("/links", { url: "https://example.com/forever" });
  t += 10 * 365 * 24 * 3600 * 1000;
  assert.equal((await app.get(`/${body.slug}`)).status, 302);
  await app.close();
});

test("an invalid expiresInSeconds is rejected", async () => {
  const app = await start();
  for (const expiresInSeconds of [0, -5, 1.5, "60"]) {
    const res = await app.post("/links", { url: "https://example.com", expiresInSeconds });
    assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(expiresInSeconds)}`);
    assert.deepEqual(res.body, { error: "invalid expiresInSeconds" });
  }
  await app.close();
});
