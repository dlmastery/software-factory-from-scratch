import { test } from "node:test";
import assert from "node:assert/strict";
import { start } from "../test/helpers.js";

// Issue #7: deleting a link.
test("deleting an existing link returns 204 and removes it", async () => {
  const app = await start();
  const { body } = await app.post("/links", { url: "https://example.com/bye" });
  const del = await app.delete(`/links/${body.slug}`);
  assert.equal(del.status, 204);
  assert.equal(del.body, undefined);
  assert.equal((await app.get(`/${body.slug}`)).status, 404);
  assert.equal((await app.get(`/stats/${body.slug}`)).status, 404);
  await app.close();
});

test("deleting an unknown link returns 404", async () => {
  const app = await start();
  const res = await app.delete("/links/nothere");
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { error: "not found" });
  await app.close();
});
