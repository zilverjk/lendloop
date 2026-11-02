import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { friendlyError } from "../lib/errors";

describe("friendlyError", () => {
  it("includes field for INVALID_INPUT", () => {
    const e = new ConvexError({ code: "INVALID_INPUT", field: "endDate", message: "too long" });
    expect(friendlyError(e)).toBe("End date: too long");
  });
  it("maps codes and unknown errors", () => {
    expect(friendlyError(new ConvexError({ code: "FORBIDDEN" }))).toMatch(/not allowed/i);
    expect(friendlyError(new Error("x"))).toMatch(/went wrong/i);
  });
});
