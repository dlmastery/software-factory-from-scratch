import { test } from "node:test";
import assert from "node:assert/strict";
import { start } from "../test/helpers.js";

// Issue #2: only absolute http(s) URLs are accepted.
test("http and https urls are accepted", async () => {
  const app = await start();
  assert.equal((await app.post("/links", { url: "https://example.com/x" })).status, 201);
  assert.equal((await app.post("/links", { url: "http://example.com/y?q=1" })).status, 201);
  await app.close();
});

test("scheme-less and non-http urls are rejected with 400", async () => {
  const app = await start();
  for (const url of ["example.com", "javascript:alert(1)", "ftp://example.com/f", "data:text/html,hi", "file:///etc/passwd", "//example.com"]) {
    const res = await app.post("/links", { url });
    assert.equal(res.status, 400, `expected 400 for ${url}`);
    assert.deepEqual(res.body, { error: "invalid url" });
  }
  await app.close();
});
