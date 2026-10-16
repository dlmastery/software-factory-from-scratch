/** Returns true when `value` looks like a URL we can redirect to. */
export function isValidUrl(value) {
  return typeof value === "string" && value.trim().length > 0;
}
