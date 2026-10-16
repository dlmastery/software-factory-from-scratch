# shortlinks

A tiny URL shortener. It is the practice target for the software-factory codelab: small enough to read in five minutes, with real bugs and missing features filed as issues.

```bash
npm test      # Node's built-in test runner; there are no dependencies to install
npm start     # http://localhost:3000
```

| Route | What it does |
|---|---|
| `GET /health` | `{ "ok": true }` |
| `POST /links` `{ "url": "https://..." }` | Creates a short link and returns `201 { slug, url, shortUrl }` |
| `GET /:slug` | Redirects (302) to the stored URL and counts a click |
| `GET /stats/:slug` | `{ slug, url, clicks, createdAt }` |

`createApp({ store, randomSlug, now })` in `src/app.js` takes injectable dependencies so tests can control randomness and time. Test helpers live in `test/helpers.js`.
