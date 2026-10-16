import { test } from "node:test";
import assert from "node:assert/strict";
import { start } from "../test/helpers.js";

// Issue #9: per-client rate limit on link creation.
test("the 11th create inside a minute is rate limited", async () => {
  let t = 5_000_000;
  const app = await start({ now: () => t });
  for (let i = 0; i < 10; i++) {
    assert.equal((await app.post("/links", { url: `https://example.com/${i}` })).status, 201);
  }
  t += 15_000;
  const res = await app.post("/links", { url: "https://example.com/11" });
  assert.equal(res.status, 429);
  assert.deepEqual(res.body, { error: "rate limited" });
  const retry = Number(res.headers.get("retry-after"));
  assert.ok(Number.isInteger(retry) && retry > 0 && retry <= 60, `retry-after was ${res.headers.get("retry-after")}`);
  await app.close();
});

test("other routes are not rate limited and the window frees up", async () => {
  let t = 9_000_000;
  const app = await start({ now: () => t });
  let slug;
  for (let i = 0; i < 10; i++) slug = (await app.post("/links", { url: `https://example.com/${i}` })).body.slug;
  for (let i = 0; i < 15; i++) assert.equal((await app.get(`/${slug}`)).status, 302);
  assert.equal((await app.get(`/stats/${slug}`)).status, 200);
  t += 61_000;
  assert.equal((await app.post("/links", { url: "https://example.com/later" })).status, 201);
  await app.close();
});
