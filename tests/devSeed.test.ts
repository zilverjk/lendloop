import { afterEach, describe, expect, it, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import { makeT } from "./helpers";

afterEach(() => vi.unstubAllEnvs());

describe("devSeed", () => {
  it("refuses to run unless ALLOW_DEV_SEED=true", async () => {
    vi.stubEnv("ALLOW_DEV_SEED", "");
    const t = makeT();
    await expect(t.mutation(internal.devSeed.seedLoan, { scenario: "overdue" })).rejects.toThrow();
    await expect(t.query(internal.devSeed.recentFailures, {})).rejects.toThrow();
  });

  it("seeds an overdue approved loan when enabled", async () => {
    vi.stubEnv("ALLOW_DEV_SEED", "true");
    const t = makeT();
    const { loanId } = await t.mutation(internal.devSeed.seedLoan, { scenario: "overdue" });
    const overdue = await t.query(internal.automation.overdueLoans, {
      today: new Date().toISOString().slice(0, 10),
    });
    expect(overdue.map((o) => o.loanId)).toContain(loanId);
  });
});

describe("devSeed cleanup and demo", () => {
  async function seedWithRows(t: ReturnType<typeof makeT>) {
    const { loanId } = await t.mutation(internal.devSeed.seedLoan, { scenario: "pending" });
    const toolId = await t.run(async (ctx) => (await ctx.db.get(loanId))!.toolId);
    await t.run(async (ctx) => {
      await ctx.db.insert("automationEvents", {
        loanId,
        kind: "notification_sent",
        channel: "email",
        idempotencyKey: `notify:${loanId}`,
        createdAt: Date.now(),
      });
      await ctx.db.insert("auditLogs", {
        actorLabel: "test",
        action: "tool.removed",
        targetType: "tool",
        targetId: toolId,
        metadata: {},
        createdAt: Date.now(),
      });
    });
    return { loanId, toolId };
  }

  it("cleanup refuses without ALLOW_DEV_SEED", async () => {
    vi.stubEnv("ALLOW_DEV_SEED", "");
    const t = makeT();
    await expect(t.mutation(internal.devSeed.cleanup, {})).rejects.toThrow();
    await expect(t.mutation(internal.devSeed.demo, {})).rejects.toThrow();
  });

  it("cleanup removes seeded tool, loan and dependent rows and returns counts", async () => {
    vi.stubEnv("ALLOW_DEV_SEED", "true");
    const t = makeT();
    const { loanId, toolId } = await seedWithRows(t);
    const dry = await t.mutation(internal.devSeed.cleanup, { dryRun: true });
    expect(dry.tools).toBe(1);
    expect(await t.run((ctx) => ctx.db.get(toolId))).not.toBeNull();
    const res = await t.mutation(internal.devSeed.cleanup, {});
    expect(res).toMatchObject({ tools: 1, loans: 1, outboundEvents: 1, automationEvents: 1, auditLogs: 1 });
    expect(await t.run((ctx) => ctx.db.get(toolId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(loanId))).toBeNull();
    const left = await t.run(async (ctx) => ({
      o: await ctx.db.query("outboundEvents").collect(),
      a: await ctx.db.query("automationEvents").collect(),
      l: await ctx.db.query("auditLogs").collect(),
      u: await ctx.db.query("users").collect(),
    }));
    expect(left.o).toHaveLength(0);
    expect(left.a).toHaveLength(0);
    expect(left.l).toHaveLength(0);
    expect(left.u.length).toBe(2);
  });

  it("cleanup with toolIds leaves other tools alone", async () => {
    vi.stubEnv("ALLOW_DEV_SEED", "true");
    const t = makeT();
    const a = await seedWithRows(t);
    await new Promise((r) => setTimeout(r, 5));
    const b = await seedWithRows(t);
    const res = await t.mutation(internal.devSeed.cleanup, { toolIds: [a.toolId] });
    expect(res.tools).toBe(1);
    expect(await t.run((ctx) => ctx.db.get(a.toolId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(b.toolId))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(b.loanId))).not.toBeNull();
  });

  it("cleanup without toolIds keeps non-test tools", async () => {
    vi.stubEnv("ALLOW_DEV_SEED", "true");
    const t = makeT();
    await seedWithRows(t);
    await t.mutation(internal.devSeed.demo, {});
    const before = await t.run((ctx) => ctx.db.query("tools").collect());
    await t.mutation(internal.devSeed.cleanup, {});
    const after = await t.run((ctx) => ctx.db.query("tools").collect());
    expect(after.length).toBe(before.length - 1);
    expect(after.every((x) => !/^Seed drill \d+$/.test(x.name))).toBe(true);
  });

  it("demo is idempotent", async () => {
    vi.stubEnv("ALLOW_DEV_SEED", "true");
    const t = makeT();
    const first = await t.mutation(internal.devSeed.demo, {});
    expect(first.inserted).toBeGreaterThanOrEqual(8);
    const n = (await t.run((ctx) => ctx.db.query("tools").collect())).length;
    const second = await t.mutation(internal.devSeed.demo, {});
    expect(second.inserted).toBe(0);
    expect((await t.run((ctx) => ctx.db.query("tools").collect())).length).toBe(n);
  });
});
