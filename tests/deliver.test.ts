import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { verifySignature } from "../convex/lib/hmac";
import { dayOffset, makeT, newTool, signIn, type T } from "./helpers";

const SECRET = "outbound-secret";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("N8N_WEBHOOK_URL", "http://n8n.test/webhook/x");
  vi.stubEnv("LENDLOOP_WEBHOOK_SECRET", SECRET);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function seed(t: T) {
  const owner = await signIn(t, "owner");
  const borrower = await signIn(t, "borrower");
  const toolId = await owner.as.mutation(api.tools.create, newTool);
  await borrower.as.mutation(api.loans.request, { toolId, startDate: dayOffset(1), endDate: dayOffset(2) });
  const ev = await t.run((ctx) => ctx.db.query("outboundEvents").first());
  return ev!._id;
}

describe("notifications.deliver", () => {
  it("POSTs a signed, minimal payload and marks the event sent", async () => {
    const t = makeT();
    const id = await seed(t);
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await t.action(internal.notifications.deliver, { outboundEventId: id });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    const body = init.body as string;
    expect((await verifySignature(SECRET, body, headers["X-LendLoop-Signature"], Math.floor(Date.now() / 1000))).ok).toBe(true);
    const payload = JSON.parse(body);
    expect(payload.type).toBe("loan.requested");
    expect(payload.recipient.email).toBe("owner@example.com");
    expect(body).not.toContain("18V");
    expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("sent");
  });

  it("retries with backoff then fails permanently and records automation_failed", async () => {
    const t = makeT();
    const id = await seed(t);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    for (let i = 1; i <= 4; i++) {
      await t.action(internal.notifications.deliver, { outboundEventId: id });
      const ev = await t.run((ctx) => ctx.db.get(id));
      expect(ev?.status).toBe("pending");
      expect(ev?.attempts).toBe(i);
    }
    await t.action(internal.notifications.deliver, { outboundEventId: id });
    const ev = await t.run((ctx) => ctx.db.get(id));
    expect(ev?.status).toBe("failed");
    expect(ev?.attempts).toBe(5);
    const evs = await t.run((ctx) => ctx.db.query("automationEvents").collect());
    expect(evs.map((e) => e.kind)).toEqual(["automation_failed"]);
  });

  it("does not crash and marks failed when webhook is not configured", async () => {
    vi.stubEnv("N8N_WEBHOOK_URL", "");
    const t = makeT();
    const id = await seed(t);
    await t.action(internal.notifications.deliver, { outboundEventId: id });
    expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("failed");
  });
});
