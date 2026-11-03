import { describe, expect, it } from "vitest";
import { buildBrowseQuery, parseCategory, parseView } from "../lib/view";

describe("parseView", () => {
  it("defaults to grid", () => {
    expect(parseView(null)).toBe("grid");
    expect(parseView(undefined)).toBe("grid");
    expect(parseView("nope")).toBe("grid");
  });
  it("accepts list", () => {
    expect(parseView("list")).toBe("list");
    expect(parseView("grid")).toBe("grid");
  });
});

describe("parseCategory", () => {
  it("returns a known category or empty string", () => {
    expect(parseCategory("garden")).toBe("garden");
    expect(parseCategory("bogus")).toBe("");
    expect(parseCategory(null)).toBe("");
  });
});

describe("buildBrowseQuery", () => {
  it("omits defaults", () => {
    expect(buildBrowseQuery({ view: "grid", category: "" })).toBe("");
  });
  it("includes list view", () => {
    expect(buildBrowseQuery({ view: "list", category: "" })).toBe("?view=list");
  });
  it("includes category", () => {
    expect(buildBrowseQuery({ view: "grid", category: "garden" })).toBe("?category=garden");
  });
  it("preserves both", () => {
    expect(buildBrowseQuery({ view: "list", category: "power_tools" })).toBe("?category=power_tools&view=list");
  });
});
