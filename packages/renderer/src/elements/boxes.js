import React3 from "react";

import { useRef, useEffect } from "react";

import React from "react";
import { jsx } from "react/jsx-runtime";
var EditableText = React.memo(({
  tagName,
  html,
  className,
  style,
  editable,
  onBlur,
  elementRef,
  ...props
}) => {
  const Tag = tagName || "div";
  return /* @__PURE__ */ jsx(
    Tag,
    {
      ref: elementRef,
      className,
      style,
      contentEditable: editable,
      suppressContentEditableWarning: true,
      onBlur,
      dangerouslySetInnerHTML: { __html: html },
      ...props
    }
  );
}, (prevProps, nextProps) => {
  return prevProps.html === nextProps.html && prevProps.editable === nextProps.editable && JSON.stringify(prevProps.style) === JSON.stringify(nextProps.style) && prevProps.className === nextProps.className;
});

import * as Icons from "lucide-react";

var getGradientTextStyle = (color) => {
  if (color?.includes("gradient")) {
    return {
      backgroundImage: color,
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
      color: "transparent",
      WebkitTextFillColor: "transparent"
    };
  }
  return { color };
};

import { jsx as jsx2, jsxs } from "react/jsx-runtime";
var DynamicIcon = ({ name, size = 24, color }) => {
  const IconCmp = Icons[name] || Icons.HelpCircle;
  const isGradient = color?.includes("gradient");
  if (isGradient) {
    return /* @__PURE__ */ jsxs(
      "span",
      {
        style: {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          width: size,
          height: size
        },
        children: [
          /* @__PURE__ */ jsx2(
            "span",
            {
              style: {
                position: "absolute",
                inset: 0,
                background: color,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              },
              children: /* @__PURE__ */ jsx2(IconCmp, { size, stroke: "currentColor", fill: "currentColor" })
            }
          ),
          /* @__PURE__ */ jsx2(IconCmp, { size, style: { opacity: 0 } })
        ]
      }
    );
  }
  return /* @__PURE__ */ jsx2(IconCmp, { size, style: { color } });
};
var BoxesComponent = ({ element, onUpdate, isPreview, deviceView = "desktop" }) => {
  const isMobile = deviceView === "mobile";
  const {
    items = [],
    layout = "grid-2",
    mobileLayout = "carousel",
    cardStyle = "simple",
    // new property
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
    autoplayInterval = 3e3,
    slidesPerViewMobile = 1,
    slidesPerViewDesktop = 3
  } = element.data || {};
  const elementRef = useRef(element);
  elementRef.current = element;
  const sliderRef = useRef(null);
  const getBgStyle = (color) => {
    if (!color) return {};
    if (color.includes("gradient")) return { background: color };
    return { backgroundColor: color };
  };
  const activeLayoutStr = isMobile && mobileLayout ? mobileLayout : layout;
  const isCarousel = activeLayoutStr === "carousel";
  let effectiveCardStyle = cardStyle;
  const styleForcingLayouts = {
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
    "grid-badge-filled": "badge-filled"
  };
  const forcedStyle = styleForcingLayouts[layout];
  if (forcedStyle && (!effectiveCardStyle || effectiveCardStyle === "simple")) {
    effectiveCardStyle = forcedStyle;
  } else if (!effectiveCardStyle) {
    effectiveCardStyle = "simple";
  }
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
    }, Math.max(1e3, autoplayInterval));
    return () => clearInterval(id);
  }, [
    isCarousel,
    enableAutoplay,
    autoplayInterval,
    isMobile,
    gridGap,
    slidesPerViewMobile,
    slidesPerViewDesktop
  ]);
  const renderItem = (item, index, style) => {
    const baseCardStyle = {
      ...getBgStyle(cardBgColor),
      padding: `${pad}px`,
      ...style
    };
    let containerClass = "h-full w-full relative";
    let innerContent = null;
    if (effectiveCardStyle === "simple" || !effectiveCardStyle) {
      containerClass += " rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md";
      innerContent = /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4 h-full", children: [
        item.icon && /* @__PURE__ */ jsx2(
          "div",
          {
            className: "rounded-full flex items-center justify-center shrink-0 overflow-hidden",
            style: {
              backgroundColor: `${accentColor.includes("gradient") ? "rgba(0,0,0,0.05)" : accentColor + "20"}`,
              width: `${iSize + 16}px`,
              height: `${iSize + 16}px`
            },
            children: /* @__PURE__ */ jsx2(DynamicIcon, { name: item.icon, size: iSize, color: accentColor })
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
          /* @__PURE__ */ jsx2(
            EditableText,
            {
              tagName: "h4",
              className: "text-sm font-semibold mb-2",
              style: getGradientTextStyle(titleColor),
              html: item.title,
              editable: !isPreview,
              onBlur: (e) => updateItem(index, "title", e.currentTarget.innerHTML)
            }
          ),
          /* @__PURE__ */ jsx2(
            EditableText,
            {
              tagName: "p",
              className: "text-xs leading-relaxed opacity-90",
              style: getGradientTextStyle(descColor),
              html: item.description,
              editable: !isPreview,
              onBlur: (e) => updateItem(index, "description", e.currentTarget.innerHTML)
            }
          )
        ] })
      ] });
    } else if (effectiveCardStyle === "leaf") {
      containerClass += " rounded-tl-[32px] rounded-br-[32px] rounded-tr-lg rounded-bl-lg border border-gray-100 shadow-sm hover:-translate-y-1 transition-transform duration-300";
      innerContent = /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 h-full", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
          item.icon && /* @__PURE__ */ jsx2(
            "div",
            {
              className: "rounded-2xl flex items-center justify-center",
              style: {
                ...getBgStyle(accentColor),
                width: `${iSize + 20}px`,
                height: `${iSize + 20}px`
              },
              children: /* @__PURE__ */ jsx2(
                DynamicIcon,
                {
                  name: item.icon,
                  size: iSize,
                  color: accentColor.includes("gradient") ? "#ffffff" : "#ffffff"
                }
              )
            }
          ),
          /* @__PURE__ */ jsxs(
            "div",
            {
              className: "text-4xl font-light opacity-10",
              style: { color: accentColor },
              children: [
                "0",
                index + 1
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex-1 mt-2", children: [
          /* @__PURE__ */ jsx2(
            EditableText,
            {
              tagName: "h4",
              className: "text-lg font-bold mb-2",
              style: getGradientTextStyle(titleColor),
              html: item.title,
              editable: !isPreview,
              onBlur: (e) => updateItem(index, "title", e.currentTarget.innerHTML)
            }
          ),
          /* @__PURE__ */ jsx2(
            EditableText,
            {
              tagName: "p",
              className: "text-sm leading-relaxed",
              style: getGradientTextStyle(descColor),
              html: item.description,
              editable: !isPreview,
              onBlur: (e) => updateItem(index, "description", e.currentTarget.innerHTML)
            }
          )
        ] })
      ] });
    } else if (effectiveCardStyle === "soft") {
      baseCardStyle.border = `1px solid ${accentColor}`;
      containerClass += " rounded-xl shadow-sm relative overflow-hidden group";
      innerContent = /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4 h-full relative z-10", children: [
        /* @__PURE__ */ jsx2(
          "div",
          {
            className: "absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-10 transition-transform group-hover:scale-150 duration-500",
            style: { ...getBgStyle(accentColor) }
          }
        ),
        /* @__PURE__ */ jsx2(
          "div",
          {
            className: "rounded-lg flex items-center justify-center shrink-0",
            style: {
              backgroundColor: `${accentColor.includes("gradient") ? "rgba(0,0,0,0.05)" : accentColor + "15"}`,
              width: `${iSize + 12}px`,
              height: `${iSize + 12}px`
            },
            children: /* @__PURE__ */ jsx2(
              DynamicIcon,
              {
                name: item.icon || "Dot",
                size: iSize,
                color: accentColor
              }
            )
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
          /* @__PURE__ */ jsx2(
            EditableText,
            {
              tagName: "h4",
              className: "text-sm font-bold mb-1",
              style: getGradientTextStyle(titleColor),
              html: item.title,
              editable: !isPreview,
              onBlur: (e) => updateItem(index, "title", e.currentTarget.innerHTML)
            }
          ),
          /* @__PURE__ */ jsx2(
            EditableText,
            {
              tagName: "p",
              className: "text-xs leading-relaxed",
              style: getGradientTextStyle(descColor),
              html: item.description,
              editable: !isPreview,
              onBlur: (e) => updateItem(index, "description", e.currentTarget.innerHTML)
            }
          )
        ] })
      ] });
    } else if (effectiveCardStyle === "numbered") {
      containerClass += " rounded-lg border-l-4 shadow-sm bg-white";
      baseCardStyle.borderLeftColor = accentColor;
      innerContent = /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4 h-full", children: [
        /* @__PURE__ */ jsxs(
          "div",
          {
            className: "flex items-center justify-center font-bold text-lg shrink-0",
            style: {
              color: accentColor,
              width: "32px"
            },
            children: [
              index + 1,
              "."
            ]
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
          /* @__PURE__ */ jsx2(
            EditableText,
            {
              tagName: "h4",
              className: "text-sm font-semibold mb-1",
              style: getGradientTextStyle(titleColor),
              html: item.title,
              editable: !isPreview,
              onBlur: (e) => updateItem(index, "title", e.currentTarget.innerHTML)
            }
          ),
          /* @__PURE__ */ jsx2(
            EditableText,
            {
              tagName: "p",
              className: "text-xs leading-relaxed",
              style: getGradientTextStyle(descColor),
              html: item.description,
              editable: !isPreview,
              onBlur: (e) => updateItem(index, "description", e.currentTarget.innerHTML)
            }
          )
        ] })
      ] });
    } else if (effectiveCardStyle === "quote") {
      containerClass += " rounded-2xl border-none shadow-none text-center bg-transparent";
      innerContent = /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center gap-3 h-full px-2", children: [
        item.icon && /* @__PURE__ */ jsx2("div", { className: "mb-2 p-3 rounded-full bg-gray-50 text-gray-400", children: /* @__PURE__ */ jsx2(DynamicIcon, { name: "Quote", size: 20 }) }),
        /* @__PURE__ */ jsx2(
          EditableText,
          {
            tagName: "p",
            className: "text-sm italic leading-relaxed mb-4",
            style: getGradientTextStyle(descColor),
            html: item.description,
            editable: !isPreview,
            onBlur: (e) => updateItem(index, "description", e.currentTarget.innerHTML)
          }
        ),
        /* @__PURE__ */ jsx2(
          "div",
          {
            className: "w-10 h-0.5 mb-2 opacity-30",
            style: { ...getBgStyle(titleColor) }
          }
        ),
        /* @__PURE__ */ jsx2(
          EditableText,
          {
            tagName: "h4",
            className: "text-sm font-bold uppercase tracking-wider",
            style: getGradientTextStyle(titleColor),
            html: item.title,
            editable: !isPreview,
            onBlur: (e) => updateItem(index, "title", e.currentTarget.innerHTML)
          }
        )
      ] });
    } else if (effectiveCardStyle === "outline") {
      baseCardStyle.border = `1px solid ${accentColor}`;
      containerClass += " rounded-lg bg-transparent shadow-none";
      innerContent = /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4 h-full", children: [
        item.icon && /* @__PURE__ */ jsx2(
          "div",
          {
            className: "rounded-full flex items-center justify-center shrink-0",
            style: {
              backgroundColor: `${accentColor.includes("gradient") ? "rgba(0,0,0,0.05)" : accentColor + "10"}`,
              width: `${iSize + 12}px`,
              height: `${iSize + 12}px`
            },
            children: /* @__PURE__ */ jsx2(DynamicIcon, { name: item.icon, size: iSize, color: accentColor })
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
          /* @__PURE__ */ jsx2(
            EditableText,
            {
              tagName: "h4",
              className: "text-sm font-medium mb-2",
              style: getGradientTextStyle(titleColor),
              html: item.title,
              editable: !isPreview,
              onBlur: (e) => updateItem(index, "title", e.currentTarget.innerHTML)
            }
          ),
          /* @__PURE__ */ jsx2(
            EditableText,
            {
              tagName: "p",
              className: "text-xs leading-relaxed",
              style: getGradientTextStyle(descColor),
              html: item.description,
              editable: !isPreview,
              onBlur: (e) => updateItem(index, "description", e.currentTarget.innerHTML)
            }
          )
        ] })
      ] });
    } else if (effectiveCardStyle === "badge") {
      containerClass += " rounded-xl border border-gray-200 shadow-sm relative";
      innerContent = /* @__PURE__ */ jsxs("div", { className: "h-full", children: [
        /* @__PURE__ */ jsx2(
          "div",
          {
            className: "absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
            style: { ...getBgStyle(accentColor), color: "#ffffff" },
            children: index + 1
          }
        ),
        item.icon && /* @__PURE__ */ jsx2("div", { className: "absolute top-3 right-3 opacity-70", children: /* @__PURE__ */ jsx2(
          DynamicIcon,
          {
            name: item.icon,
            size: iSize - 2,
            color: descColor
          }
        ) }),
        /* @__PURE__ */ jsxs("div", { className: "pt-6", children: [
          /* @__PURE__ */ jsx2(
            EditableText,
            {
              tagName: "h4",
              className: "text-sm font-semibold mb-2 text-center",
              style: getGradientTextStyle(titleColor),
              html: item.title,
              editable: !isPreview,
              onBlur: (e) => updateItem(index, "title", e.currentTarget.innerHTML)
            }
          ),
          /* @__PURE__ */ jsx2(
            EditableText,
            {
              tagName: "p",
              className: "text-xs leading-relaxed text-center",
              style: getGradientTextStyle(descColor),
              html: item.description,
              editable: !isPreview,
              onBlur: (e) => updateItem(index, "description", e.currentTarget.innerHTML)
            }
          )
        ] })
      ] });
    } else if (effectiveCardStyle === "badge-filled") {
      baseCardStyle.backgroundColor = `${accentColor.includes("gradient") ? "rgba(0,0,0,0.05)" : accentColor + "10"}`;
      containerClass += " rounded-xl border-none relative";
      innerContent = /* @__PURE__ */ jsxs("div", { className: "h-full", children: [
        /* @__PURE__ */ jsx2(
          "div",
          {
            className: "absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
            style: { ...getBgStyle(accentColor), color: "#ffffff" },
            children: index + 1
          }
        ),
        item.icon && /* @__PURE__ */ jsx2("div", { className: "absolute top-3 right-3 opacity-80", children: /* @__PURE__ */ jsx2(
          DynamicIcon,
          {
            name: item.icon,
            size: iSize - 2,
            color: titleColor
          }
        ) }),
        /* @__PURE__ */ jsxs("div", { className: "pt-6", children: [
          /* @__PURE__ */ jsx2(
            EditableText,
            {
              tagName: "h4",
              className: "text-sm font-semibold mb-2 text-center",
              style: getGradientTextStyle(titleColor),
              html: item.title,
              editable: !isPreview,
              onBlur: (e) => updateItem(index, "title", e.currentTarget.innerHTML)
            }
          ),
          /* @__PURE__ */ jsx2(
            EditableText,
            {
              tagName: "p",
              className: "text-xs leading-relaxed text-center",
              style: getGradientTextStyle(descColor),
              html: item.description,
              editable: !isPreview,
              onBlur: (e) => updateItem(index, "description", e.currentTarget.innerHTML)
            }
          )
        ] })
      ] });
    }
    return /* @__PURE__ */ jsx2("div", { className: containerClass, style: baseCardStyle, children: innerContent }, index);
  };
  const updateItem = (index, field, value) => {
    const cur = elementRef.current;
    const list = cur.data?.items || [];
    const next = [...list];
    next[index] = { ...next[index], [field]: value };
    if (onUpdate) onUpdate(cur.id, { data: { ...cur.data, items: next } });
  };
  if (isCarousel) {
    const slides = isMobile ? slidesPerViewMobile : slidesPerViewDesktop;
    const cardWidthPercent = 100 / Math.max(1, slides);
    return /* @__PURE__ */ jsx2(
      "div",
      {
        ref: sliderRef,
        style: {
          ...element.style,
          display: "flex",
          overflowX: "auto",
          gap: `${gridGap}px`,
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          paddingBottom: "20px"
          // Space for potential shadow clips
        },
        className: "w-full no-scrollbar",
        children: (items || []).map(
          (item, index) => renderItem(item, index, {
            flex: `0 0 ${cardWidthPercent}%`,
            scrollSnapAlign: "start"
          })
        )
      }
    );
  }
  let finalCols = columns || 2;
  if (activeLayoutStr === "grid-3") finalCols = 3;
  if (activeLayoutStr === "grid-4") finalCols = 4;
  const gridCols = isMobile ? mobileColumns : finalCols;
  return /* @__PURE__ */ jsx2(
    "div",
    {
      style: {
        ...element.style,
        display: "grid",
        gridTemplateColumns: isPreview ? `repeat(auto-fit, minmax(200px, 1fr))` : `repeat(${gridCols}, minmax(0, 1fr))`,
        gap: `${gridGap}px`
      },
      className: "w-full",
      children: (items || []).map((item, index) => renderItem(item, index))
    }
  );
};

function boxesRender({ data, style, className }) {
  const fakeElement = {
    id: "__render__",
    type: "custom",
    name: "boxes",
    style: style ?? {},
    className: className ?? "",
    data: data ?? {}
  };
  return React3.createElement(BoxesComponent, {
    element: fakeElement,
    isPreview: true
  });
}
export {
  boxesRender as default
};
