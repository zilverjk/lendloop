import { describe, expect, it } from "vitest";
import { buildLoanEventPayload, buildOverdueItem, firstName } from "../convex/lib/payload";

const owner = { name: "Olivia Ownerson", email: "olivia@example.com", clerkUserId: "user_OWN", description: "x" };
const borrower = { name: "Ben Borrower", email: "ben@example.com", clerkUserId: "user_BOR" };
const base = {
  eventId: "ev1",
  occurredAt: 1_700_000_000_000,
  loan: { _id: "loan1", status: "pending", startDate: "2030-01-01", endDate: "2030-01-03", ownerId: "secret-owner" },
  tool: { name: "Drill", description: "my private notes", ownerId: "x" },
  owner,
  borrower,
};

describe("payload minimization", () => {
  it("requested goes to owner with exactly the contract fields", () => {
    const p = buildLoanEventPayload({ ...base, type: "loan.requested" });
    expect(p).toEqual({
      eventId: "ev1",
      type: "loan.requested",
      occurredAt: "2023-11-14T22:13:20.000Z",
      loan: { id: "loan1", status: "pending", startDate: "2030-01-01", endDate: "2030-01-03" },
      tool: { name: "Drill" },
      recipient: { email: "olivia@example.com", firstName: "Olivia" },
      counterparty: { firstName: "Ben" },
    });
  });
  it("approved goes to borrower", () => {
    const p = buildLoanEventPayload({ ...base, type: "loan.approved" });
    expect(p.recipient).toEqual({ email: "ben@example.com", firstName: "Ben" });
    expect(p.counterparty).toEqual({ firstName: "Olivia" });
  });
  it("never leaks descriptions, clerk ids, full names or the other party's email", () => {
    for (const type of ["loan.requested", "loan.approved", "loan.declined", "loan.returned", "loan.cancelled"] as const) {
      const s = JSON.stringify(buildLoanEventPayload({ ...base, type }));
      expect(s).not.toContain("private notes");
      expect(s).not.toContain("user_");
      expect(s).not.toContain("Ownerson");
      expect(s).not.toContain("Borrower");
      expect(s).not.toContain("secret-owner");
      const emails = s.match(/[\w.]+@example\.com/g) ?? [];
      expect(emails).toHaveLength(1);
    }
  });
  it("overdue items carry only minimal fields", () => {
    const item = buildOverdueItem({ _id: "l1", endDate: "2030-01-01" }, 3, { name: "Saw" }, borrower);
    expect(item).toEqual({
      loanId: "l1",
      endDate: "2030-01-01",
      daysOverdue: 3,
      tool: { name: "Saw" },
      borrower: { email: "ben@example.com", firstName: "Ben" },
    });
  });
  it("firstName falls back", () => {
    expect(firstName("   ")).toBe("there");
    expect(firstName("Ana Maria")).toBe("Ana");
  });
});
