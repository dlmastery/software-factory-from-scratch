import { test } from "node:test";
import assert from "node:assert/strict";
import { start } from "../test/helpers.js";

// Issue #8: cursor pagination in creation order.
// The trap: every link here is created in the same millisecond, and the generated slugs are
// NOT in alphabetical order. Sorting by createdAt and then by slug returns the wrong order.
const SLUGS = ["zulu01", "alpha2", "mike03", "bravo4", "yank05", "echo06", "kilo07"];

async function seeded() {
  const queue = [...SLUGS];
  const app = await start({ now: () => 1_700_000_000_000, randomSlug: () => queue.shift() });
  for (const slug of SLUGS) await app.post("/links", { url: `https://example.com/${slug}` });
  return app;
}

test("links are listed in creation order across pages", async () => {
  const app = await seeded();
  const seen = [];
  let cursor = null;
  let pages = 0;
  do {
    const res = await app.get(`/links?limit=3${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.items.length <= 3);
    seen.push(...res.body.items.map((i) => i.slug));
    cursor = res.body.nextCursor;
    pages += 1;
  } while (cursor && pages < 10);
  assert.deepEqual(seen, SLUGS);
  assert.equal(cursor, null);
  await app.close();
});

test("the default page holds everything when there are fewer than 20 links", async () => {
  const app = await seeded();
  const res = await app.get("/links");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.items.map((i) => i.slug), SLUGS);
  assert.equal(res.body.nextCursor, null);
  assert.deepEqual(Object.keys(res.body.items[0]).sort(), ["clicks", "createdAt", "slug", "url"]);
  await app.close();
});

test("an invalid limit is rejected", async () => {
  const app = await seeded();
  for (const limit of ["0", "-1", "abc", "2.5"]) {
    const res = await app.get(`/links?limit=${limit}`);
    assert.equal(res.status, 400, `expected 400 for limit=${limit}`);
    assert.deepEqual(res.body, { error: "invalid limit" });
  }
  await app.close();
});
