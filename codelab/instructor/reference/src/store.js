/**
 * In-memory link store. A link is { slug, url, clicks, createdAt }.
 * Insertion order is creation order (a Map keeps insertion order).
 */
export function createStore() {
  const links = new Map();
  return {
    get: (slug) => links.get(slug),
    set: (link) => void links.set(link.slug, link),
    has: (slug) => links.has(slug),
    delete: (slug) => links.delete(slug),
    all: () => [...links.values()],
  };
}
