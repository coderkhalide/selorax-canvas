import type { CSSProperties } from "react";
import type { FunnelElement, ElementType } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Shape matching the generated CanvasNode from module_bindings */
export interface RawCanvasNode {
  id: string;
  pageId: string;
  tenantId: string;
  parentId: string | null | undefined;
  nodeType: string;
  order: string;
  styles: string;   // JSON string
  props: string;    // JSON string
  settings: string; // JSON string
  lockedBy?: string | null;
  componentUrl?: string | null;
}

export type StdbOpType =
  | "insert"
  | "update_styles"
  | "update_props"
  | "update_settings"
  | "move"
  | "delete";

export interface StdbOp {
  type: StdbOpType;
  nodeId: string;
  node?: {
    id: string;
    pageId: string;
    tenantId: string;
    parentId: string | null | undefined;
    nodeType: string;
    order: string;
    styles: string;
    props: string;
    settings: string;
    componentUrl?: string | null;
    componentVersion?: string | null;
    componentId?: string | null;
  };
  styles?: string;
  props?: string;
  settings?: string;
  newParentId?: string | null;
  newOrder?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ElementType ↔ nodeType mapping
// ─────────────────────────────────────────────────────────────────────────────

const LAYOUT_TYPES: ElementType[] = ["section", "row", "col", "wrapper"];
const COMPONENT_TYPES: ElementType[] = ["custom"];

export function toNodeType(
  type: ElementType
): "layout" | "element" | "component" {
  if (LAYOUT_TYPES.includes(type)) return "layout";
  if (COMPONENT_TYPES.includes(type)) return "component";
  return "element";
}

function toElementType(
  nodeType: string,
  props: Record<string, unknown>
): ElementType {
  if (nodeType === "layout") {
    const tag = props.tag as string | undefined;
    if (
      tag === "section" ||
      tag === "row" ||
      tag === "col" ||
      tag === "wrapper"
    )
      return tag;
    return "section";
  }
  if (nodeType === "component") return "custom";
  const tag = props.tag as string | undefined;
  const validTags: ElementType[] = [
    "headline",
    "paragraph",
    "button",
    "image",
    "video",
    "input",
    "icon",
    "user-checkout",
    "skeleton",
  ];
  if (tag && validTags.includes(tag as ElementType)) return tag as ElementType;
  return "paragraph";
}

// ─────────────────────────────────────────────────────────────────────────────
// Flat → Tree
// ─────────────────────────────────────────────────────────────────────────────

type ElWithMeta = FunnelElement & {
  _order: string;
  _parentId: string | null;
  _componentUrl?: string;
};

export function flatNodesToTree(flatNodes: RawCanvasNode[]): FunnelElement[] {
  const nodeMap = new Map<string, ElWithMeta>();

  for (const raw of flatNodes) {
    let stylesObj: Record<string, unknown> = {};
    let propsObj: Record<string, unknown> = {};
    let settingsObj: Record<string, unknown> = {};
    try {
      stylesObj = JSON.parse(raw.styles || "{}");
    } catch {}
    try {
      propsObj = JSON.parse(raw.props || "{}");
    } catch {}
    try {
      settingsObj = JSON.parse(raw.settings || "{}");
    } catch {}

    const elementType = toElementType(raw.nodeType, propsObj);

    const el: ElWithMeta = {
      id: raw.id,
      type: elementType,
      name: (propsObj.label as string) ?? elementType,
      content: propsObj.content as string | undefined,
      src: propsObj.src as string | undefined,
      placeholder: propsObj.placeholder as string | undefined,
      style: stylesObj as CSSProperties,
      tabletStyle: (settingsObj.breakpoints as Record<string, unknown>)
        ?.md as CSSProperties | undefined,
      mobileStyle: (settingsObj.breakpoints as Record<string, unknown>)
        ?.sm as CSSProperties | undefined,
      className: settingsObj.className as string | undefined,
      customType: settingsObj.customType as string | undefined,
      data: settingsObj.data as Record<string, unknown> | undefined,
      schemeId: settingsObj.schemeId as string | undefined,
      children: [],
      _order: raw.order,
      _parentId: raw.parentId ?? null,
      _componentUrl: raw.componentUrl ?? undefined,
    };
    nodeMap.set(raw.id, el);
  }

  // Attach children to parents
  const roots: ElWithMeta[] = [];
  for (const el of nodeMap.values()) {
    if (!el._parentId) {
      roots.push(el);
    } else {
      const parent = nodeMap.get(el._parentId);
      if (parent) {
        parent.children = parent.children ?? [];
        parent.children.push(el);
      } else {
        // Orphan node — treat as root
        roots.push(el);
      }
    }
  }

  // Sort by _order at every level, then strip internal meta
  function sortAndStrip(els: FunnelElement[]): FunnelElement[] {
    return (els as ElWithMeta[])
      .sort((a, b) => a._order.localeCompare(b._order))
      .map(({ _order, _parentId, _componentUrl, children, ...rest }) => ({
        ...rest,
        ...(_componentUrl ? { _componentUrl } : {}),
        children:
          children && children.length > 0
            ? sortAndStrip(children)
            : undefined,
      }));
  }

  return sortAndStrip(roots);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tree → Flat map (for diffing)
// ─────────────────────────────────────────────────────────────────────────────

export interface FlatEntry {
  el: FunnelElement;
  parentId: string | null;
  order: string; // zero-padded sibling index: "000000", "000001", …
  styles: string;
  props: string;
  settings: string;
  nodeType: "layout" | "element" | "component";
}

export function flattenElements(
  elements: FunnelElement[],
  parentId: string | null = null
): Map<string, FlatEntry> {
  const result = new Map<string, FlatEntry>();

  elements.forEach((el, idx) => {
    const order = String(idx).padStart(6, "0");
    const nodeType = toNodeType(el.type);

    const propsObj: Record<string, unknown> = {
      tag: el.type,
      label: el.name,
    };
    if (el.content !== undefined) propsObj.content = el.content;
    if (el.src !== undefined) propsObj.src = el.src;
    if (el.placeholder !== undefined) propsObj.placeholder = el.placeholder;

    const settingsObj: Record<string, unknown> = {};
    if (el.className) settingsObj.className = el.className;
    if (el.customType) settingsObj.customType = el.customType;
    if (el.data) settingsObj.data = el.data;
    if (el.schemeId) settingsObj.schemeId = el.schemeId;
    if (el.tabletStyle || el.mobileStyle) {
      settingsObj.breakpoints = {
        ...(el.tabletStyle ? { md: el.tabletStyle } : {}),
        ...(el.mobileStyle ? { sm: el.mobileStyle } : {}),
      };
    }

    result.set(el.id, {
      el,
      parentId,
      order,
      styles: JSON.stringify(el.style ?? {}),
      props: JSON.stringify(propsObj),
      settings: JSON.stringify(settingsObj),
      nodeType,
    });

    if (el.children?.length) {
      const childMap = flattenElements(el.children, el.id);
      for (const [id, entry] of childMap) {
        result.set(id, entry);
      }
    }
  });

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Diff: prev tree vs next tree → STDB ops
// ─────────────────────────────────────────────────────────────────────────────

export function computeOps(
  prev: FunnelElement[],
  next: FunnelElement[],
  pageId: string,
  tenantId: string
): StdbOp[] {
  const prevMap = flattenElements(prev);
  const nextMap = flattenElements(next);
  const ops: StdbOp[] = [];

  // Inserts: in next but not prev
  for (const [id, entry] of nextMap) {
    if (!prevMap.has(id)) {
      ops.push({
        type: "insert",
        nodeId: id,
        node: {
          id,
          pageId,
          tenantId,
          parentId: entry.parentId,
          nodeType: entry.nodeType,
          order: entry.order,
          styles: entry.styles,
          props: entry.props,
          settings: entry.settings,
          componentUrl: (entry.el as FunnelElement & { _componentUrl?: string })
            ._componentUrl ?? null,
          componentVersion: null,
          componentId: null,
        },
      });
    }
  }

  // Updates and moves: in both prev and next
  for (const [id, nextEntry] of nextMap) {
    const prevEntry = prevMap.get(id);
    if (!prevEntry) continue;

    if (prevEntry.styles !== nextEntry.styles) {
      ops.push({ type: "update_styles", nodeId: id, styles: nextEntry.styles });
    }
    if (prevEntry.props !== nextEntry.props) {
      ops.push({ type: "update_props", nodeId: id, props: nextEntry.props });
    }
    if (prevEntry.settings !== nextEntry.settings) {
      ops.push({
        type: "update_settings",
        nodeId: id,
        settings: nextEntry.settings,
      });
    }
    if (
      prevEntry.parentId !== nextEntry.parentId ||
      prevEntry.order !== nextEntry.order
    ) {
      ops.push({
        type: "move",
        nodeId: id,
        newParentId: nextEntry.parentId,
        newOrder: nextEntry.order,
      });
    }
  }

  // Deletes: in prev but not next
  for (const [id] of prevMap) {
    if (!nextMap.has(id)) {
      ops.push({ type: "delete", nodeId: id });
    }
  }

  return ops;
}
