import { test } from "node:test";
import assert from "node:assert/strict";
import { start } from "../test/helpers.js";

// Issue #3: stats for an unknown slug is a 404, not a 500.
test("stats for an unknown slug returns 404", async () => {
  const app = await start();
  const res = await app.get("/stats/missing1");
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { error: "not found" });
  await app.close();
});
