import { describe, it, expect } from "vitest";
import type { FunnelElement } from "@/types";
import {
  removeElementById,
  findElementById,
  updateElementById,
} from "../FunnelContext";

// ─── Fixtures ───────────────────────────────────────────────────────────────

function el(id: string, children?: FunnelElement[]): FunnelElement {
  return { id, type: "section", name: id, style: {}, children };
}

const FLAT = [el("a"), el("b"), el("c")];

const NESTED = [
  el("root", [
    el("child1"),
    el("child2", [el("grandchild")]),
  ]),
  el("sibling"),
];

// ─── removeElementById ────────────────────────────────────────────────────────

describe("removeElementById", () => {
  it("removes a top-level element", () => {
    const result = removeElementById(FLAT, "b");
    expect(result.map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("removes a deeply nested element", () => {
    const result = removeElementById(NESTED, "grandchild");
    const child2 = result[0].children?.[1];
    expect(child2?.children).toHaveLength(0);
  });

  it("removes a direct child", () => {
    const result = removeElementById(NESTED, "child1");
    expect(result[0].children?.map((c) => c.id)).toEqual(["child2"]);
  });

  it("returns same-length array when id not found", () => {
    const result = removeElementById(FLAT, "nonexistent");
    expect(result).toHaveLength(3);
  });

  it("does not mutate the original array", () => {
    const original = [el("x"), el("y")];
    removeElementById(original, "x");
    expect(original).toHaveLength(2);
  });
});

// ─── findElementById ──────────────────────────────────────────────────────────

describe("findElementById", () => {
  it("finds a top-level element", () => {
    expect(findElementById(FLAT, "b")?.id).toBe("b");
  });

  it("finds a deeply nested element", () => {
    expect(findElementById(NESTED, "grandchild")?.id).toBe("grandchild");
  });

  it("returns null when not found", () => {
    expect(findElementById(FLAT, "z")).toBeNull();
  });

  it("finds an element in the second top-level sibling", () => {
    expect(findElementById(NESTED, "sibling")?.id).toBe("sibling");
  });
});

// ─── updateElementById ────────────────────────────────────────────────────────

describe("updateElementById", () => {
  it("updates a top-level element field", () => {
    const result = updateElementById(FLAT, "b", { name: "renamed" });
    expect(result.find((e) => e.id === "b")?.name).toBe("renamed");
  });

  it("updates a deeply nested element", () => {
    const result = updateElementById(NESTED, "grandchild", { name: "updated" });
    const gc = result[0].children?.[1].children?.[0];
    expect(gc?.name).toBe("updated");
  });

  it("preserves other fields when updating", () => {
    const result = updateElementById(FLAT, "a", { name: "new" });
    const updated = result.find((e) => e.id === "a")!;
    expect(updated.type).toBe("section");
    expect(updated.id).toBe("a");
  });

  it("does not mutate the original array", () => {
    const orig = [el("m"), el("n")];
    updateElementById(orig, "m", { name: "mutated" });
    expect(orig[0].name).toBe("m");
  });
});
