import React3 from "react";

import { useRef } from "react";

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

import { jsx as jsx2, jsxs } from "react/jsx-runtime";
var StepsComponent = ({ element, onUpdate, isPreview, deviceView = "desktop" }) => {
  const isMobile = deviceView === "mobile";
  const {
    items = [],
    layout = "pyramid-left",
    bgColor = "#f8f6f2",
    stripColor = "#edeae4",
    accentColor = "#e8e2d8",
    textColor = "#4b3b32",
    borderColor = "#d9d5cd",
    gap = 8,
    rowPadding = 16,
    textSize = 16,
    mobileRowPadding = 12,
    mobileTextSize = 14
  } = element.data || {};
  const elementRef = useRef(element);
  elementRef.current = element;
  const pad = isMobile ? mobileRowPadding : rowPadding;
  const fz = isMobile ? mobileTextSize : textSize;
  const getBgStyle = (color) => {
    if (!color) return {};
    if (color.includes("gradient")) return { background: color };
    return { backgroundColor: color };
  };
  const updateItem = (index, value) => {
    const cur = elementRef.current;
    const list = cur.data?.items || [];
    const next = [...list];
    next[index] = { ...next[index], text: value };
    if (onUpdate) onUpdate(cur.id, { data: { ...cur.data, items: next } });
  };
  const wedgeWidth = (idx) => {
    const max = 60;
    const step = items.length > 1 ? max / (items.length - 1) : max;
    const base = layout.includes("pyramid") ? max - idx * step : 0;
    return Math.max(0, Math.min(95, Math.round(base)));
  };
  const renderRow = (item, index) => {
    const w = wedgeWidth(index);
    const clipLeft = `polygon(0 0, ${w}% 0, ${Math.max(
      w - 12,
      0
    )}% 100%, 0% 100%)`;
    const clipRight = `polygon(100% 0, ${100 - w}% 0, ${Math.min(
      100 - w + 12,
      100
    )}% 100%, 100% 100%)`;
    const isTextGradient = textColor?.includes("gradient");
    return /* @__PURE__ */ jsxs(
      "div",
      {
        className: "relative w-full",
        style: {
          ...getBgStyle(stripColor),
          padding: `${pad}px`,
          borderTop: `1px solid ${borderColor}`,
          borderBottom: index === items.length - 1 ? `1px solid ${borderColor}` : "none"
        },
        children: [
          layout === "pyramid-left" && /* @__PURE__ */ jsx2(
            "div",
            {
              className: "absolute inset-y-0 left-0",
              style: {
                width: `${w}%`,
                ...getBgStyle(accentColor),
                clipPath: clipLeft
              }
            }
          ),
          layout === "pyramid-right" && /* @__PURE__ */ jsx2(
            "div",
            {
              className: "absolute inset-y-0 right-0",
              style: {
                width: `${w}%`,
                ...getBgStyle(accentColor),
                clipPath: clipRight
              }
            }
          ),
          /* @__PURE__ */ jsx2(
            EditableText,
            {
              tagName: "p",
              className: "text-center",
              style: {
                color: isTextGradient ? "transparent" : textColor,
                ...isTextGradient ? {
                  backgroundImage: textColor,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent"
                } : {},
                fontSize: `${fz}px`,
                lineHeight: 1.5,
                position: "relative"
              },
              html: item.text,
              editable: !isPreview,
              onBlur: (e) => updateItem(index, e.currentTarget.innerHTML)
            }
          )
        ]
      },
      index
    );
  };
  return /* @__PURE__ */ jsx2(
    "div",
    {
      style: {
        ...element.style,
        ...getBgStyle(bgColor)
      },
      className: "w-full",
      children: /* @__PURE__ */ jsx2("div", { className: "flex flex-col", style: { gap: `${gap}px` }, children: (items || []).map(
        (item, index) => renderRow(item, index)
      ) })
    }
  );
};

function stepsRender({ data, style, className }) {
  const fakeElement = {
    id: "__render__",
    type: "custom",
    name: "steps",
    style: style ?? {},
    className: className ?? "",
    data: data ?? {}
  };
  return React3.createElement(StepsComponent, {
    element: fakeElement,
    isPreview: true
  });
}
export {
  stepsRender as default
};
