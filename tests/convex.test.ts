import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api";
import { dayOffset, makeAdmin, makeT, newTool, signIn, type T } from "./helpers";

// Scheduled notification delivery is not advanced; we only assert outbox rows.
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

async function codeOf(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
  } catch (e) {
    const data = (e as { data?: { code?: string } }).data;
    return data?.code ?? "UNKNOWN";
  }
  return undefined;
}

async function setup(t: T) {
  const owner = await signIn(t, "owner");
  const borrower = await signIn(t, "borrower");
  const stranger = await signIn(t, "stranger");
  const toolId = await owner.as.mutation(api.tools.create, newTool);
  return { owner, borrower, stranger, toolId };
}

describe("RBAC", () => {
  it("rejects unauthenticated callers", async () => {
    const t = makeT();
    expect(await codeOf(t.query(api.tools.list, {}))).toBe("UNAUTHENTICATED");
    expect(await codeOf(t.mutation(api.tools.create, newTool))).toBe("UNAUTHENTICATED");
    expect(await codeOf(t.mutation(api.users.store, {}))).toBe("UNAUTHENTICATED");
    expect(await codeOf(t.query(api.admin.listUsers, {}))).toBe("UNAUTHENTICATED");
  });

  it("listPublic is open and exposes only id, name, category", async () => {
    const t = makeT();
    await setup(t);
    const rows = await t.query(api.tools.listPublic, {});
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(["_id", "category", "name"]);
  });

  it("tools.list hides owner email and clerk ids", async () => {
    const t = makeT();
    const { borrower } = await setup(t);
    const rows = await borrower.as.query(api.tools.list, {});
    expect(JSON.stringify(rows)).not.toContain("@example.com");
    expect(rows[0].owner).toEqual({ firstName: "owner", trustedLender: false });
    expect(JSON.stringify(rows)).not.toContain("Person");
  });

  it("non-owner cannot edit or delete a tool", async () => {
    const t = makeT();
    const { stranger, toolId } = await setup(t);
    expect(await codeOf(stranger.as.mutation(api.tools.update, { toolId, name: "Hacked" }))).toBe("FORBIDDEN");
    expect(await codeOf(stranger.as.mutation(api.tools.remove, { toolId }))).toBe("FORBIDDEN");
  });

  it("rejects invalid tool input", async () => {
    const t = makeT();
    const { owner } = await setup(t);
    expect(await codeOf(owner.as.mutation(api.tools.create, { ...newTool, name: "x" }))).toBe("INVALID_INPUT");
  });

  it("users.store never lets the client choose a role", async () => {
    const t = makeT();
    const { as, id } = await signIn(t, "someone");
    await as.mutation(api.users.store, {});
    const u = await t.run((ctx) => ctx.db.get(id));
    expect(u?.role).toBe("user");
  });

  it("non-owner cannot approve; borrower cannot borrow own tool", async () => {
    const t = makeT();
    const { owner, borrower, stranger, toolId } = await setup(t);
    expect(
      await codeOf(owner.as.mutation(api.loans.request, { toolId, startDate: dayOffset(1), endDate: dayOffset(2) })),
    ).toBe("FORBIDDEN");
    const loanId = await borrower.as.mutation(api.loans.request, {
      toolId,
      startDate: dayOffset(1),
      endDate: dayOffset(2),
    });
    expect(await codeOf(stranger.as.mutation(api.loans.approve, { loanId }))).toBe("FORBIDDEN");
    expect(await codeOf(borrower.as.mutation(api.loans.approve, { loanId }))).toBe("FORBIDDEN");
    expect(await codeOf(stranger.as.mutation(api.loans.cancel, { loanId }))).toBe("FORBIDDEN");
    expect(await codeOf(stranger.as.mutation(api.loans.markReturned, { loanId }))).toBe("FORBIDDEN");
  });

  it("regular users cannot call admin functions", async () => {
    const t = makeT();
    const { owner, toolId } = await setup(t);
    expect(await codeOf(owner.as.query(api.admin.listUsers, {}))).toBe("FORBIDDEN");
    expect(await codeOf(owner.as.mutation(api.admin.listAllLoans, {}))).toBe("FORBIDDEN");
    expect(await codeOf(owner.as.query(api.admin.auditLog, {}))).toBe("FORBIDDEN");
    expect(await codeOf(owner.as.mutation(api.admin.removeTool, { toolId }))).toBe("FORBIDDEN");
    expect(await codeOf(owner.as.mutation(api.admin.setTrustedLender, { userId: owner.id, trusted: true }))).toBe("FORBIDDEN");
  });

  it("admin can remove a listing and an audit row is written", async () => {
    const t = makeT();
    const { toolId, owner } = await setup(t);
    const admin = await makeAdmin(t, "boss");
    await admin.as.mutation(api.admin.removeTool, { toolId });
    expect(await t.run((ctx) => ctx.db.get(toolId))).toBeNull();
    await admin.as.mutation(api.admin.setTrustedLender, { userId: owner.id, trusted: true });
    await admin.as.mutation(api.admin.listAllLoans, {});
    const log = await admin.as.query(api.admin.auditLog, {});
    expect(log.map((r) => r.action).sort()).toEqual(["loan.viewed_all", "tool.removed", "user.role_set", "user.trusted_set"]);
    expect(log.filter((r) => r.action !== "user.role_set").every((r) => r.actorName === "boss Person")).toBe(true);
    const users = await admin.as.query(api.admin.listUsers, {});
    expect(users.find((u) => u._id === owner.id)?.trustedLender).toBe(true);
  });
});

describe("loan lifecycle", () => {
  it("request -> approve -> tool unavailable -> returned -> available", async () => {
    const t = makeT();
    const { owner, borrower, toolId } = await setup(t);
    const loanId = await borrower.as.mutation(api.loans.request, {
      toolId,
      startDate: dayOffset(1),
      endDate: dayOffset(3),
    });
    expect((await owner.as.query(api.loans.incomingRequests, {}))[0].status).toBe("pending");

    await owner.as.mutation(api.loans.approve, { loanId });
    expect((await t.query(api.tools.listPublic, {})).length).toBe(0);
    expect((await owner.as.query(api.tools.myListings, {}))[0].isAvailable).toBe(false);

    await borrower.as.mutation(api.loans.markReturned, { loanId });
    expect((await owner.as.query(api.tools.myListings, {}))[0].isAvailable).toBe(true);
    const mine = await borrower.as.query(api.loans.myRequests, {});
    expect(mine[0].status).toBe("returned");
    expect(mine[0].activity).toEqual([]);

    const outbox = await t.run((ctx) => ctx.db.query("outboundEvents").collect());
    expect(outbox.map((e) => e.type).sort()).toEqual(["loan.approved", "loan.requested", "loan.returned"]);
  });

  it("rejects overlapping requests with an approved loan but allows disjoint ones", async () => {
    const t = makeT();
    const { owner, borrower, toolId } = await setup(t);
    const other = await signIn(t, "other");
    const loanId = await borrower.as.mutation(api.loans.request, { toolId, startDate: dayOffset(2), endDate: dayOffset(5) });
    await owner.as.mutation(api.loans.approve, { loanId });
    expect(
      await codeOf(other.as.mutation(api.loans.request, { toolId, startDate: dayOffset(4), endDate: dayOffset(6) })),
    ).toBe("CONFLICT");
    await other.as.mutation(api.loans.request, { toolId, startDate: dayOffset(6), endDate: dayOffset(7) });
  });

  it("approve rejects a pending request that now overlaps an approved one", async () => {
    const t = makeT();
    const { owner, borrower, toolId } = await setup(t);
    const other = await signIn(t, "other");
    const a = await borrower.as.mutation(api.loans.request, { toolId, startDate: dayOffset(2), endDate: dayOffset(5) });
    const b = await other.as.mutation(api.loans.request, { toolId, startDate: dayOffset(3), endDate: dayOffset(4) });
    await owner.as.mutation(api.loans.approve, { loanId: a });
    expect(await codeOf(owner.as.mutation(api.loans.approve, { loanId: b }))).toBe("CONFLICT");
  });

  it("validates dates and blocks deleting a tool with an active loan", async () => {
    const t = makeT();
    const { owner, borrower, toolId } = await setup(t);
    expect(await codeOf(borrower.as.mutation(api.loans.request, { toolId, startDate: dayOffset(-1), endDate: dayOffset(1) }))).toBe("INVALID_INPUT");
    expect(await codeOf(borrower.as.mutation(api.loans.request, { toolId, startDate: dayOffset(1), endDate: dayOffset(40) }))).toBe("INVALID_INPUT");
    const loanId = await borrower.as.mutation(api.loans.request, { toolId, startDate: dayOffset(1), endDate: dayOffset(2) });
    await owner.as.mutation(api.loans.approve, { loanId });
    expect(await codeOf(owner.as.mutation(api.tools.remove, { toolId }))).toBe("CONFLICT");
  });

  it("borrower can cancel pending; owner can decline", async () => {
    const t = makeT();
    const { owner, borrower, toolId } = await setup(t);
    const a = await borrower.as.mutation(api.loans.request, { toolId, startDate: dayOffset(1), endDate: dayOffset(2) });
    await borrower.as.mutation(api.loans.cancel, { loanId: a });
    const b = await borrower.as.mutation(api.loans.request, { toolId, startDate: dayOffset(1), endDate: dayOffset(2) });
    await owner.as.mutation(api.loans.decline, { loanId: b });
    const statuses = (await borrower.as.query(api.loans.myRequests, {})).map((l) => l.status).sort();
    expect(statuses).toEqual(["cancelled", "declined"]);
  });
});
