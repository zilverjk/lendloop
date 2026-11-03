import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { identity, makeT } from "./helpers";

describe("users.store idempotency", () => {
  it("returns the same row and creates no duplicates when called repeatedly or concurrently", async () => {
    const t = makeT();
    const as = t.withIdentity(identity("dup"));
    const [a, b] = await Promise.all([as.mutation(api.users.store, {}), as.mutation(api.users.store, {})]);
    const c = await as.mutation(api.users.store, {});
    expect(new Set([a, b, c]).size).toBe(1);
    const rows = await t.run((ctx) => ctx.db.query("users").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("user");
  });
});
