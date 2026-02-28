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
var QuotesComponent = ({ element, onUpdate, isPreview, deviceView = "desktop" }) => {
  const isMobile = deviceView === "mobile";
  const {
    items = [],
    layout = "grid",
    mobileLayout = "carousel",
    bgColor = "var(--color-input-background)",
    textColor = "var(--color-foreground)",
    accentColor = "var(--color-border)",
    quoteMarkColor = "var(--color-primary)",
    gap = 24,
    columns = 3,
    cardPadding = 20,
    mobileColumns = 1,
    mobileGap = 16,
    mobileCardPadding = 16,
    enableAutoplay = true,
    autoplayInterval = 3e3,
    slidesPerViewMobile = 1,
    slidesPerViewDesktop = 3
  } = element.data || {};
  const elementRef = useRef(element);
  elementRef.current = element;
  const sliderRef = useRef(null);
  const activeLayout = isMobile && mobileLayout ? mobileLayout : layout;
  const gridGap = isMobile ? mobileGap : gap;
  const pad = isMobile ? mobileCardPadding : cardPadding;
  const getBgStyle = (color) => {
    if (!color) return {};
    if (color.includes("gradient")) return { background: color };
    return { backgroundColor: color };
  };
  useEffect(() => {
    if (!(activeLayout === "carousel") || !enableAutoplay || !sliderRef.current)
      return;
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
    activeLayout,
    enableAutoplay,
    autoplayInterval,
    isMobile,
    gridGap,
    slidesPerViewMobile,
    slidesPerViewDesktop
  ]);
  const updateItem = (index, field, value) => {
    const cur = elementRef.current;
    const list = cur.data?.items || [];
    const next = [...list];
    next[index] = { ...next[index], [field]: value };
    if (onUpdate) onUpdate(cur.id, { data: { ...cur.data, items: next } });
  };
  const renderQuote = (item, index, style) => {
    const baseStyle = {
      ...getBgStyle(bgColor),
      padding: `${pad}px`,
      ...style
    };
    if (layout === "bubble") {
      return /* @__PURE__ */ jsxs(
        "div",
        {
          className: "rounded-xl relative border border-gray-200 shadow-sm",
          style: baseStyle,
          children: [
            /* @__PURE__ */ jsx2(
              "div",
              {
                className: "absolute left-8 -bottom-3 w-0 h-0",
                style: {
                  borderLeft: "10px solid transparent",
                  borderRight: "10px solid transparent",
                  borderTop: `12px solid ${bgColor}`
                }
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
              /* @__PURE__ */ jsx2(
                Icons.Quote,
                {
                  className: "w-4 h-4",
                  style: { color: quoteMarkColor }
                }
              ),
              /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
                /* @__PURE__ */ jsx2(
                  EditableText,
                  {
                    tagName: "p",
                    className: "text-sm leading-relaxed",
                    style: getGradientTextStyle(textColor),
                    html: item.text,
                    editable: !isPreview,
                    onBlur: (e) => updateItem(index, "text", e.currentTarget.innerHTML)
                  }
                ),
                item.author !== void 0 && /* @__PURE__ */ jsx2(
                  EditableText,
                  {
                    tagName: "p",
                    className: "text-xs mt-2 opacity-80",
                    style: getGradientTextStyle(textColor),
                    html: item.author,
                    editable: !isPreview,
                    onBlur: (e) => updateItem(index, "author", e.currentTarget.innerHTML)
                  }
                )
              ] })
            ] })
          ]
        },
        index
      );
    }
    if (layout === "bordered") {
      return /* @__PURE__ */ jsx2(
        "div",
        {
          className: "rounded-lg border-2",
          style: { ...baseStyle, borderColor: accentColor },
          children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-2", children: [
            /* @__PURE__ */ jsx2(
              Icons.Quote,
              {
                className: "w-4 h-4",
                style: { color: quoteMarkColor }
              }
            ),
            /* @__PURE__ */ jsx2(
              EditableText,
              {
                tagName: "p",
                className: "text-sm leading-relaxed",
                style: getGradientTextStyle(textColor),
                html: item.text,
                editable: !isPreview,
                onBlur: (e) => updateItem(index, "text", e.currentTarget.innerHTML)
              }
            )
          ] })
        },
        index
      );
    }
    if (layout === "minimal") {
      return /* @__PURE__ */ jsx2("div", { className: "rounded-md", style: baseStyle, children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-2", children: [
        /* @__PURE__ */ jsx2(
          Icons.Quote,
          {
            className: "w-4 h-4",
            style: { color: quoteMarkColor }
          }
        ),
        /* @__PURE__ */ jsx2(
          EditableText,
          {
            tagName: "p",
            className: "text-sm",
            style: getGradientTextStyle(textColor),
            html: item.text,
            editable: !isPreview,
            onBlur: (e) => updateItem(index, "text", e.currentTarget.innerHTML)
          }
        )
      ] }) }, index);
    }
    return /* @__PURE__ */ jsx2(
      "div",
      {
        className: "rounded-xl border border-gray-200 shadow-sm",
        style: baseStyle,
        children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
          /* @__PURE__ */ jsx2(Icons.Quote, { className: "w-4 h-4", style: { color: quoteMarkColor } }),
          /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
            /* @__PURE__ */ jsx2(
              EditableText,
              {
                tagName: "p",
                className: "text-sm leading-relaxed",
                style: getGradientTextStyle(textColor),
                html: item.text,
                editable: !isPreview,
                onBlur: (e) => updateItem(index, "text", e.currentTarget.innerHTML)
              }
            ),
            item.author !== void 0 && /* @__PURE__ */ jsx2(
              EditableText,
              {
                tagName: "p",
                className: "text-xs mt-2 opacity-80",
                style: getGradientTextStyle(textColor),
                html: item.author,
                editable: !isPreview,
                onBlur: (e) => updateItem(index, "author", e.currentTarget.innerHTML)
              }
            )
          ] })
        ] })
      },
      index
    );
  };
  if (activeLayout === "carousel") {
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
          WebkitOverflowScrolling: "touch"
        },
        className: "w-full",
        children: (items || []).map(
          (item, index) => renderQuote(item, index, {
            flex: `0 0 ${cardWidthPercent}%`,
            scrollSnapAlign: "start"
          })
        )
      }
    );
  }
  const desktopCols = columns || 3;
  const gridCols = isMobile ? mobileColumns : desktopCols;
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
      children: (items || []).map(
        (item, index) => renderQuote(item, index)
      )
    }
  );
};

function quotesRender({ data, style, className }) {
  const fakeElement = {
    id: "__render__",
    type: "custom",
    name: "quotes",
    style: style ?? {},
    className: className ?? "",
    data: data ?? {}
  };
  return React3.createElement(QuotesComponent, {
    element: fakeElement,
    isPreview: true
  });
}
export {
  quotesRender as default
};
