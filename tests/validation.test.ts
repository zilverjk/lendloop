import { describe, expect, it } from "vitest";
import {
  daysBetween,
  isIsoDate,
  parseAutomationFailure,
  parseNotificationStatus,
  parseReminderStatus,
  rangesOverlap,
  validateDescription,
  validateLoanDates,
  validateToolName,
} from "../convex/lib/validation";

describe("tool validation", () => {
  it("trims and enforces name length", () => {
    expect(validateToolName("  Drill  ")).toBe("Drill");
    expect(() => validateToolName(" a ")).toThrow();
    expect(() => validateToolName("x".repeat(81))).toThrow();
    expect(validateToolName("x".repeat(80))).toHaveLength(80);
  });
  it("limits description", () => {
    expect(validateDescription(" hi ")).toBe("hi");
    expect(() => validateDescription("x".repeat(501))).toThrow();
  });
});

describe("dates", () => {
  const today = "2030-01-10";
  it("validates ISO dates", () => {
    expect(isIsoDate("2030-02-28")).toBe(true);
    expect(isIsoDate("2030-02-30")).toBe(false);
    expect(isIsoDate("2030-2-3")).toBe(false);
    expect(isIsoDate("nope")).toBe(false);
  });
  it("accepts valid ranges", () => {
    expect(() => validateLoanDates("2030-01-10", "2030-01-10", today)).not.toThrow();
    expect(() => validateLoanDates("2030-01-10", "2030-02-09", today)).not.toThrow();
  });
  it("rejects past start, inverted range, >30 days, bad format", () => {
    expect(() => validateLoanDates("2030-01-09", "2030-01-12", today)).toThrow();
    expect(() => validateLoanDates("2030-01-12", "2030-01-11", today)).toThrow();
    expect(() => validateLoanDates("2030-01-10", "2030-02-10", today)).toThrow();
    expect(() => validateLoanDates("10/01/2030", "2030-01-11", today)).toThrow();
  });
  it("computes days and overlap", () => {
    expect(daysBetween("2030-01-01", "2030-01-31")).toBe(30);
    const a = { startDate: "2030-01-01", endDate: "2030-01-05" };
    expect(rangesOverlap(a, { startDate: "2030-01-05", endDate: "2030-01-07" })).toBe(true);
    expect(rangesOverlap(a, { startDate: "2030-01-06", endDate: "2030-01-07" })).toBe(false);
  });
});

describe("inbound body parsing", () => {
  it("parses reminder status and rejects extras / mismatches", () => {
    const ok = { idempotencyKey: "reminder:abc123:2030-01-01", loanId: "abc123", status: "sent", channel: "mock-log" };
    expect(parseReminderStatus(ok).ok).toBe(true);
    expect(parseReminderStatus({ ...ok, extra: 1 }).ok).toBe(false);
    expect(parseReminderStatus({ ...ok, loanId: "zzz" }).ok).toBe(false);
    expect(parseReminderStatus({ ...ok, status: "maybe" }).ok).toBe(false);
    expect(parseReminderStatus([]).ok).toBe(false);
    expect(parseReminderStatus(null).ok).toBe(false);
  });
  it("parses notification status", () => {
    const ok = { idempotencyKey: "notify:ev1", eventId: "ev1", loanId: "l1", status: "sent", channel: "mock-log" };
    expect(parseNotificationStatus(ok).ok).toBe(true);
    expect(parseNotificationStatus({ ...ok, idempotencyKey: "notify:other" }).ok).toBe(false);
  });
  it("truncates failure message to 300 chars", () => {
    const r = parseAutomationFailure({ idempotencyKey: "fail:e1", workflow: "w", executionId: "e1", message: "x".repeat(1000) });
    expect(r.ok && r.value.message.length).toBe(300);
    expect(parseAutomationFailure({ idempotencyKey: "fail:e1", workflow: "w", executionId: "e1", message: "m", loanId: "bad id!" }).ok).toBe(false);
  });
});
