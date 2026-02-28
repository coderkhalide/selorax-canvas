import React3 from "react";

import { useEffect, useMemo, useRef, useState } from "react";

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
var MarqueeComponent = ({
  element,
  onUpdate,
  isPreview,
  deviceView
}) => {
  const {
    items = [
      "New Season Collections Coming Soon",
      "Last Chance Offer",
      "Buy 1 Get 1 Free Offer Ending Soon \u2013 Order Now"
    ],
    speed = 60,
    mobileSpeed = 50,
    pauseOnHover = true,
    bgColor = "var(--color-primary)",
    textColor = "#ffffff",
    uppercase = true,
    fontWeight = "600",
    showSeparator = true,
    separatorColor = "rgba(255,255,255,0.7)",
    separatorSize = 4,
    itemGap = 24,
    paddingY = 16,
    fontSizeDesktop = 14,
    fontSizeMobile = 12
  } = element.data || {};
  const isMobile = deviceView === "mobile";
  const effectiveSpeed = isMobile ? mobileSpeed ?? speed : speed;
  const fontSize = isMobile ? fontSizeMobile : fontSizeDesktop;
  const elementRef = useRef(element);
  elementRef.current = element;
  const firstSetRef = useRef(null);
  const [duration, setDuration] = useState(20);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const el = firstSetRef.current;
    if (!el) return;
    const contentWidth = el.scrollWidth || el.getBoundingClientRect().width || 400;
    const pxPerSec = Math.max(10, Number(effectiveSpeed) || 60);
    const d = Math.max(1, contentWidth / pxPerSec);
    setDuration(d);
  }, [
    items,
    effectiveSpeed,
    fontSize,
    itemGap,
    separatorSize,
    showSeparator,
    fontWeight,
    textColor
  ]);
  const animName = useMemo(
    () => `marquee_${element.id || "default"}`,
    [element.id]
  );
  const onItemBlur = (index, e) => {
    const cur = elementRef.current;
    const list = cur.data?.items || [];
    const next = [...list];
    next[index] = e.currentTarget.innerHTML;
    if (onUpdate) onUpdate(cur.id, { data: { ...cur.data, items: next } });
  };
  const Dot = () => showSeparator ? /* @__PURE__ */ jsx2(
    "span",
    {
      style: {
        marginLeft: `${itemGap / 2}px`,
        marginRight: `${itemGap / 2}px`,
        width: `${separatorSize}px`,
        height: `${separatorSize}px`,
        borderRadius: `${separatorSize / 2}px`,
        background: separatorColor,
        display: "inline-block"
      }
    }
  ) : /* @__PURE__ */ jsx2("span", { style: { marginLeft: `${itemGap}px` } });
  if (!items || items.length === 0) return null;
  return /* @__PURE__ */ jsxs(
    "div",
    {
      style: {
        ...element.style,
        background: bgColor,
        color: textColor,
        paddingTop: `${paddingY}px`,
        paddingBottom: `${paddingY}px`,
        overflow: "hidden",
        width: "100%"
      },
      onMouseEnter: pauseOnHover ? () => setPaused(true) : void 0,
      onMouseLeave: pauseOnHover ? () => setPaused(false) : void 0,
      className: `${uppercase ? "uppercase" : ""} ${element.className || ""}`,
      children: [
        /* @__PURE__ */ jsx2(
          "style",
          {
            dangerouslySetInnerHTML: {
              __html: `@keyframes ${animName}{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}`
            }
          }
        ),
        /* @__PURE__ */ jsxs(
          "div",
          {
            style: {
              display: "inline-flex",
              whiteSpace: "nowrap",
              willChange: "transform",
              animation: `${animName} ${duration}s linear infinite`,
              animationPlayState: paused ? "paused" : "running"
            },
            children: [
              /* @__PURE__ */ jsx2(
                "div",
                {
                  ref: firstSetRef,
                  style: {
                    display: "inline-flex",
                    alignItems: "center",
                    gap: `${itemGap}px`
                  },
                  children: items.map((message, index) => /* @__PURE__ */ jsxs(
                    "span",
                    {
                      style: {
                        display: "inline-flex",
                        alignItems: "center",
                        fontSize: `${fontSize}px`,
                        fontWeight,
                        color: textColor
                      },
                      children: [
                        /* @__PURE__ */ jsx2(
                          EditableText,
                          {
                            tagName: "span",
                            className: "",
                            style: getGradientTextStyle(textColor),
                            html: message,
                            editable: !isPreview,
                            onBlur: (e) => onItemBlur(index, e)
                          }
                        ),
                        /* @__PURE__ */ jsx2(Dot, {})
                      ]
                    },
                    `item-${index}`
                  ))
                }
              ),
              /* @__PURE__ */ jsx2(
                "div",
                {
                  style: {
                    display: "inline-flex",
                    alignItems: "center",
                    gap: `${itemGap}px`
                  },
                  children: items.map((message, index) => /* @__PURE__ */ jsxs(
                    "span",
                    {
                      style: {
                        display: "inline-flex",
                        alignItems: "center",
                        fontSize: `${fontSize}px`,
                        fontWeight,
                        color: textColor
                      },
                      children: [
                        /* @__PURE__ */ jsx2("span", { dangerouslySetInnerHTML: { __html: message } }),
                        /* @__PURE__ */ jsx2(Dot, {})
                      ]
                    },
                    `dup-${index}`
                  ))
                }
              )
            ]
          }
        )
      ]
    }
  );
};

function marqueeRender({ data, style, className }) {
  const fakeElement = {
    id: "__render__",
    type: "custom",
    name: "marquee",
    style: style ?? {},
    className: className ?? "",
    data: data ?? {}
  };
  return React3.createElement(MarqueeComponent, {
    element: fakeElement,
    isPreview: true
  });
}
export {
  marqueeRender as default
};
