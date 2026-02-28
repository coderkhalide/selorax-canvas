import React, { useRef, useEffect, useMemo, lazy, Suspense } from "react";
import { GripVertical, Copy, Trash2 } from "lucide-react";
import * as Icons from "lucide-react";
import { FunnelElement, DropPosition, DND_RULES, ElementType } from "../types";
import { useFunnel } from "../context/FunnelContext";
import { useAIActivity } from "../context/AIActivityContext";
import { CUSTOM_BLOCKS } from "./custom-registry";
import { EditableText } from "./EditableText";
import { FloatingToolbar } from "./FloatingToolbar";
import { AIWorkingOverlay } from "./AIWorkingOverlay";
import { imageGetUrl, replaceProductPlaceholders } from "@/utils/utils";

// Dynamic Icon Component
const DynamicIcon: React.FC<{
  name: string;
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  elementRef?: any;
}> = ({ name, size = 24, color, className, style, elementRef }) => {
  const IconCmp = (Icons as any)[name] || Icons.HelpCircle;

  // Check if color is a gradient
  const isGradient = color?.includes("gradient");

  if (isGradient) {
    return (
      <span
        ref={elementRef}
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          ...style,
        }}
      >
        <span
          style={{
            position: "absolute",
            inset: 0,
            background: color,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconCmp size={size} stroke="currentColor" fill="currentColor" />
        </span>
        {/* Invisible icon to maintain space */}
        <IconCmp size={size} style={{ opacity: 0 }} />
      </span>
    );
  }

  // For solid colors, use normal rendering
  return (
    <IconCmp
      ref={elementRef}
      size={size}
      className={className}
      style={{ color, ...style }}
    />
  );
};

// ---------------------------------------------------------------------------
// Remote ESM component loader
// Cache avoids re-importing the same URL on every render cycle
// ---------------------------------------------------------------------------
const componentCache = new Map<string, React.LazyExoticComponent<any>>();

function getRemoteComponent(url: string): React.LazyExoticComponent<any> {
  if (!componentCache.has(url)) {
    componentCache.set(
      url,
      lazy(() =>
        // webpackIgnore prevents webpack from trying to bundle the dynamic URL
        import(/* webpackIgnore: true */ url).catch((err) => {
          console.error("[ElementRenderer] Failed to load remote component:", url, err);
          return {
            default: () => (
              <div className="p-2 text-xs text-red-500">
                Failed to load component
              </div>
            ),
          };
        })
      )
    );
  }
  return componentCache.get(url)!;
}

export const ElementRenderer: React.FC<{
  element: FunnelElement;
  parentDirection?: "row" | "column";
  parentType?: string;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  dropTarget: { id: string; position: DropPosition } | null;
  setDropTarget: (
    target: { id: string; position: DropPosition } | null,
  ) => void;
}> = ({
  element,
  parentDirection = "column",
  parentType = "root",
  hoveredId,
  setHoveredId,
  dropTarget,
  setDropTarget,
}) => {
  const {
    selectedId,
    setSelectedId,
    updateElement,
    deleteElement,
    duplicateElement,
    viewMode,
    deviceView,
    draggingType,
    setDraggingType,
    handleDrop,
    addElement,
    schemes,
    selectedProduct,
  } = useFunnel();

  const { getActivityForElement } = useAIActivity();

  const isPreview = viewMode === "preview";
  const elementRef = useRef<HTMLElement>(null);
  const isSelected = selectedId === element.id;
  const isHovered = hoveredId === element.id;

  // AI Activity state
  const aiActivity = getActivityForElement(element.id);
  const isAIWorking = !isPreview && !!aiActivity;

  // Safety fallback for incomplete AI streaming data
  const baseStyle = element.style || {};
  const rawStyle =
    deviceView === "mobile"
      ? { ...baseStyle, ...(element.tabletStyle || {}), ...(element.mobileStyle || {}) }
      : deviceView === "tablet"
        ? { ...baseStyle, ...(element.tabletStyle || {}) }
        : baseStyle;

  // Promote backgroundColor to background to support gradients in theme variables
  const effectiveStyle: React.CSSProperties = useMemo(() => {
    const { backgroundColor, color, ...rest } = rawStyle;
    const style: React.CSSProperties = { ...rest };
    const data = element.data || {};

    // Handle Background Image & Overlay from data
    if (data.backgroundImage) {
      const processedBgImage = replaceProductPlaceholders(
        data.backgroundImage,
        selectedProduct,
      );
      const bgImage = `url('${imageGetUrl(processedBgImage)}')`;
      const overlay = data.backgroundOverlay;

      if (overlay) {
        style.backgroundImage = `linear-gradient(${overlay}, ${overlay}), ${bgImage}`;
      } else {
        style.backgroundImage = bgImage;
      }

      style.backgroundSize = data.backgroundSize || "cover";
      style.backgroundPosition = data.backgroundPosition || "center";
      style.backgroundRepeat = "no-repeat";

      // If background color is set, apply it as background-color (fallback/underlay)
      if (backgroundColor && backgroundColor !== "transparent") {
        style.backgroundColor = backgroundColor;
      }
    } else if (backgroundColor && backgroundColor !== "transparent") {
      style.background = backgroundColor;
    }

    const isTextElement = ["headline", "paragraph", "button", "icon"].includes(
      element.type,
    );
    const isGradientColor =
      typeof color === "string" && color.includes("gradient");

    if (isTextElement && isGradientColor) {
      style.backgroundImage = color;
      style.WebkitBackgroundClip = "text";
      style.WebkitTextFillColor = "transparent";
      style.backgroundClip = "text";
      // We don't set color to transparent here because it might conflict with stroke in icons
      // but for text it's handled by WebkitTextFillColor
    } else {
      style.color = color;
    }

    // Handle Hover Effects
    if (isHovered && data.hoverStyle) {
      const hStyle = data.hoverStyle;
      if (hStyle.color) {
        style.color = hStyle.color;
        // Handle gradient text on hover
        if (hStyle.color.includes("gradient") && isTextElement) {
          style.backgroundImage = hStyle.color;
          style.WebkitBackgroundClip = "text";
          style.WebkitTextFillColor = "transparent";
          style.backgroundClip = "text";
        } else if (isTextElement && isGradientColor) {
          // If returning to non-gradient color from gradient base
          style.backgroundImage = "none";
          style.WebkitBackgroundClip = "unset";
          style.WebkitTextFillColor = "unset";
          style.backgroundClip = "unset";
        }
      }

      if (hStyle.backgroundColor) {
        style.backgroundColor = hStyle.backgroundColor;
        // Ensure background shorthand is updated to override any previous background
        style.background = hStyle.backgroundColor;
        
        if (hStyle.backgroundColor.includes("gradient")) {
          style.backgroundImage = hStyle.backgroundColor;
        } else {
          // If switching to a solid color, ensure no gradient remains
          style.backgroundImage = "none";
        }
      }

      if (hStyle.borderColor) {
        style.borderColor = hStyle.borderColor;
        style.borderStyle = style.borderStyle || "solid";
        style.borderWidth = style.borderWidth || "1px";
      }

      if (hStyle.transition) {
        style.transition = `all ${hStyle.transition} ease-in-out`;
      }
    }

    return style;
  }, [rawStyle, element.type, isHovered, element.data]);

  // Split styles for absolute positioning handling
  const { wrapperStyle, leafStyle } = useMemo(() => {
    if (effectiveStyle.position === "absolute") {
      const { position, top, left, right, bottom, transform, zIndex, ...rest } =
        effectiveStyle;

      return {
        wrapperStyle: {
          position,
          top,
          left,
          right,
          bottom,
          transform,
          zIndex,
        } as React.CSSProperties,
        leafStyle: {
          ...rest,
          position: "static",
          // When absolute, let the leaf fill the wrapper if needed,
          // but mainly we want the wrapper to handle positioning.
        } as React.CSSProperties,
      };
    }

    return {
      wrapperStyle: {} as React.CSSProperties,
      leafStyle: effectiveStyle,
    };
  }, [effectiveStyle]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPreview || !draggingType) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const isContainer = ["section", "wrapper", "row", "col"].includes(
      element.type,
    );
    const isEmpty =
      isContainer && (!element.children || element.children.length === 0);
    let newPosition: DropPosition = "inside";

    if (isEmpty) newPosition = "inside";
    else {
      if (parentDirection === "row") {
        const midX = rect.left + rect.width / 2;
        newPosition = e.clientX < midX ? "before" : "after";
      } else {
        const midY = rect.top + rect.height / 2;
        newPosition = e.clientY < midY ? "before" : "after";
      }
    }

    const targetContainerType =
      newPosition === "inside" ? element.type : parentType;
    let effectiveChildType = draggingType;
    if (effectiveChildType === "col" && targetContainerType !== "row")
      effectiveChildType = "wrapper";
    else if (effectiveChildType === "wrapper" && targetContainerType === "row")
      effectiveChildType = "col";

    const allowed = DND_RULES[targetContainerType] || [];
    if (!allowed.includes(effectiveChildType as ElementType)) {
      setDropTarget(null);
      return;
    }
    setDropTarget({ id: element.id, position: newPosition });
  };

  const onDropWrapper = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropTarget) handleDrop(e, dropTarget.id, dropTarget.position);
    else handleDrop(e, element.id, "inside");
    setDropTarget(null);
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (isPreview) {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    e.dataTransfer.setData("dragId", element.id);
    e.dataTransfer.setData("dragType", element.type);
    e.dataTransfer.effectAllowed = "move";
    setDraggingType(element.type);
    if (elementRef.current)
      e.dataTransfer.setDragImage(elementRef.current, 10, 10);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isPreview) setSelectedId(element.id);
  };

  const handleTextBlur = (e: React.FocusEvent<HTMLElement>) => {
    updateElement(element.id, { content: e.currentTarget.innerHTML });
  };

  const getChildDirection = (): "row" | "column" => {
    if (effectiveStyle.display === "flex")
      return effectiveStyle.flexDirection === "column" ||
        effectiveStyle.flexDirection === "column-reverse"
        ? "column"
        : "row";
    if (effectiveStyle.display === "grid") return "row";
    return "column";
  };
  const childDirection = getChildDirection();

  const commonProps = {
    id: element.id,
    style: leafStyle,
    onClick: handleClick,
    onMouseOver: (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isPreview) setHoveredId(element.id);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isPreview && hoveredId === element.id) setHoveredId(null);
    },
    className: `transition-all duration-75 ${element.className || ""} ${
      ["section", "row", "col", "wrapper"].includes(element.type)
        ? "relative overflow-visible"
        : ""
    } ${
      !isPreview && ["section", "row", "col", "wrapper"].includes(element.type)
        ? "hover:outline hover:outline-1 hover:outline-dashed hover:outline-gray-400"
        : ""
    } ${
      !isPreview && isSelected && ["section", "row", "col", "wrapper"].includes(element.type)
        ? "ring-2 ring-blue-500 ring-inset"
        : ""
    }`,
  };

  const editableProps =
    !isPreview &&
    isSelected &&
    [
      "headline",
      "paragraph",
      "button",
      "user-checkout",
      "checkbox_list_item",
    ].includes(element.type)
      ? {
          editable: true,
          onBlur: handleTextBlur,
          onDragStart: (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
          },
          className: `${commonProps.className} cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded`,
        }
      : { editable: false };

  // Top Toolbar (Restored to Original Design)
  const ActionToolbar = !isPreview && (isSelected || isHovered) && (
    <div
      className="absolute -top-8 left-0 z-50 flex items-center gap-1 animate-in fade-in zoom-in-95 duration-100"
      onClick={(e) => {
        e.stopPropagation();
        setSelectedId(element.id);
      }}
    >
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={() => setDraggingType(null)}
        className="bg-blue-600 text-white p-1.5 rounded-md shadow-sm cursor-grab active:cursor-grabbing flex items-center justify-center hover:bg-blue-700"
        title="Drag"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-3 h-3" />
      </div>

      {/* Change Layout Button - Only for custom components with variants */}
      {element.type === "custom" && element.customType && (
        <div
          className="bg-red-500 text-white p-1.5 rounded-md shadow-sm border border-red-600 cursor-pointer flex items-center justify-center hover:bg-red-600"
          title="Change Layout"
          onClick={(e) => {
            e.stopPropagation();
            // This will be handled by parent component
            const event = new CustomEvent("openLayoutSidebar", {
              detail: { elementId: element.id },
            });
            window.dispatchEvent(event);
          }}
        >
          <Icons.Paintbrush className="w-3 h-3" />
        </div>
      )}

      <div
        className="bg-white text-gray-600 p-1.5 rounded-md shadow-sm border border-gray-200 cursor-pointer flex items-center justify-center hover:text-blue-600 hover:border-blue-400"
        title="Duplicate"
        onClick={(e) => {
          e.stopPropagation();
          duplicateElement(element.id);
        }}
      >
        <Copy className="w-3 h-3" />
      </div>
      <div
        className="bg-white text-gray-600 p-1.5 rounded-md shadow-sm border border-gray-200 cursor-pointer flex items-center justify-center hover:text-red-600 hover:border-red-400"
        title="Delete"
        onClick={(e) => {
          e.stopPropagation();
          deleteElement(element.id);
        }}
      >
        <Trash2 className="w-3 h-3" />
      </div>
      <div className="bg-blue-600 text-white text-[10px] px-2 py-1 rounded-md shadow-sm font-medium select-none pointer-events-none opacity-90">
        {element.name}
      </div>
    </div>
  );

  // Bottom Action Toolbar (Visible ONLY on Select of a SECTION)
  const BottomActionToolbar = !isPreview &&
    isSelected &&
    element.type === "section" && (
      <FloatingToolbar
        onDragStart={handleDragStart}
        onDragEnd={() => setDraggingType(null)}
        onAddClick={() => {
          addElement("section", element.id, "after");
        }}
        onMagicClick={() => {
          const event = new CustomEvent("openAiPanel", {
            detail: { elementId: element.id },
          });
          window.dispatchEvent(event);
        }}
        onLayoutClick={() => {
          // Open component modal for adding a new component to a NEW section
          const event = new CustomEvent("openComponentModal", {
            detail: { elementId: element.id, mode: "create_section" },
          });
          window.dispatchEvent(event);
        }}
        onDuplicateClick={() => duplicateElement(element.id)}
        onDeleteClick={() => deleteElement(element.id)}
        elementName={element.name}
        variant="bottom-bar"
        className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2"
      />
    );

  const isDropTarget = dropTarget?.id === element.id;
  const SelectionOutline =
    !isPreview && isSelected ? (
      <div className="pointer-events-none absolute inset-0 ring-2 ring-blue-500 z-40" />
    ) : null;

  // AI Working Overlay - shows when AI is actively working on this element
  const AIOverlay = isAIWorking && aiActivity ? (
    <AIWorkingOverlay
      activityType={aiActivity.activityType}
      description={aiActivity.description}
    />
  ) : null;

  const DropIndicator = !isPreview &&
    isDropTarget &&
    dropTarget &&
    dropTarget.position !== "inside" && (
      <div
        className={`absolute bg-blue-500 z-50 pointer-events-none ${
          parentDirection === "row"
            ? `top-0 bottom-0 w-1 ${
                dropTarget.position === "before" ? "-left-1" : "-right-1"
              }`
            : `left-0 right-0 h-1 ${
                dropTarget.position === "before" ? "-top-1" : "-bottom-1"
              }`
        }`}
        style={{ boxShadow: "0 0 4px rgba(59, 130, 246, 0.5)" }}
      />
    );
  const DropIndicatorInside = !isPreview &&
    isDropTarget &&
    dropTarget &&
    dropTarget.position === "inside" && (
      <div className="absolute inset-0 bg-blue-50/50 border-2 border-blue-500 border-dashed pointer-events-none z-10" />
    );

  // Carousel hooks must be declared unconditionally to avoid hook order mismatch
  const data = element.data || {};
  const isMobileView = deviceView === "mobile";
  const activeContainerLayout =
    isMobileView && data.mobileContainerLayout
      ? data.mobileContainerLayout
      : data.containerLayout;
  const activeRowLayout =
    isMobileView && data.mobileRowContainerLayout
      ? data.mobileRowContainerLayout
      : data.rowContainerLayout;
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const isCarouselCol =
    element.type === "col" && activeContainerLayout === "carousel";
  const isCarouselRow =
    element.type === "row" && activeRowLayout === "carousel";
  const slidesCol = isMobileView
    ? (data.slidesPerViewMobile ?? 1)
    : (data.slidesPerViewDesktop ?? 3);
  const slidesRow = isMobileView
    ? (data.rowSlidesPerViewMobile ?? 1)
    : (data.rowSlidesPerViewDesktop ?? 3);
  const gapPx = (() => {
    const g = String(effectiveStyle.gap || "0");
    const n = parseInt(g.toString().replace("px", ""));
    return isNaN(n) ? 0 : n;
  })();
  useEffect(() => {
    const isCarousel = isCarouselCol || isCarouselRow;
    const slides = isCarouselCol ? slidesCol : slidesRow;
    if (!isCarousel || !carouselRef.current) return;
    if (!data.enableAutoplay) return;
    const el = carouselRef.current;
    const id = setInterval(
      () => {
        const step = el.clientWidth / Math.max(1, slides) + (gapPx || 0);
        const nextLeft = el.scrollLeft + step;
        const isAtEnd = nextLeft + el.clientWidth >= el.scrollWidth - 1;
        el.scrollTo({ left: isAtEnd ? 0 : nextLeft, behavior: "smooth" });
      },
      Math.max(1000, data.autoplayInterval || 3000),
    );
    return () => clearInterval(id);
  }, [
    isCarouselCol,
    isCarouselRow,
    slidesCol,
    slidesRow,
    gapPx,
    data.enableAutoplay,
    data.autoplayInterval,
  ]);

  if (["section", "wrapper", "row", "col"].includes(element.type)) {
    const ContainerTag = element.type === "section" ? "section" : "div";
    let emptyHint = null;
    if (!isPreview && (!element.children || element.children.length === 0)) {
      emptyHint = (
        <div
          className={`w-full h-full min-h-[50px] border border-dashed rounded flex items-center justify-center text-xs pointer-events-none transition-colors ${
            isDropTarget && dropTarget.position === "inside"
              ? "border-transparent"
              : "border-gray-300/50 bg-gray-50/5 text-gray-400"
          }`}
        >
          Drop Here
        </div>
      );
    }

    // Override grid columns when display is grid
    const computedStyle = { ...effectiveStyle };
    if (
      element.type === "col" &&
      (computedStyle.display === "grid" || activeContainerLayout === "grid")
    ) {
      const cols = isMobileView
        ? (data.gridColumnsMobile ?? undefined)
        : (data.gridColumnsDesktop ?? undefined);
      if (cols) {
        computedStyle.display = "grid";
        computedStyle.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      }
    }

    if (
      element.type === "row" &&
      (computedStyle.display === "grid" || activeRowLayout === "grid")
    ) {
      const cols = isMobileView
        ? (data.rowGridColumnsMobile ?? undefined)
        : (data.rowGridColumnsDesktop ?? undefined);
      if (cols) {
        computedStyle.display = "grid";
        computedStyle.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      }
    }

    // Carousel rendering for columns

    if (isCarouselCol || isCarouselRow) {
      const slides = isCarouselCol ? slidesCol : slidesRow;
      const cardWidthPercent = 100 / Math.max(1, slides);
      return (
        <div
          id={element.id}
          className={`relative ${commonProps.className || ""}`}
          style={{ ...computedStyle }}
          onDragOver={handleDragOver}
          onDrop={onDropWrapper}
          onClick={handleClick}
          onMouseOver={(e) => {
            e.stopPropagation();
            if (!isPreview) setHoveredId(element.id);
          }}
        >
          {ActionToolbar} {BottomActionToolbar} {DropIndicator}{" "}
          {DropIndicatorInside}
          <div
            ref={carouselRef}
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "stretch",
              overflowX: "auto",
              overflowY: "visible",
              gap: `${gapPx}px`,
              scrollSnapType: "x mandatory",
              WebkitOverflowScrolling: "touch",
              paddingTop: "40px",
              paddingBottom: "8px",
              marginTop: "-28px",
            }}
          >
            {element.children?.map((child) => (
              <div
                key={child.id}
                style={{
                  flex: `0 0 ${cardWidthPercent}%`,
                  scrollSnapAlign: "start",
                  maxWidth: "100%",
                }}
              >
                <ElementRenderer
                  element={child}
                  hoveredId={hoveredId}
                  setHoveredId={setHoveredId}
                  dropTarget={dropTarget}
                  setDropTarget={setDropTarget}
                  parentDirection={"row"}
                  parentType={element.type}
                />
              </div>
            ))}
            {emptyHint}
          </div>
        </div>
      );
    }

    // Section-specific theme CSS variables
    const sectionCssVars: React.CSSProperties = {};
    if (element.type === "section" && element.schemeId) {
      const scheme = schemes[element.schemeId];
      if (scheme) {
        Object.entries(scheme.settings).forEach(([key, value]) => {
          const cssVarName = `--color-${key.replace(/_/g, "-")}`;
          (sectionCssVars as any)[cssVarName] = value;
        });
      }
    }

    // Merge section-specific CSS vars with computed style
    // Selection ring is now applied via className (ring-2 ring-blue-500 ring-inset)
    // so we don't need to force position/overflow here
    const finalComputedStyle: React.CSSProperties = {
      ...computedStyle,
      ...sectionCssVars,
    };

    return (
      <ContainerTag
        ref={elementRef as any}
        {...commonProps}
        style={finalComputedStyle}
        onDragOver={handleDragOver}
        onDrop={onDropWrapper}
      >
        {AIOverlay} {ActionToolbar} {BottomActionToolbar} {DropIndicator}{" "}
        {DropIndicatorInside}
        {element.children?.map((child) => (
          <ElementRenderer
            key={child.id}
            element={child}
            hoveredId={hoveredId}
            setHoveredId={setHoveredId}
            dropTarget={dropTarget}
            setDropTarget={setDropTarget}
            parentDirection={childDirection}
            parentType={element.type}
          />
        ))}
        {emptyHint}
      </ContainerTag>
    );
  }

  // Skeleton / Loading State
  if (element.type === "skeleton") {
    return (
      <div className="w-full p-4 border border-blue-200 rounded-lg bg-blue-50/50 animate-pulse flex flex-col gap-3">
        <div className="h-8 bg-blue-200/50 rounded w-full"></div>
        <div className="h-8 bg-blue-200/30 rounded w-full"></div>
        <div className="flex gap-2">
          <div className="h-8 bg-blue-200/40 rounded w-full"></div>
          <div className="h-8 bg-blue-200/40 rounded w-full"></div>
        </div>
        {/* <div className="text-xs text-blue-500 font-medium flex items-center gap-2 mt-2">
          <Icons.Loader2 className="w-3 h-3 animate-spin" />
          Generating Component...
        </div> */}
      </div>
    );
  }

  if (element.type === "custom" && element.customType) {
    const componentUrl = (element.data as any)?.componentUrl as
      | string
      | undefined;

    // Remote ESM path — load component from CDN URL at runtime
    if (componentUrl) {
      const RemoteComp = getRemoteComponent(componentUrl);
      return (
        <div
          className={`relative group w-full ${element.className || ""}`}
          style={wrapperStyle}
          onClick={handleClick}
          onMouseOver={(e) => {
            e.stopPropagation();
            if (!isPreview) setHoveredId(element.id);
          }}
          onDragOver={handleDragOver}
          onDrop={onDropWrapper}
          id={element.id}
        >
          {SelectionOutline} {AIOverlay} {ActionToolbar} {BottomActionToolbar}{" "}
          {DropIndicator}
          <Suspense
            fallback={
              <div className="p-4 text-xs text-gray-400 animate-pulse">
                Loading component...
              </div>
            }
          >
            <RemoteComp
              element={{ ...element, style: leafStyle }}
              onUpdate={updateElement}
              isPreview={isPreview}
              deviceView={deviceView}
            />
          </Suspense>
        </div>
      );
    }

    // Static registry fallback — backwards-compatible with hardcoded components
    const CustomDef = CUSTOM_BLOCKS[element.customType];
    if (CustomDef) {
      return (
        <div
          className={`relative group w-full ${element.className || ""}`}
          style={wrapperStyle}
          onClick={handleClick}
          onMouseOver={(e) => {
            e.stopPropagation();
            if (!isPreview) setHoveredId(element.id);
          }}
          onDragOver={handleDragOver}
          onDrop={onDropWrapper}
          id={element.id}
        >
          {SelectionOutline} {AIOverlay} {ActionToolbar} {BottomActionToolbar}{" "}
          {DropIndicator}
          <CustomDef.component
            element={{ ...element, style: leafStyle }}
            onUpdate={updateElement}
            isPreview={isPreview}
            deviceView={deviceView}
          />
        </div>
      );
    }
  }

  const renderLeaf = () => {
    const processedContent = (content?: string) =>
      replaceProductPlaceholders(content || "", selectedProduct);

    if (element.type === "headline") {
      return (
        <EditableText
          tagName="div"
          elementRef={elementRef}
          html={processedContent(element.content)}
          {...commonProps}
          {...editableProps}
          className={`${
            (editableProps as any)?.className || commonProps.className
          } rich-text`}
        />
      );
    }
    if (element.type === "paragraph") {
      return (
        <EditableText
          tagName="div"
          elementRef={elementRef}
          html={processedContent(element.content)}
          {...commonProps}
          {...editableProps}
          className={`${
            (editableProps as any)?.className || commonProps.className
          } rich-text`}
        />
      );
    }
    if (element.type === "button") {
      const bd = element.data || {};
      const showBefore = !!bd.showIconBefore && !!bd.iconBefore;
      const showAfter = !!bd.showIconAfter && !!bd.iconAfter;
      const iconSize =
        (deviceView === "mobile" && bd.iconSizeMobile) || bd.iconSize || 18;
      const iconGap = bd.iconGap ?? 8;
      const iconColor = bd.iconColor || (rawStyle.color as string) || undefined;
      return (
        <button
          ref={elementRef as any}
          {...commonProps}
          onDragOver={handleDragOver}
          onDrop={onDropWrapper}
        >
          <span
            className="inline-flex items-center"
            style={{ gap: `${iconGap}px` }}
          >
            {showBefore && (
              <DynamicIcon
                name={bd.iconBefore}
                size={iconSize}
                color={iconColor}
              />
            )}
            <EditableText
              tagName="span"
              elementRef={elementRef}
              html={processedContent(element.content)}
              {...editableProps}
              className={`${
                (editableProps as any)?.className || ""
              } inline-block`}
            />
            {showAfter && (
              <DynamicIcon
                name={bd.iconAfter}
                size={iconSize}
                color={iconColor}
              />
            )}
          </span>
        </button>
      );
    }

    if (element.type === "user-checkout") {
      return (
        <div
          ref={elementRef as any}
          {...commonProps}
          onDragOver={handleDragOver}
          onDrop={onDropWrapper}
        >
          <EditableText
            tagName="span"
            elementRef={elementRef}
            html={element.content || "User Checkout Form"}
            {...editableProps}
            className={`${
              (editableProps as any)?.className || ""
            } inline-block`}
          />
        </div>
      );
    }
    if (element.type === "image") {
      const processedSrc = replaceProductPlaceholders(
        element.src || "",
        selectedProduct,
      );
      return (
        <img
          ref={elementRef as any}
          src={imageGetUrl(processedSrc)}
          alt="Placeholder"
          {...commonProps}
        />
      );
    }
    if (element.type === "video") {
      const videoUrl = element.data?.videoUrl;
      const showControls = element.data?.showControls !== false;

      let videoSrc = null;
      let isIframe = false;

      if (videoUrl) {
        if (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")) {
          const videoId =
            videoUrl.split("v=")[1]?.split("&")[0] || videoUrl.split("/").pop();
          videoSrc = `https://www.youtube.com/embed/${videoId}?controls=${
            showControls ? 1 : 0
          }`;
          isIframe = true;
        } else if (videoUrl.includes("vimeo.com")) {
          const videoId = videoUrl.split("/").pop();
          videoSrc = `https://player.vimeo.com/video/${videoId}?controls=${
            showControls ? 1 : 0
          }`;
          isIframe = true;
        } else {
          videoSrc = videoUrl;
        }
      }

      return (
        <div
          ref={elementRef as any}
          {...commonProps}
          className={`relative w-full ${element.className || ""} ${
            !videoSrc ? "bg-gray-200" : ""
          }`}
          style={{
            ...leafStyle,
            minHeight: "200px",
            aspectRatio: leafStyle.aspectRatio || "16/9",
          }}
        >
          {ActionToolbar} {BottomActionToolbar} {DropIndicator}{" "}
          {DropIndicatorInside}
          {videoSrc ? (
            isIframe ? (
              <iframe
                src={videoSrc}
                className="w-full h-full absolute inset-0"
                style={{ border: "none" }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                src={videoSrc}
                controls={showControls}
                className="w-full h-full object-cover absolute inset-0"
              />
            )
          ) : (
            <div className="flex items-center justify-center h-full w-full text-gray-700 absolute inset-0">
              <div className="text-center">
                <span className="text-xl font-bold block mb-2">
                  Video Player
                </span>
                <span className="text-sm text-gray-500">
                  Add a video URL in settings
                </span>
              </div>
            </div>
          )}
          {!isPreview && !isSelected && (
            <div
              className="absolute inset-0 z-10 cursor-pointer"
              onClick={handleClick}
              onMouseOver={(e: React.MouseEvent) => {
                e.stopPropagation();
                setHoveredId(element.id);
              }}
            />
          )}
        </div>
      );
    }
    if (element.type === "input")
      return (
        <div ref={elementRef as any} className="relative w-full">
          <input
            type="text"
            placeholder={element.placeholder || "Enter details..."}
            {...commonProps}
            className="border p-2 rounded w-full"
            readOnly={!isPreview}
          />
        </div>
      );
    if (element.type === "icon") {
      const iconSize =
        element.data?.size || parseInt(element.style?.fontSize as string) || 32;
      const iconColor = rawStyle.color;
      return (
        <DynamicIcon
          elementRef={elementRef}
          name={element.content || "Star"}
          size={iconSize}
          color={iconColor}
          {...commonProps}
        />
      );
    }
    return (
      <div ref={elementRef as any} {...commonProps}>
        {element.content || element.name || ""}
      </div>
    );
  };

  if (["image", "input", "icon"].includes(element.type)) {
    return (
      <div
        className={`relative group w-fit ${element.className || ""}`}
        style={{
          ...wrapperStyle,
          width:
            element.type === "icon"
              ? "fit-content"
              : effectiveStyle.width || "auto",
          height: effectiveStyle.height || "auto",
          display:
            effectiveStyle.display ||
            (element.type === "icon" ? "block" : "inline-block"),
        }}
        onClick={handleClick}
        onMouseOver={(e) => {
          e.stopPropagation();
          if (!isPreview) setHoveredId(element.id);
        }}
        onDragOver={handleDragOver}
        onDrop={onDropWrapper}
        id={element.id}
      >
        {SelectionOutline} {AIOverlay} {ActionToolbar} {BottomActionToolbar} {DropIndicator}{" "}
        {renderLeaf()}
      </div>
    );
  }

  return (
    <div
      className="relative w-fill"
      style={wrapperStyle}
      onMouseOver={(e) => {
        e.stopPropagation();
        if (!isPreview) setHoveredId(element.id);
      }}
      onDragOver={handleDragOver}
      onDrop={onDropWrapper}
    >
      {SelectionOutline} {AIOverlay} {ActionToolbar} {BottomActionToolbar} {DropIndicator}{" "}
      {renderLeaf()}
    </div>
  );
};
