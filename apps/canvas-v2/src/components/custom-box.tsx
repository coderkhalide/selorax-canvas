import React, { useRef, useEffect } from "react";
import { CustomComponentDef, FunnelElement } from "../types";
import { EditableText } from "./EditableText";
import * as Icons from "lucide-react";
import { getGradientTextStyle } from "./styleUtils";
// import { useFunnel } from "../context/FunnelContext"; // Removed to avoid circular dependency

const DynamicIcon: React.FC<{
  name: string;
  size?: number;
  color?: string;
}> = ({ name, size = 24, color }) => {
  const IconCmp = (Icons as any)[name] || Icons.HelpCircle;
  const isGradient = color?.includes("gradient");

  if (isGradient) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          width: size,
          height: size,
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
        <IconCmp size={size} style={{ opacity: 0 }} />
      </span>
    );
  }

  return <IconCmp size={size} style={{ color }} />;
};

export const BoxesComponent: React.FC<{
  element: FunnelElement;
  onUpdate?: (id: string, updates: Partial<FunnelElement>) => void;
  isPreview?: boolean;
  deviceView?: "desktop" | "tablet" | "mobile"; // Added prop
}> = ({ element, onUpdate, isPreview, deviceView = "desktop" }) => {
  // const { deviceView } = useFunnel(); // Removed
  const isMobile = deviceView === "mobile";
  const {
    items = [],
    layout = "grid-2",
    mobileLayout = "carousel",
    cardStyle = "simple", // new property
    cardBgColor = "var(--color-input-background)",
    titleColor = "var(--color-foreground-heading)",
    descColor = "var(--color-foreground)",
    accentColor = "var(--color-primary)",
    gap = 24,
    columns = 2,
    cardPadding = 24,
    iconSize = 20,
    mobileColumns = 1,
    mobileGap = 16,
    mobileCardPadding = 16,
    mobileIconSize = 18,
    enableAutoplay = true,
    autoplayInterval = 3000,
    slidesPerViewMobile = 1,
    slidesPerViewDesktop = 3,
  } = element.data || {};

  const elementRef = useRef(element);
  elementRef.current = element;
  const sliderRef = useRef<HTMLDivElement | null>(null);

  // Helper to resolve background color or gradient
  const getBgStyle = (color: string) => {
    if (!color) return {};
    if (color.includes("gradient")) return { background: color };
    return { backgroundColor: color };
  };

  // Determine active layout structure (Grid vs Carousel)
  const activeLayoutStr = isMobile && mobileLayout ? mobileLayout : layout;
  const isCarousel = activeLayoutStr === "carousel";

  // Derive effective card style from direct prop OR layout name
  // Preset layouts (like grid-leaf) STRICTLY enforce the style to ensure previews work correctly.
  let effectiveCardStyle = cardStyle;

  const styleForcingLayouts: Record<string, string> = {
    "grid-leaf": "leaf",
    leaf: "leaf",
    "grid-soft": "soft",
    "boxed-soft": "soft",
    "grid-numbered": "numbered",
    numbered: "numbered",
    "grid-quote": "quote",
    quote: "quote",
    "grid-outline": "outline",
    "grid-badge": "badge",
    "grid-badge-filled": "badge-filled",
  };

  const forcedStyle = styleForcingLayouts[layout];
  if (forcedStyle && (!effectiveCardStyle || effectiveCardStyle === "simple")) {
    // Only force a style when user hasn't explicitly chosen a non-default style
    effectiveCardStyle = forcedStyle;
  } else if (!effectiveCardStyle) {
    // Fallback defaults if needed
    effectiveCardStyle = "simple";
  }

  // Settings based on view
  const gridGap = isMobile ? mobileGap : gap;
  const pad = isMobile ? mobileCardPadding : cardPadding;
  const iSize = isMobile ? mobileIconSize : iconSize;

  useEffect(() => {
    if (!isCarousel || !enableAutoplay || !sliderRef.current) return;
    const el = sliderRef.current;
    const slides = isMobile ? slidesPerViewMobile : slidesPerViewDesktop;
    const id = setInterval(() => {
      const step = el.clientWidth / Math.max(1, slides) + gridGap;
      const nextLeft = el.scrollLeft + step;
      const isAtEnd = nextLeft + el.clientWidth >= el.scrollWidth - 1;
      el.scrollTo({ left: isAtEnd ? 0 : nextLeft, behavior: "smooth" });
    }, Math.max(1000, autoplayInterval));
    return () => clearInterval(id);
  }, [
    isCarousel,
    enableAutoplay,
    autoplayInterval,
    isMobile,
    gridGap,
    slidesPerViewMobile,
    slidesPerViewDesktop,
  ]);

  // Render a single card item based on cardStyle
  const renderItem = (
    item: any,
    index: number,
    style?: React.CSSProperties
  ) => {
    // Common styles
    const baseCardStyle: React.CSSProperties = {
      ...getBgStyle(cardBgColor),
      padding: `${pad}px`,
      ...style,
    };

    // Style specifics
    let containerClass = "h-full w-full relative";
    let innerContent = null;

    // 1. Simple / Standard (Default) - Border + Shadow
    if (effectiveCardStyle === "simple" || !effectiveCardStyle) {
      containerClass +=
        " rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md";
      innerContent = (
        <div className="flex items-start gap-4 h-full">
          {item.icon && (
            <div
              className="rounded-full flex items-center justify-center shrink-0 overflow-hidden"
              style={{
                backgroundColor: `${
                  accentColor.includes("gradient")
                    ? "rgba(0,0,0,0.05)"
                    : accentColor + "20"
                }`,
                width: `${iSize + 16}px`,
                height: `${iSize + 16}px`,
              }}
            >
              <DynamicIcon name={item.icon} size={iSize} color={accentColor} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <EditableText
              tagName="h4"
              className="text-sm font-semibold mb-2"
              style={getGradientTextStyle(titleColor)}
              html={item.title}
              editable={!isPreview}
              onBlur={(e: any) =>
                updateItem(index, "title", e.currentTarget.innerHTML)
              }
            />
            <EditableText
              tagName="p"
              className="text-xs leading-relaxed opacity-90"
              style={getGradientTextStyle(descColor)}
              html={item.description}
              editable={!isPreview}
              onBlur={(e: any) =>
                updateItem(index, "description", e.currentTarget.innerHTML)
              }
            />
          </div>
        </div>
      );
    }
    // 2. Leaf - Organic rounded corners
    else if (effectiveCardStyle === "leaf") {
      containerClass +=
        " rounded-tl-[32px] rounded-br-[32px] rounded-tr-lg rounded-bl-lg border border-gray-100 shadow-sm hover:-translate-y-1 transition-transform duration-300";
      innerContent = (
        <div className="flex flex-col gap-4 h-full">
          <div className="flex items-center justify-between">
            {item.icon && (
              <div
                className="rounded-2xl flex items-center justify-center"
                style={{
                  ...getBgStyle(accentColor),
                  width: `${iSize + 20}px`,
                  height: `${iSize + 20}px`,
                }}
              >
                <DynamicIcon
                  name={item.icon}
                  size={iSize}
                  color={
                    accentColor.includes("gradient") ? "#ffffff" : "#ffffff"
                  }
                />
              </div>
            )}
            <div
              className="text-4xl font-light opacity-10"
              style={{ color: accentColor }}
            >
              0{index + 1}
            </div>
          </div>
          <div className="flex-1 mt-2">
            <EditableText
              tagName="h4"
              className="text-lg font-bold mb-2"
              style={getGradientTextStyle(titleColor)}
              html={item.title}
              editable={!isPreview}
              onBlur={(e: any) =>
                updateItem(index, "title", e.currentTarget.innerHTML)
              }
            />
            <EditableText
              tagName="p"
              className="text-sm leading-relaxed"
              style={getGradientTextStyle(descColor)}
              html={item.description}
              editable={!isPreview}
              onBlur={(e: any) =>
                updateItem(index, "description", e.currentTarget.innerHTML)
              }
            />
          </div>
        </div>
      );
    }
    // 3. Soft / Boxed Soft - Colored border/bg hint
    else if (effectiveCardStyle === "soft") {
      baseCardStyle.border = `1px solid ${accentColor}`;
      containerClass += " rounded-xl shadow-sm relative overflow-hidden group";

      innerContent = (
        <div className="flex items-start gap-4 h-full relative z-10">
          <div
            className="absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-10 transition-transform group-hover:scale-150 duration-500"
            style={{ ...getBgStyle(accentColor) }}
          />
          <div
            className="rounded-lg flex items-center justify-center shrink-0"
            style={{
              backgroundColor: `${
                accentColor.includes("gradient")
                  ? "rgba(0,0,0,0.05)"
                  : accentColor + "15"
              }`,
              width: `${iSize + 12}px`,
              height: `${iSize + 12}px`,
            }}
          >
            <DynamicIcon
              name={item.icon || "Dot"}
              size={iSize}
              color={accentColor}
            />
          </div>
          <div className="flex-1">
            <EditableText
              tagName="h4"
              className="text-sm font-bold mb-1"
              style={getGradientTextStyle(titleColor)}
              html={item.title}
              editable={!isPreview}
              onBlur={(e: any) =>
                updateItem(index, "title", e.currentTarget.innerHTML)
              }
            />
            <EditableText
              tagName="p"
              className="text-xs leading-relaxed"
              style={getGradientTextStyle(descColor)}
              html={item.description}
              editable={!isPreview}
              onBlur={(e: any) =>
                updateItem(index, "description", e.currentTarget.innerHTML)
              }
            />
          </div>
        </div>
      );
    }
    // 4. Numbered - Step style
    else if (effectiveCardStyle === "numbered") {
      containerClass += " rounded-lg border-l-4 shadow-sm bg-white";
      baseCardStyle.borderLeftColor = accentColor;

      innerContent = (
        <div className="flex items-start gap-4 h-full">
          <div
            className="flex items-center justify-center font-bold text-lg shrink-0"
            style={{
              color: accentColor,
              width: "32px",
            }}
          >
            {index + 1}.
          </div>
          <div className="flex-1">
            <EditableText
              tagName="h4"
              className="text-sm font-semibold mb-1"
              style={getGradientTextStyle(titleColor)}
              html={item.title}
              editable={!isPreview}
              onBlur={(e: any) =>
                updateItem(index, "title", e.currentTarget.innerHTML)
              }
            />
            <EditableText
              tagName="p"
              className="text-xs leading-relaxed"
              style={getGradientTextStyle(descColor)}
              html={item.description}
              editable={!isPreview}
              onBlur={(e: any) =>
                updateItem(index, "description", e.currentTarget.innerHTML)
              }
            />
          </div>
        </div>
      );
    }
    // 5. Quote / Centered
    else if (effectiveCardStyle === "quote") {
      containerClass +=
        " rounded-2xl border-none shadow-none text-center bg-transparent";
      // Removing default padding and bg for cleanup if needed, but keeping user settings primarily

      innerContent = (
        <div className="flex flex-col items-center gap-3 h-full px-2">
          {item.icon && (
            <div className="mb-2 p-3 rounded-full bg-gray-50 text-gray-400">
              <DynamicIcon name="Quote" size={20} />
            </div>
          )}
          <EditableText
            tagName="p"
            className="text-sm italic leading-relaxed mb-4"
            style={getGradientTextStyle(descColor)}
            html={item.description}
            editable={!isPreview}
            onBlur={(e: any) =>
              updateItem(index, "description", e.currentTarget.innerHTML)
            }
          />
          <div
            className="w-10 h-0.5 mb-2 opacity-30"
            style={{ ...getBgStyle(titleColor) }}
          ></div>
          <EditableText
            tagName="h4"
            className="text-sm font-bold uppercase tracking-wider"
            style={getGradientTextStyle(titleColor)}
            html={item.title}
            editable={!isPreview}
            onBlur={(e: any) =>
              updateItem(index, "title", e.currentTarget.innerHTML)
            }
          />
        </div>
      );
    }
    // 6. Outline - minimal bordered card
    else if (effectiveCardStyle === "outline") {
      baseCardStyle.border = `1px solid ${accentColor}`;
      containerClass += " rounded-lg bg-transparent shadow-none";
      innerContent = (
        <div className="flex items-start gap-4 h-full">
          {item.icon && (
            <div
              className="rounded-full flex items-center justify-center shrink-0"
              style={{
                backgroundColor: `${
                  accentColor.includes("gradient")
                    ? "rgba(0,0,0,0.05)"
                    : accentColor + "10"
                }`,
                width: `${iSize + 12}px`,
                height: `${iSize + 12}px`,
              }}
            >
              <DynamicIcon name={item.icon} size={iSize} color={accentColor} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <EditableText
              tagName="h4"
              className="text-sm font-medium mb-2"
              style={getGradientTextStyle(titleColor)}
              html={item.title}
              editable={!isPreview}
              onBlur={(e: any) =>
                updateItem(index, "title", e.currentTarget.innerHTML)
              }
            />
            <EditableText
              tagName="p"
              className="text-xs leading-relaxed"
              style={getGradientTextStyle(descColor)}
              html={item.description}
              editable={!isPreview}
              onBlur={(e: any) =>
                updateItem(index, "description", e.currentTarget.innerHTML)
              }
            />
          </div>
        </div>
      );
    }
    // 7. Badge Top - number badge and optional icon
    else if (effectiveCardStyle === "badge") {
      containerClass += " rounded-xl border border-gray-200 shadow-sm relative";
      innerContent = (
        <div className="h-full">
          <div
            className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ ...getBgStyle(accentColor), color: "#ffffff" }}
          >
            {index + 1}
          </div>
          {item.icon && (
            <div className="absolute top-3 right-3 opacity-70">
              <DynamicIcon
                name={item.icon}
                size={iSize - 2}
                color={descColor}
              />
            </div>
          )}
          <div className="pt-6">
            <EditableText
              tagName="h4"
              className="text-sm font-semibold mb-2 text-center"
              style={getGradientTextStyle(titleColor)}
              html={item.title}
              editable={!isPreview}
              onBlur={(e: any) =>
                updateItem(index, "title", e.currentTarget.innerHTML)
              }
            />
            <EditableText
              tagName="p"
              className="text-xs leading-relaxed text-center"
              style={getGradientTextStyle(descColor)}
              html={item.description}
              editable={!isPreview}
              onBlur={(e: any) =>
                updateItem(index, "description", e.currentTarget.innerHTML)
              }
            />
          </div>
        </div>
      );
    }
    // 8. Badge Filled - tinted background with badge
    else if (effectiveCardStyle === "badge-filled") {
      baseCardStyle.backgroundColor = `${
        accentColor.includes("gradient")
          ? "rgba(0,0,0,0.05)"
          : accentColor + "10"
      }`;
      containerClass += " rounded-xl border-none relative";
      innerContent = (
        <div className="h-full">
          <div
            className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ ...getBgStyle(accentColor), color: "#ffffff" }}
          >
            {index + 1}
          </div>
          {item.icon && (
            <div className="absolute top-3 right-3 opacity-80">
              <DynamicIcon
                name={item.icon}
                size={iSize - 2}
                color={titleColor}
              />
            </div>
          )}
          <div className="pt-6">
            <EditableText
              tagName="h4"
              className="text-sm font-semibold mb-2 text-center"
              style={getGradientTextStyle(titleColor)}
              html={item.title}
              editable={!isPreview}
              onBlur={(e: any) =>
                updateItem(index, "title", e.currentTarget.innerHTML)
              }
            />
            <EditableText
              tagName="p"
              className="text-xs leading-relaxed text-center"
              style={getGradientTextStyle(descColor)}
              html={item.description}
              editable={!isPreview}
              onBlur={(e: any) =>
                updateItem(index, "description", e.currentTarget.innerHTML)
              }
            />
          </div>
        </div>
      );
    }

    return (
      <div key={index} className={containerClass} style={baseCardStyle}>
        {innerContent}
      </div>
    );
  };

  const updateItem = (index: number, field: string, value: string) => {
    const cur = elementRef.current;
    const list = cur.data?.items || [];
    const next = [...list];
    next[index] = { ...next[index], [field]: value };
    if (onUpdate) onUpdate(cur.id, { data: { ...cur.data, items: next } });
  };

  // --- Layout Renderers ---

  if (isCarousel) {
    const slides = isMobile ? slidesPerViewMobile : slidesPerViewDesktop;
    const cardWidthPercent = 100 / Math.max(1, slides);
    return (
      <div
        ref={sliderRef}
        style={{
          ...element.style,
          display: "flex",
          overflowX: "auto",
          gap: `${gridGap}px`,
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          paddingBottom: "20px", // Space for potential shadow clips
        }}
        className="w-full no-scrollbar"
      >
        {(items || []).map((item: any, index: number) =>
          renderItem(item, index, {
            flex: `0 0 ${cardWidthPercent}%`,
            scrollSnapAlign: "start",
          })
        )}
      </div>
    );
  }

  // Grid Layout (Default)
  // Calculate columns based on activeLayoutStr (for backward compatibility) or columns prop
  let finalCols = columns || 2;
  if (activeLayoutStr === "grid-3") finalCols = 3;
  if (activeLayoutStr === "grid-4") finalCols = 4;

  const gridCols = isMobile ? mobileColumns : finalCols;
  return (
    <div
      style={{
        ...element.style,
        display: "grid",
        gridTemplateColumns: isPreview
          ? `repeat(auto-fit, minmax(200px, 1fr))`
          : `repeat(${gridCols}, minmax(0, 1fr))`,
        gap: `${gridGap}px`,
      }}
      className="w-full"
    >
      {(items || []).map((item: any, index: number) => renderItem(item, index))}
    </div>
  );
};

export const BoxesDef: CustomComponentDef = {
  name: "Boxes",
  icon: <Icons.LayoutGrid className="w-4 h-4" />,
  category: "Content",
  component: BoxesComponent,
  defaultData: {
    layout: "grid-2",
    mobileLayout: "carousel",
    cardStyle: "simple",
    items: [
      {
        title: "Feature One",
        description:
          "Describe your feature here with a short, punchy sentence.",
        icon: "Star",
      },
      {
        title: "Feature Two",
        description: "Another great benefit of your product or service.",
        icon: "Zap",
      },
      {
        title: "Feature Three",
        description:
          "Highlight unique selling points that matter to your users.",
        icon: "Shield",
      },
    ],
    cardBgColor: "var(--color-input-background)",
    titleColor: "var(--color-foreground-heading)",
    descColor: "var(--color-foreground)",
    accentColor: "var(--color-primary)",
    gap: 24,
    columns: 2,
    cardPadding: 24,
    iconSize: 24,
    mobileColumns: 1,
    mobileGap: 16,
    mobileCardPadding: 16,
    mobileIconSize: 20,
  },
  settings: {
    layout: {
      type: "select",
      label: "Layout Preset",
      options: [
        { label: "Grid 2 ", value: "grid-2" },
        { label: "Grid 3 ", value: "grid-3" },
        { label: "Grid 4 ", value: "grid-4" },
        { label: "Carousel", value: "carousel" },
      ],
      default: "grid-2",
    },
    mobileLayout: {
      type: "select",
      label: "Mobile Layout",
      options: [
        { label: "Grid 1", value: "grid-2" }, // grid-2 logic handles cols via settings, but keeping value for compat
        { label: "Carousel", value: "carousel" },
      ],
      default: "carousel",
      conditionalDisplay: { field: "_device", value: "mobile" },
    },
    cardStyle: {
      type: "select",
      label: "Card Style",
      options: [
        { label: "Simple Box", value: "simple" },
        { label: "Leaf Shape", value: "leaf" },
        { label: "Soft Border", value: "soft" },
        { label: "Step/Numbered", value: "numbered" },
        { label: "Quote Center", value: "quote" },
        { label: "Border Outline", value: "outline" },
        { label: "Badge Top", value: "badge" },
        { label: "Badge Filled", value: "badge-filled" },
      ],
      default: "simple",
    },
    items: {
      type: "array_object",
      label: "Items",
      itemSchema: {
        title: { type: "text", label: "Title", default: "Title" },
        description: {
          type: "textarea",
          label: "Description",
          default: "Description",
        },
        icon: { type: "icon", label: "Icon", default: "Star" },
      },
      defaultItem: { title: "Title", description: "Description", icon: "Star" },
    },
    cardBgColor: {
      type: "color",
      label: "Card Background",
      default: "var(--color-input-background)",
    },
    titleColor: {
      type: "color",
      label: "Title Color",
      default: "var(--color-foreground-heading)",
    },
    descColor: {
      type: "color",
      label: "Text Color",
      default: "var(--color-foreground)",
    },
    accentColor: {
      type: "color",
      label: "Accent Color",
      default: "var(--color-primary)",
    },

    // Desktop Settings
    gap: {
      type: "number_slider",
      label: "Gap",
      min: 0,
      max: 64,
      default: 24,
      conditionalDisplay: { field: "_device", value: "desktop" },
    },
    columns: {
      type: "number_slider",
      label: "Columns",
      min: 1,
      max: 5,
      default: 2,
      conditionalDisplay: { field: "_device", value: "desktop" },
    },
    cardPadding: {
      type: "number_slider",
      label: "Padding",
      min: 0,
      max: 64,
      default: 24,
      conditionalDisplay: { field: "_device", value: "desktop" },
    },
    iconSize: {
      type: "number_slider",
      label: "Icon Size",
      min: 16,
      max: 64,
      default: 24,
      conditionalDisplay: { field: "_device", value: "desktop" },
    },
    slidesPerViewDesktop: {
      type: "number_slider",
      label: "Slides (Desktop)",
      min: 1,
      max: 5,
      default: 3,
      conditionalDisplay: { field: "_device", value: "desktop" },
    },

    // Mobile Settings
    mobileGap: {
      type: "number_slider",
      label: "Gap (Mobile)",
      min: 0,
      max: 40,
      default: 16,
      conditionalDisplay: { field: "_device", value: "mobile" },
    },
    mobileColumns: {
      type: "number_slider",
      label: "Columns (Mobile)",
      min: 1,
      max: 3,
      default: 1,
      conditionalDisplay: { field: "_device", value: "mobile" },
    },
    mobileCardPadding: {
      type: "number_slider",
      label: "Padding (Mobile)",
      min: 0,
      max: 40,
      default: 16,
      conditionalDisplay: { field: "_device", value: "mobile" },
    },
    mobileIconSize: {
      type: "number_slider",
      label: "Icon Size (Mobile)",
      min: 16,
      max: 40,
      default: 20,
      conditionalDisplay: { field: "_device", value: "mobile" },
    },
    slidesPerViewMobile: {
      type: "number_slider",
      label: "Slides (Mobile)",
      min: 1,
      max: 2,
      default: 1,
      conditionalDisplay: { field: "_device", value: "mobile" },
    },

    // General
    enableAutoplay: {
      type: "boolean",
      label: "Autoplay Carousel",
      default: true,
    },
    autoplayInterval: {
      type: "number_slider",
      label: "Autoplay Speed",
      min: 1000,
      max: 8000,
      default: 3000,
    },
  },
};
