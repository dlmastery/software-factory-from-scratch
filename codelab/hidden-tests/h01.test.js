import { test } from "node:test";
import assert from "node:assert/strict";
import { start } from "../test/helpers.js";

// Issue #1: a repeated random slug must never overwrite an existing link.
test("a colliding random slug is regenerated instead of overwriting", async () => {
  const slugs = ["aaaaaa", "aaaaaa", "aaaaaa", "bbbbbb"];
  const app = await start({ randomSlug: () => slugs.shift() ?? "zzzzzz" });
  const first = await app.post("/links", { url: "https://first.example" });
  const second = await app.post("/links", { url: "https://second.example" });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(first.body.slug, "aaaaaa");
  assert.equal(second.body.slug, "bbbbbb");
  assert.equal((await app.get("/aaaaaa")).headers.get("location"), "https://first.example");
  assert.equal((await app.get("/bbbbbb")).headers.get("location"), "https://second.example");
  await app.close();
});
