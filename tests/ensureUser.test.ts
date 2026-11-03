import { describe, expect, it, vi } from "vitest";
import { createUserEnsurer } from "../lib/ensureUser";

describe("createUserEnsurer", () => {
  it("calls store once for concurrent callers while authenticated", async () => {
    const store = vi.fn().mockResolvedValue("id1");
    const ensurer = createUserEnsurer(store);
    await Promise.all([ensurer.ensure(true), ensurer.ensure(true)]);
    await ensurer.ensure(true);
    expect(store).toHaveBeenCalledTimes(1);
  });

  it("does not call store when not authenticated", async () => {
    const store = vi.fn().mockResolvedValue("id1");
    const ensurer = createUserEnsurer(store);
    await ensurer.ensure(false);
    expect(store).not.toHaveBeenCalled();
  });

  it("calls store again after a sign-out / sign-in cycle", async () => {
    const store = vi.fn().mockResolvedValue("id1");
    const ensurer = createUserEnsurer(store);
    await ensurer.ensure(true);
    await ensurer.ensure(false);
    await ensurer.ensure(true);
    expect(store).toHaveBeenCalledTimes(2);
  });

  it("allows a retry after a failure and rethrows the error", async () => {
    const store = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue("id1");
    const ensurer = createUserEnsurer(store);
    await expect(ensurer.ensure(true)).rejects.toThrow("boom");
    await ensurer.ensure(true);
    expect(store).toHaveBeenCalledTimes(2);
  });
});
