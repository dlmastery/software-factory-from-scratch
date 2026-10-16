/** Returns true only for absolute http: and https: URLs. */
export function isValidUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
