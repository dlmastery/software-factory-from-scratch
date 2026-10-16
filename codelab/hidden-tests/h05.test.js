import { test } from "node:test";
import assert from "node:assert/strict";
import { start } from "../test/helpers.js";

// Issue #5: custom slugs.
test("a valid custom slug is used", async () => {
  const app = await start();
  const res = await app.post("/links", { url: "https://example.com/launch", slug: "my-launch" });
  assert.equal(res.status, 201);
  assert.equal(res.body.slug, "my-launch");
  assert.equal(res.body.shortUrl, "/my-launch");
  assert.equal((await app.get("/my-launch")).headers.get("location"), "https://example.com/launch");
  await app.close();
});

test("an invalid custom slug is rejected", async () => {
  const app = await start();
  for (const slug of ["ab", "Has-Caps", "with space", "a".repeat(33), "under_score"]) {
    const res = await app.post("/links", { url: "https://example.com", slug });
    assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(slug)}`);
    assert.deepEqual(res.body, { error: "invalid slug" });
  }
  await app.close();
});

test("a taken custom slug returns 409 and keeps the original", async () => {
  const app = await start();
  await app.post("/links", { url: "https://original.example", slug: "taken" });
  const res = await app.post("/links", { url: "https://intruder.example", slug: "taken" });
  assert.equal(res.status, 409);
  assert.deepEqual(res.body, { error: "slug taken" });
  assert.equal((await app.get("/taken")).headers.get("location"), "https://original.example");
  await app.close();
});
