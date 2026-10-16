// Typed handoffs. Each stage returns one JSON object; the runner validates it against the stage's
// JSON Schema before the next stage may read it. The same schema is passed to `claude --json-schema`,
// so the model is constrained at generation time AND the runner checks again at the boundary.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "schemas");

/** Load a stage schema by name: "triage", "work-report", "review", "integration". */
export function loadSchema(name) {
  return JSON.parse(readFileSync(join(SCHEMA_DIR, `${name}.schema.json`), "utf8"));
}

/**
 * Validate `value` against the subset of JSON Schema the stage contracts use:
 * type, properties, required, additionalProperties, enum, items, minLength, maxLength.
 * Returns a list of problems; an empty list means valid.
 */
export function validate(schema, value, path = "$") {
  const problems = [];
  const types = [].concat(schema.type ?? []);
  if (types.length && !types.some((t) => matchesType(t, value))) {
    problems.push(`${path}: expected ${types.join(" | ")}, got ${describe(value)}`);
    return problems;
  }
  if (schema.enum && !schema.enum.some((e) => e === value)) {
    problems.push(`${path}: expected one of ${schema.enum.map((e) => JSON.stringify(e)).join(", ")}, got ${JSON.stringify(value)}`);
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) problems.push(`${path}: shorter than ${schema.minLength}`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) problems.push(`${path}: longer than ${schema.maxLength}`);
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((item, i) => problems.push(...validate(schema.items, item, `${path}[${i}]`)));
  }
  if (isObject(value)) {
    for (const key of schema.required ?? []) {
      if (!(key in value)) problems.push(`${path}.${key}: required`);
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (key in value) problems.push(...validate(sub, value[key], `${path}.${key}`));
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in (schema.properties ?? {}))) problems.push(`${path}.${key}: not allowed`);
      }
    }
  }
  return problems;
}

/** Throw a readable error when `value` does not match `schema`. */
export function assertValid(schema, value, what) {
  const problems = validate(schema, value);
  if (problems.length) throw new Error(`${what} does not match its contract:\n  ${problems.join("\n  ")}`);
  return value;
}

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function matchesType(type, v) {
  switch (type) {
    case "object": return isObject(v);
    case "array": return Array.isArray(v);
    case "string": return typeof v === "string";
    case "boolean": return typeof v === "boolean";
    case "integer": return Number.isInteger(v);
    case "number": return typeof v === "number" && Number.isFinite(v);
    case "null": return v === null;
    default: return false;
  }
}

const describe = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);
