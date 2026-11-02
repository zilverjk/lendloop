import { describe, expect, it } from "vitest";
import {
  canBorrow,
  canCancel,
  canDecideLoan,
  canDeleteTool,
  canEditTool,
  canMarkReturned,
  isAdmin,
} from "../convex/lib/authz";
import { backoffMs, shouldRetry } from "../convex/lib/retry";
import { redact } from "../convex/lib/log";

const owner = { _id: "o", role: "user" as const };
const borrower = { _id: "b", role: "user" as const };
const stranger = { _id: "s", role: "user" as const };
const admin = { _id: "a", role: "admin" as const };
const tool = { ownerId: "o" };
const loan = (status: string) => ({ ownerId: "o", borrowerId: "b", status });

describe("authz decisions", () => {
  it("only owner edits tool; admin role does not grant edit", () => {
    expect(canEditTool(owner, tool)).toBe(true);
    expect(canEditTool(stranger, tool)).toBe(false);
    expect(canEditTool(admin, tool)).toBe(false);
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(owner)).toBe(false);
  });
  it("delete blocked for non-owner or active loan", () => {
    expect(canDeleteTool(owner, tool, false)).toBe(true);
    expect(canDeleteTool(owner, tool, true)).toBe(false);
    expect(canDeleteTool(stranger, tool, false)).toBe(false);
  });
  it("cannot borrow own tool", () => {
    expect(canBorrow(owner, tool)).toBe(false);
    expect(canBorrow(borrower, tool)).toBe(true);
  });
  it("only owner decides pending loans", () => {
    expect(canDecideLoan(owner, loan("pending"))).toBe(true);
    expect(canDecideLoan(owner, loan("approved"))).toBe(false);
    expect(canDecideLoan(borrower, loan("pending"))).toBe(false);
    expect(canDecideLoan(stranger, loan("pending"))).toBe(false);
  });
  it("owner or borrower marks approved loans returned", () => {
    expect(canMarkReturned(owner, loan("approved"))).toBe(true);
    expect(canMarkReturned(borrower, loan("approved"))).toBe(true);
    expect(canMarkReturned(stranger, loan("approved"))).toBe(false);
    expect(canMarkReturned(owner, loan("pending"))).toBe(false);
  });
  it("only borrower cancels pending", () => {
    expect(canCancel(borrower, loan("pending"))).toBe(true);
    expect(canCancel(owner, loan("pending"))).toBe(false);
    expect(canCancel(borrower, loan("approved"))).toBe(false);
  });
});

describe("retry + log redaction", () => {
  it("backs off exponentially and stops at 5 attempts", () => {
    expect(backoffMs(1)).toBe(5000);
    expect(backoffMs(2)).toBe(10000);
    expect(backoffMs(3)).toBe(20000);
    expect(shouldRetry(4)).toBe(true);
    expect(shouldRetry(5)).toBe(false);
  });
  it("redacts sensitive keys", () => {
    expect(redact({ email: "a@b.c", nested: { signature: "x", ok: 1 }, idempotencyKey: "k" })).toEqual({
      email: "[redacted]",
      nested: { signature: "[redacted]", ok: 1 },
      idempotencyKey: "k",
    });
  });
});
