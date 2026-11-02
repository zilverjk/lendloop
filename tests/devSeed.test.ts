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
