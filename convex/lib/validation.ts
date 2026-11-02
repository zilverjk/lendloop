import { ConvexError } from "convex/values";

export const MAX_LOAN_DAYS = 30;
export const MAX_BODY_BYTES = 10 * 1024;

export type InvalidInputData = { code: "INVALID_INPUT"; field: string; message: string };

export function invalid(field: string, message: string): ConvexError<InvalidInputData> {
  return new ConvexError({ code: "INVALID_INPUT", field, message });
}

export function validateToolName(raw: string): string {
  const name = raw.trim();
  if (name.length < 2 || name.length > 80) {
    throw invalid("name", "Name must be 2-80 characters");
  }
  return name;
}

export function validateDescription(raw: string): string {
  const description = raw.trim();
  if (description.length > 500) {
    throw invalid("description", "Description must be at most 500 characters");
  }
  return description;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(s: string): boolean {
  const m = ISO_DATE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function todayIso(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/** Whole days from a to b (b - a). Both must be valid ISO dates. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function validateLoanDates(start: string, end: string, today: string): void {
  if (!isIsoDate(start)) throw invalid("startDate", "Start date must be YYYY-MM-DD");
  if (!isIsoDate(end)) throw invalid("endDate", "End date must be YYYY-MM-DD");
  if (start < today) throw invalid("startDate", "Start date cannot be in the past");
  if (end < start) throw invalid("endDate", "End date must not be before start date");
  if (daysBetween(start, end) > MAX_LOAN_DAYS) {
    throw invalid("endDate", `Loans are limited to ${MAX_LOAN_DAYS} days`);
  }
}

/** Inclusive date-range overlap for ISO strings. */
export function rangesOverlap(
  a: { startDate: string; endDate: string },
  b: { startDate: string; endDate: string },
): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

// ---------------------------------------------------------------------------
// Inbound (n8n -> Convex) body validation. Strict shape: unknown keys rejected.
// ---------------------------------------------------------------------------

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const KEY_RE = /^[A-Za-z0-9:_.\-]{1,128}$/;
const ID_RE = /^[A-Za-z0-9_\-]{1,64}$/;
const CHANNEL_RE = /^[a-z0-9_\-]{1,32}$/;

function asObject(raw: unknown, allowed: string[]): ParseResult<Record<string, unknown>> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "body must be a JSON object" };
  }
  const obj = raw as Record<string, unknown>;
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) return { ok: false, error: `unexpected field: ${k}` };
  }
  return { ok: true, value: obj };
}

function str(obj: Record<string, unknown>, k: string, re: RegExp): string | null {
  const v = obj[k];
  return typeof v === "string" && re.test(v) ? v : null;
}

export type StatusBody = "sent" | "failed";

export type ReminderStatusBody = {
  idempotencyKey: string;
  loanId: string;
  status: StatusBody;
  channel: string;
};

export function parseReminderStatus(raw: unknown): ParseResult<ReminderStatusBody> {
  const o = asObject(raw, ["idempotencyKey", "loanId", "status", "channel"]);
  if (!o.ok) return o;
  const idempotencyKey = str(o.value, "idempotencyKey", KEY_RE);
  const loanId = str(o.value, "loanId", ID_RE);
  const channel = str(o.value, "channel", CHANNEL_RE);
  const status = o.value.status;
  if (!idempotencyKey) return { ok: false, error: "invalid idempotencyKey" };
  if (!loanId) return { ok: false, error: "invalid loanId" };
  if (!channel) return { ok: false, error: "invalid channel" };
  if (status !== "sent" && status !== "failed") return { ok: false, error: "invalid status" };
  if (!/^reminder:[^:]+:\d{4}-\d{2}-\d{2}$/.test(idempotencyKey)) {
    return { ok: false, error: "idempotencyKey must be reminder:<loanId>:<YYYY-MM-DD>" };
  }
  if (idempotencyKey.split(":")[1] !== loanId) {
    return { ok: false, error: "idempotencyKey does not match loanId" };
  }
  return { ok: true, value: { idempotencyKey, loanId, status, channel } };
}

export type NotificationStatusBody = {
  idempotencyKey: string;
  eventId: string;
  loanId: string;
  status: StatusBody;
  channel: string;
};

export function parseNotificationStatus(raw: unknown): ParseResult<NotificationStatusBody> {
  const o = asObject(raw, ["idempotencyKey", "eventId", "loanId", "status", "channel"]);
  if (!o.ok) return o;
  const idempotencyKey = str(o.value, "idempotencyKey", KEY_RE);
  const eventId = str(o.value, "eventId", ID_RE);
  const loanId = str(o.value, "loanId", ID_RE);
  const channel = str(o.value, "channel", CHANNEL_RE);
  const status = o.value.status;
  if (!idempotencyKey) return { ok: false, error: "invalid idempotencyKey" };
  if (!eventId) return { ok: false, error: "invalid eventId" };
  if (!loanId) return { ok: false, error: "invalid loanId" };
  if (!channel) return { ok: false, error: "invalid channel" };
  if (status !== "sent" && status !== "failed") return { ok: false, error: "invalid status" };
  if (idempotencyKey !== `notify:${eventId}`) {
    return { ok: false, error: "idempotencyKey must be notify:<eventId>" };
  }
  return { ok: true, value: { idempotencyKey, eventId, loanId, status, channel } };
}

export type AutomationFailureBody = {
  idempotencyKey: string;
  workflow: string;
  executionId: string;
  loanId?: string;
  message: string;
};

export const MAX_FAILURE_MESSAGE = 300;

export function parseAutomationFailure(raw: unknown): ParseResult<AutomationFailureBody> {
  const o = asObject(raw, ["idempotencyKey", "workflow", "executionId", "loanId", "message"]);
  if (!o.ok) return o;
  const idempotencyKey = str(o.value, "idempotencyKey", KEY_RE);
  const executionId = str(o.value, "executionId", ID_RE);
  const workflow = o.value.workflow;
  const message = o.value.message;
  if (!idempotencyKey) return { ok: false, error: "invalid idempotencyKey" };
  if (!executionId) return { ok: false, error: "invalid executionId" };
  if (typeof workflow !== "string" || workflow.length < 1 || workflow.length > 100) {
    return { ok: false, error: "invalid workflow" };
  }
  if (typeof message !== "string") return { ok: false, error: "invalid message" };
  if (idempotencyKey !== `fail:${executionId}`) {
    return { ok: false, error: "idempotencyKey must be fail:<executionId>" };
  }
  let loanId: string | undefined;
  if (o.value.loanId !== undefined) {
    const l = str(o.value, "loanId", ID_RE);
    if (!l) return { ok: false, error: "invalid loanId" };
    loanId = l;
  }
  return {
    ok: true,
    value: {
      idempotencyKey,
      workflow,
      executionId,
      loanId,
      message: message.slice(0, MAX_FAILURE_MESSAGE),
    },
  };
}
