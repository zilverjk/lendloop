import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { signPayload } from "../convex/lib/hmac";
import { dayOffset, makeT, newTool, signIn, type T } from "./helpers";

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

async function post(t: T, path: string, payload: unknown, opts: { secret?: string; ts?: number; raw?: string } = {}) {
  const body = opts.raw ?? JSON.stringify(payload);
  const sig = await signPayload(opts.secret ?? SECRET, body, opts.ts ?? nowSec());
  return t.fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-LendLoop-Signature": sig },
    body,
  });
}

async function get(t: T, path: string, ts?: number) {
  const sig = await signPayload(SECRET, "", ts ?? nowSec());
  return t.fetch(path, { method: "GET", headers: { "X-LendLoop-Signature": sig } });
}

async function seedLoan(t: T): Promise<{ loanId: Id<"loans">; eventId: string }> {
  const owner = await signIn(t, "owner");
  const borrower = await signIn(t, "borrower");
  const toolId = await owner.as.mutation(api.tools.create, newTool);
  const loanId = await borrower.as.mutation(api.loans.request, { toolId, startDate: dayOffset(1), endDate: dayOffset(2) });
  const ev = await t.run((ctx) => ctx.db.query("outboundEvents").first());
  return { loanId, eventId: ev!.eventId };
}

const events = (t: T) => t.run((ctx) => ctx.db.query("automationEvents").collect());

describe("n8n inbound endpoints", () => {
  it("reminder-status is idempotent on idempotencyKey", async () => {
    const t = makeT();
    const { loanId } = await seedLoan(t);
    const body = { idempotencyKey: `reminder:${loanId}:2030-01-01`, loanId, status: "sent", channel: "mock-log" };
    const r1 = await post(t, "/n8n/reminder-status", body);
    expect(r1.status).toBe(200);
    expect(await r1.json()).toEqual({ ok: true, duplicate: false });
    const r2 = await post(t, "/n8n/reminder-status", body);
    expect(r2.status).toBe(200);
    expect(await r2.json()).toEqual({ ok: true, duplicate: true });
    const all = await events(t);
    expect(all).toHaveLength(1);
    expect(all[0].kind).toBe("reminder_sent");

    // surfaces as activity on the UI queries
    const owner = t.withIdentity({ subject: "owner", tokenIdentifier: "https://issuer.test|owner", name: "owner Person", email: "owner@example.com" });
    const incoming = await owner.query(api.loans.incomingRequests, {});
    expect(incoming[0].activity.map((a) => a.kind)).toEqual(["reminder_sent"]);
  });

  it("rejects bad signature, wrong secret, expired and future timestamps with 401", async () => {
    const t = makeT();
    const { loanId } = await seedLoan(t);
    const body = { idempotencyKey: `reminder:${loanId}:2030-01-01`, loanId, status: "sent", channel: "mock-log" };
    expect((await post(t, "/n8n/reminder-status", body, { secret: "wrong" })).status).toBe(401);
    expect((await post(t, "/n8n/reminder-status", body, { ts: nowSec() - 1000 })).status).toBe(401);
    expect((await post(t, "/n8n/reminder-status", body, { ts: nowSec() + 1000 })).status).toBe(401);
    const noSig = await t.fetch("/n8n/reminder-status", { method: "POST", body: JSON.stringify(body) });
    expect(noSig.status).toBe(401);
    const tampered = await t.fetch("/n8n/reminder-status", {
      method: "POST",
      headers: { "X-LendLoop-Signature": await signPayload(SECRET, JSON.stringify(body), nowSec()) },
      body: JSON.stringify({ ...body, status: "failed" }),
    });
    expect(tampered.status).toBe(401);
    expect(await events(t)).toHaveLength(0);
  });

  it("validates body shape and size", async () => {
    const t = makeT();
    const { loanId } = await seedLoan(t);
    expect((await post(t, "/n8n/reminder-status", null, { raw: "not json" })).status).toBe(400);
    expect((await post(t, "/n8n/reminder-status", { idempotencyKey: "x" })).status).toBe(400);
    const extra = { idempotencyKey: `reminder:${loanId}:2030-01-01`, loanId, status: "sent", channel: "c", evil: 1 };
    expect((await post(t, "/n8n/reminder-status", extra)).status).toBe(400);
    const big = { idempotencyKey: "fail:e1", workflow: "w", executionId: "e1", message: "x".repeat(20_000) };
    expect((await post(t, "/n8n/automation-failure", big)).status).toBe(413);
  });

  it("returns 500 when the inbound secret is not configured", async () => {
    vi.stubEnv("N8N_INBOUND_SECRET", "");
    const t = makeT();
    expect((await post(t, "/n8n/automation-failure", { idempotencyKey: "fail:e1", workflow: "w", executionId: "e1", message: "m" })).status).toBe(500);
  });

  it("overdue-loans returns minimal data and rejects replay with 409", async () => {
    const t = makeT();
    const { loanId } = await seedLoan(t);
    await t.run(async (ctx) => {
      await ctx.db.patch(loanId, { status: "approved", startDate: dayOffset(-5), endDate: dayOffset(-2) });
    });
    const ts = nowSec();
    const r1 = await get(t, "/n8n/overdue-loans", ts);
    expect(r1.status).toBe(200);
    const json = (await r1.json()) as { loans: Record<string, unknown>[] };
    expect(json.loans).toHaveLength(1);
    expect(json.loans[0]).toEqual({
      loanId,
      endDate: dayOffset(-2),
      daysOverdue: 2,
      tool: { name: newTool.name },
      borrower: { email: "borrower@example.com", firstName: "borrower" },
    });
    // identical request (same signature) is a replay, even with a different nonce header
    const sig = await signPayload(SECRET, "", ts);
    const replay = await t.fetch("/n8n/overdue-loans", {
      method: "GET",
      headers: { "X-LendLoop-Signature": sig, "X-LendLoop-Nonce": "fresh-looking-nonce" },
    });
    expect(replay.status).toBe(409);
    expect((await get(t, "/n8n/overdue-loans", ts - 400)).status).toBe(401);
  });

  it("notification-status acknowledges the outbound event once", async () => {
    const t = makeT();
    const { loanId, eventId } = await seedLoan(t);
    const body = { idempotencyKey: `notify:${eventId}`, eventId, loanId, status: "sent", channel: "mock-log" };
    expect((await (await post(t, "/n8n/notification-status", body)).json())).toEqual({ ok: true, duplicate: false });
    expect((await (await post(t, "/n8n/notification-status", body)).json())).toEqual({ ok: true, duplicate: true });
    const all = await events(t);
    expect(all.filter((e) => e.kind === "notification_sent")).toHaveLength(1);
    const ev = await t.run((ctx) => ctx.db.query("outboundEvents").first());
    expect(ev?.acknowledgedAt).toBeTypeOf("number");
    const unknown = { ...body, eventId: "nope", idempotencyKey: "notify:nope" };
    expect((await post(t, "/n8n/notification-status", unknown)).status).toBe(404);
  });

  it("automation-failure truncates the message and is idempotent; loanId optional", async () => {
    const t = makeT();
    const body = { idempotencyKey: "fail:exec1", workflow: "overdue-reminders", executionId: "exec1", message: "boom ".repeat(200) };
    expect((await post(t, "/n8n/automation-failure", body)).status).toBe(200);
    expect((await (await post(t, "/n8n/automation-failure", body)).json())).toEqual({ ok: true, duplicate: true });
    const all = await events(t);
    expect(all).toHaveLength(1);
    expect(all[0].kind).toBe("automation_failed");
    expect(all[0].loanId).toBeUndefined();
    expect(all[0].detail!.length).toBeLessThanOrEqual(300);
  });

  it("pruneReplay deletes nonces older than 24h", async () => {
    const t = makeT();
    const { internal } = await import("../convex/_generated/api");
    const now = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert("webhookReplay", { nonce: "old", receivedAt: now - 25 * 3600_000 });
      await ctx.db.insert("webhookReplay", { nonce: "new", receivedAt: now - 3600_000 });
    });
    expect(await t.mutation(internal.crons.pruneReplay, {})).toBe(1);
    const left = await t.run((ctx) => ctx.db.query("webhookReplay").collect());
    expect(left.map((r) => r.nonce)).toEqual(["new"]);
  });
});
