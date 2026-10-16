import { randomBytes } from "node:crypto";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** A random 6-character slug such as "k3x9qa". */
export function randomSlug() {
  const bytes = randomBytes(6);
  let slug = "";
  for (const b of bytes) slug += ALPHABET[b % ALPHABET.length];
  return slug;
}
