/** Structured JSON logger with redaction of sensitive keys. */

type Level = "info" | "warn" | "error";

const SENSITIVE = /email|secret|signature|token|authorization|password|key$/i;
// idempotencyKey / eventId are identifiers, not credentials.
const ALLOWED = /^(idempotencyKey)$/;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE.test(k) && !ALLOWED.test(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

function emit(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({
    level,
    event,
    ts: new Date().toISOString(),
    ...(redact(fields) as Record<string, unknown>),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields?: Record<string, unknown>) => emit("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => emit("error", event, fields),
};
