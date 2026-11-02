import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { signPayload } from "../convex/lib/hmac";
import { redactMessage } from "../convex/lib/redact";
import { buildLoanEventPayload } from "../convex/lib/payload";
import { dayOffset, makeAdmin, makeT, newTool, signIn, type T } from "./helpers";
import { friendlyError } from "../lib/errors";
import { ConvexError } from "convex/values";

const SECRET = "inbound-test-secret";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("N8N_INBOUND_SECRET", SECRET);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const nowSec = () => Math.floor(Date.now() / 1000);
async function post(t: T, path: string, payload: unknown) {
  const body = JSON.stringify(payload);
  const sig = await signPayload(SECRET, body, nowSec());
  return t.fetch(path, { method: "POST", headers: { "X-LendLoop-Signature": sig }, body });
}
async function get(t: T, path: string) {
  const sig = await signPayload(SECRET, "", nowSec());
  return t.fetch(path, { method: "GET", headers: { "X-LendLoop-Signature": sig } });
}
async function codeOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as { data?: { code?: string } }).data?.code ?? "UNKNOWN";
  }
  return undefined;
}
const events = (t: T) => t.run((ctx) => ctx.db.query("automationEvents").collect());
const audits = (t: T) => t.run((ctx) => ctx.db.query("auditLogs").collect());

async function seedLoan(t: T) {
  const owner = await signIn(t, "owner");
  const borrower = await signIn(t, "borrower");
  const toolId = await owner.as.mutation(api.tools.create, newTool);
  const loanId = await borrower.as.mutation(api.loans.request, { toolId, startDate: dayOffset(1), endDate: dayOffset(2) });
  const ev = await t.run((ctx) => ctx.db.query("outboundEvents").first());
  return { owner, borrower, toolId, loanId, eventId: ev!.eventId };
}

describe("admin audit is unavoidable", () => {
  it("listAllLoans writes loan.viewed_all server-side on every call", async () => {
    const t = makeT();
    const admin = await makeAdmin(t, "boss");
    await admin.as.mutation(api.admin.listAllLoans, {});
    await admin.as.mutation(api.admin.listAllLoans, {});
    expect((await audits(t)).filter((a) => a.action === "loan.viewed_all")).toHaveLength(2);
  });

  it("non-admins get FORBIDDEN and no audit row", async () => {
    const t = makeT();
    const u = await signIn(t, "plain");
    expect(await codeOf(u.as.mutation(api.admin.listAllLoans, {}))).toBe("FORBIDDEN");
    expect(await audits(t)).toHaveLength(0);
  });

  it("setRole writes an audit row with a system actor", async () => {
    const t = makeT();
    await signIn(t, "someone");
    await t.mutation(internal.admin.setRole, { email: "someone@example.com", role: "admin" });
    const rows = await audits(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "user.role_set", actorLabel: "cli" });
    expect(rows[0].actorId).toBeUndefined();
    const admin = await t.withIdentity({ subject: "someone", tokenIdentifier: "https://issuer.test|someone", name: "x", email: "someone@example.com" });
    const log = await admin.query(api.admin.auditLog, {});
    expect(log[0].actorName).toBe("cli");
  });
});

describe("loans.request abuse limits", () => {
  it("rejects a duplicate pending request for the same tool", async () => {
    const t = makeT();
    const { borrower, toolId } = await seedLoan(t);
    const args = { toolId, startDate: dayOffset(5), endDate: dayOffset(6) };
    expect(await codeOf(borrower.as.mutation(api.loans.request, args))).toBe("DUPLICATE_REQUEST");
  });

  it("allows a new request once the previous one is no longer pending", async () => {
    const t = makeT();
    const { owner, borrower, toolId, loanId } = await seedLoan(t);
    await owner.as.mutation(api.loans.decline, { loanId });
    await borrower.as.mutation(api.loans.request, { toolId, startDate: dayOffset(5), endDate: dayOffset(6) });
  });

  it("caps pending requests per borrower at 5", async () => {
    const t = makeT();
    const owner = await signIn(t, "owner");
    const borrower = await signIn(t, "borrower");
    const ids: Id<"tools">[] = [];
    for (let i = 0; i < 6; i++) ids.push(await owner.as.mutation(api.tools.create, newTool));
    for (let i = 0; i < 5; i++) {
      await borrower.as.mutation(api.loans.request, { toolId: ids[i], startDate: dayOffset(1), endDate: dayOffset(2) });
    }
    expect(await codeOf(borrower.as.mutation(api.loans.request, { toolId: ids[5], startDate: dayOffset(1), endDate: dayOffset(2) }))).toBe("RATE_LIMITED");
  });

  it("has friendly messages", () => {
    expect(friendlyError(new ConvexError({ code: "DUPLICATE_REQUEST" }))).toMatch(/already have a pending/i);
    expect(friendlyError(new ConvexError({ code: "RATE_LIMITED" }))).toMatch(/too many/i);
  });
});

describe("write-back status upgrade", () => {
  it("reminder: failed then sent upgrades in place; sent/failed repeats are duplicates", async () => {
    const t = makeT();
    const { loanId } = await seedLoan(t);
    const key = `reminder:${loanId}:2030-01-01`;
    const body = (status: string) => ({ idempotencyKey: key, loanId, status, channel: "mock-log" });
    expect(await (await post(t, "/n8n/reminder-status", body("failed"))).json()).toEqual({ ok: true, duplicate: false });
    expect(await (await post(t, "/n8n/reminder-status", body("failed"))).json()).toEqual({ ok: true, duplicate: true });
    expect(await (await post(t, "/n8n/reminder-status", body("sent"))).json()).toEqual({ ok: true, duplicate: false });
    expect(await (await post(t, "/n8n/reminder-status", body("sent"))).json()).toEqual({ ok: true, duplicate: true });
    expect(await (await post(t, "/n8n/reminder-status", body("failed"))).json()).toEqual({ ok: true, duplicate: true });
    const all = await events(t);
    expect(all).toHaveLength(1);
    expect(all[0].kind).toBe("reminder_sent");
    expect(all[0].detail).toBeUndefined();
  });

  it("notification: sent after a prior failed report acknowledges the outbound event", async () => {
    const t = makeT();
    const { loanId, eventId } = await seedLoan(t);
    const body = (status: string) => ({ idempotencyKey: `notify:${eventId}`, eventId, loanId, status, channel: "mock-log" });
    await post(t, "/n8n/notification-status", body("failed"));
    let ev = await t.run((ctx) => ctx.db.query("outboundEvents").first());
    expect(ev?.acknowledgedAt).toBeUndefined();
    expect(await (await post(t, "/n8n/notification-status", body("sent"))).json()).toEqual({ ok: true, duplicate: false });
    ev = await t.run((ctx) => ctx.db.query("outboundEvents").first());
    expect(ev?.acknowledgedAt).toBeTypeOf("number");
    const all = await events(t);
    expect(all.filter((e) => e.idempotencyKey === `notify:${eventId}`)).toHaveLength(1);
    expect(all.find((e) => e.idempotencyKey === `notify:${eventId}`)?.kind).toBe("notification_sent");
  });
});

describe("overdue endpoint", () => {
  it("excludes loans already reminded today but not ones whose reminder failed", async () => {
    const t = makeT();
    const { loanId } = await seedLoan(t);
    await t.run((ctx) => ctx.db.patch(loanId, { status: "approved", startDate: dayOffset(-5), endDate: dayOffset(-2) }));
    const today = dayOffset(0);
    const key = `reminder:${loanId}:${today}`;
    const list = async () => ((await (await get(t, "/n8n/overdue-loans")).json()) as { loans: unknown[] }).loans;
    expect(await list()).toHaveLength(1);
    vi.advanceTimersByTime(1000); // fresh signature timestamp -> not a replay
    await post(t, "/n8n/reminder-status", { idempotencyKey: key, loanId, status: "failed", channel: "mock-log" });
    expect(await list()).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    await post(t, "/n8n/reminder-status", { idempotencyKey: key, loanId, status: "sent", channel: "mock-log" });
    expect(await list()).toHaveLength(0);
  });

  it("logs a warning when the cap is hit", async () => {
    const t = makeT();
    const { loanId } = await seedLoan(t);
    const base = await t.run((ctx) => ctx.db.get(loanId));
    await t.run(async (ctx) => {
      for (let i = 0; i < 200; i++) {
        await ctx.db.insert("loans", { ...base!, _id: undefined, _creationTime: undefined, status: "approved", startDate: dayOffset(-5), endDate: dayOffset(-2) } as never);
      }
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await t.query(internal.automation.overdueLoans, { today: dayOffset(0) });
    expect(warn.mock.calls.some((c) => String(c[0]).includes("overdue.cap_hit"))).toBe(true);
    warn.mockRestore();
  });
});

describe("tool removal notifies borrowers", () => {
  it("enqueues loan.cancelled addressed to the borrower for each cancelled loan", async () => {
    const t = makeT();
    const { toolId, loanId } = await seedLoan(t);
    const admin2 = await makeAdmin(t, "boss2");
    await admin2.as.mutation(api.admin.removeTool, { toolId });
    const out = await t.run((ctx) => ctx.db.query("outboundEvents").collect());
    const cancelled = out.filter((o) => o.type === "loan.cancelled");
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0]).toMatchObject({ loanId, audience: "borrower", status: "pending" });
  });

  it("snapshots the tool name so the payload survives tool deletion", async () => {
    const t = makeT();
    const { toolId } = await seedLoan(t);
    const toolName = (await t.run((ctx) => ctx.db.get(toolId)))!.name;
    const admin2 = await makeAdmin(t, "boss3");
    await admin2.as.mutation(api.admin.removeTool, { toolId });
    const ev = (await t.run((ctx) => ctx.db.query("outboundEvents").collect())).find(
      (o) => o.type === "loan.cancelled",
    )!;
    expect(ev.toolName).toBe(toolName);
    expect(await t.run((ctx) => ctx.db.get(toolId))).toBeNull();
    const data = await t.query(internal.notifications.getDeliveryData, { outboundEventId: ev._id });
    expect(data?.payload.tool.name).toBe(toolName);
  });

  it("payload audience override targets the borrower and stays minimal", () => {
    const p = buildLoanEventPayload({
      eventId: "e", type: "loan.cancelled", occurredAt: 0,
      loan: { _id: "l", status: "cancelled", startDate: "2030-01-01", endDate: "2030-01-02" },
      tool: { name: "Drill" },
      owner: { name: "Olive Owner", email: "o@example.com" },
      borrower: { name: "Bob Borrow", email: "b@example.com" },
      audience: "borrower",
    });
    expect(p.recipient).toEqual({ email: "b@example.com", firstName: "Bob" });
    expect(p.counterparty).toEqual({ firstName: "Olive" });
  });
});

describe("redaction", () => {
  it("strips emails and long hex/tokens", () => {
    const out = redactMessage("failed for jane.doe+x@example.com with sig 0123456789abcdef0123456789abcdef01234567 and Abc_def-ghi_jkl-mno_pqr-stu");
    expect(out).not.toMatch(/@example/);
    expect(out).not.toMatch(/0123456789abcdef/);
    expect(out).not.toMatch(/Abc_def-ghi/);
    expect(out).toContain("failed for [email]");
  });
  it("keeps ordinary text", () => {
    expect(redactMessage("HTTP 404 from Report notification status")).toBe("HTTP 404 from Report notification status");
  });
  it("automation-failure endpoint stores redacted detail", async () => {
    const t = makeT();
    const res = await post(t, "/n8n/automation-failure", {
      idempotencyKey: "fail:x1", workflow: "w", executionId: "x1",
      message: "bad request for victim@example.com token deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    });
    expect(res.status).toBe(200);
    const [e] = await events(t);
    expect(e.detail).not.toMatch(/victim@|deadbeef/);
  });
});

describe("outbox sweeper", () => {
  it("re-schedules only old pending events below the attempt cap", async () => {
    const t = makeT();
    const { loanId } = await seedLoan(t);
    const now = Date.now();
    await t.run(async (ctx) => {
      const mk = (o: object) => ctx.db.insert("outboundEvents", { eventId: crypto.randomUUID(), type: "loan.requested", loanId, status: "pending", attempts: 0, createdAt: now, ...o });
      await mk({ createdAt: now - 20 * 60_000 }); // stuck
      await mk({ createdAt: now - 20 * 60_000, attempts: 5 }); // exhausted
      await mk({ createdAt: now - 20 * 60_000, status: "sent" }); // done
      await mk({ createdAt: now - 60_000 }); // fresh
    });
    expect(await t.mutation(internal.notifications.sweepStuck, {})).toBe(1);
  });
});
