import { test } from "node:test";
import assert from "node:assert/strict";
import { start } from "../test/helpers.js";

// Issue #4: HEAD redirects but does not count as a click.
test("HEAD redirects without counting a click", async () => {
  const app = await start();
  const { body } = await app.post("/links", { url: "https://example.com/head" });
  const head = await app.head(`/${body.slug}`);
  assert.equal(head.status, 302);
  assert.equal(head.headers.get("location"), "https://example.com/head");
  await app.head(`/${body.slug}`);
  await app.get(`/${body.slug}`);
  assert.equal((await app.get(`/stats/${body.slug}`)).body.clicks, 1);
  await app.close();
});
