import { describe, it, expect } from "vitest";
import { canvasNodeToElement } from "../nodeConverter";
import type { RawCanvasNode } from "../nodeConverter";

function makeNode(overrides: Partial<RawCanvasNode> = {}): RawCanvasNode {
  return {
    id: "node-1",
    pageId: "page-1",
    tenantId: "store_001",
    parentId: null,
    nodeType: "element",
    order: "0",
    styles: "{}",
    props: "{}",
    settings: "{}",
    ...overrides,
  };
}

describe("canvasNodeToElement", () => {
  // ── id ────────────────────────────────────────────────────────────────────
  it("returns an object with the correct id", () => {
    const el = canvasNodeToElement(makeNode({ id: "abc-123" }));
    expect(el?.id).toBe("abc-123");
  });

  // ── styles ────────────────────────────────────────────────────────────────
  it("parses styles JSON into a style object", () => {
    const el = canvasNodeToElement(
      makeNode({ styles: JSON.stringify({ color: "red", fontSize: "16px" }) })
    );
    expect(el?.style).toEqual({ color: "red", fontSize: "16px" });
  });

  it("returns an empty style object when styles is empty JSON", () => {
    const el = canvasNodeToElement(makeNode({ styles: "{}" }));
    expect(el?.style).toEqual({});
  });

  // ── props / content / name ─────────────────────────────────────────────
  it("extracts content from props", () => {
    const el = canvasNodeToElement(
      makeNode({
        props: JSON.stringify({ content: "Hello world", label: "My Text" }),
      })
    );
    expect(el?.content).toBe("Hello world");
    expect(el?.name).toBe("My Text");
  });

  it("falls back name to type when props has no label", () => {
    // nodeType "element" with no tag in props → toElementType returns "paragraph"
    const el = canvasNodeToElement(makeNode({ props: "{}" }));
    expect(el?.name).toBe("paragraph");
  });

  it("extracts src and placeholder from props", () => {
    const el = canvasNodeToElement(
      makeNode({
        props: JSON.stringify({
          tag: "image",
          src: "https://example.com/img.png",
          placeholder: "Alt text",
        }),
      })
    );
    expect(el?.src).toBe("https://example.com/img.png");
    expect(el?.placeholder).toBe("Alt text");
  });

  // ── settings / breakpoints ─────────────────────────────────────────────
  it("extracts tablet and mobile breakpoints from settings", () => {
    const el = canvasNodeToElement(
      makeNode({
        settings: JSON.stringify({
          breakpoints: { md: { fontSize: "14px" }, sm: { fontSize: "12px" } },
        }),
      })
    );
    expect(el?.tabletStyle).toEqual({ fontSize: "14px" });
    expect(el?.mobileStyle).toEqual({ fontSize: "12px" });
  });

  it("leaves tabletStyle and mobileStyle undefined when no breakpoints", () => {
    const el = canvasNodeToElement(makeNode({ settings: "{}" }));
    expect(el?.tabletStyle).toBeUndefined();
    expect(el?.mobileStyle).toBeUndefined();
  });

  it("extracts customType and data from settings", () => {
    const el = canvasNodeToElement(
      makeNode({
        settings: JSON.stringify({
          customType: "countdown",
          data: { componentUrl: "https://r2.dev/countdown.js" },
        }),
      })
    );
    expect(el?.customType).toBe("countdown");
    expect(el?.data?.componentUrl).toBe("https://r2.dev/countdown.js");
  });

  it("extracts className and schemeId from settings", () => {
    const el = canvasNodeToElement(
      makeNode({
        settings: JSON.stringify({
          className: "hero-section",
          schemeId: "scheme-42",
        }),
      })
    );
    expect(el?.className).toBe("hero-section");
    expect(el?.schemeId).toBe("scheme-42");
  });

  // ── children ───────────────────────────────────────────────────────────
  it("always returns children as undefined (single-node converter)", () => {
    const el = canvasNodeToElement(makeNode());
    expect(el?.children).toBeUndefined();
  });

  // ── error resilience ───────────────────────────────────────────────────
  it("handles malformed styles JSON without throwing", () => {
    expect(() =>
      canvasNodeToElement(makeNode({ styles: "not-json" }))
    ).not.toThrow();
  });

  it("handles malformed props JSON without throwing", () => {
    expect(() =>
      canvasNodeToElement(makeNode({ props: "{invalid}" }))
    ).not.toThrow();
  });

  it("handles malformed settings JSON without throwing", () => {
    expect(() =>
      canvasNodeToElement(makeNode({ settings: "<<bad>>" }))
    ).not.toThrow();
  });

  it("falls back to empty objects when all JSON fields are malformed", () => {
    const el = canvasNodeToElement(
      makeNode({ styles: "bad", props: "bad", settings: "bad" })
    );
    // style defaults to {} when styles parse fails
    expect(el?.style).toEqual({});
    // type defaults to "paragraph" (no tag in empty propsObj)
    expect(el?.type).toBe("paragraph");
  });

  // ── type mapping via toElementType ────────────────────────────────────
  it("maps nodeType=element with no tag to type=paragraph (fallback)", () => {
    const el = canvasNodeToElement(makeNode({ nodeType: "element", props: "{}" }));
    expect(el?.type).toBe("paragraph");
  });

  it("maps nodeType=element + tag=headline to type=headline", () => {
    const el = canvasNodeToElement(
      makeNode({ nodeType: "element", props: JSON.stringify({ tag: "headline" }) })
    );
    expect(el?.type).toBe("headline");
  });

  it("maps nodeType=element + tag=button to type=button", () => {
    const el = canvasNodeToElement(
      makeNode({ nodeType: "element", props: JSON.stringify({ tag: "button" }) })
    );
    expect(el?.type).toBe("button");
  });

  it("maps nodeType=element + tag=image to type=image", () => {
    const el = canvasNodeToElement(
      makeNode({ nodeType: "element", props: JSON.stringify({ tag: "image" }) })
    );
    expect(el?.type).toBe("image");
  });

  it("maps nodeType=element + unknown tag to type=paragraph (fallback)", () => {
    const el = canvasNodeToElement(
      makeNode({ nodeType: "element", props: JSON.stringify({ tag: "div" }) })
    );
    expect(el?.type).toBe("paragraph");
  });

  it("maps nodeType=layout + tag=section to type=section", () => {
    const el = canvasNodeToElement(
      makeNode({ nodeType: "layout", props: JSON.stringify({ tag: "section" }) })
    );
    expect(el?.type).toBe("section");
  });

  it("maps nodeType=layout + tag=row to type=row", () => {
    const el = canvasNodeToElement(
      makeNode({ nodeType: "layout", props: JSON.stringify({ tag: "row" }) })
    );
    expect(el?.type).toBe("row");
  });

  it("maps nodeType=layout + tag=col to type=col", () => {
    const el = canvasNodeToElement(
      makeNode({ nodeType: "layout", props: JSON.stringify({ tag: "col" }) })
    );
    expect(el?.type).toBe("col");
  });

  it("maps nodeType=layout + tag=wrapper to type=wrapper", () => {
    const el = canvasNodeToElement(
      makeNode({ nodeType: "layout", props: JSON.stringify({ tag: "wrapper" }) })
    );
    expect(el?.type).toBe("wrapper");
  });

  it("maps nodeType=layout with no tag to type=section (layout fallback)", () => {
    const el = canvasNodeToElement(
      makeNode({ nodeType: "layout", props: "{}" })
    );
    expect(el?.type).toBe("section");
  });

  it("maps nodeType=component to type=custom", () => {
    const el = canvasNodeToElement(makeNode({ nodeType: "component" }));
    expect(el?.type).toBe("custom");
  });
});
