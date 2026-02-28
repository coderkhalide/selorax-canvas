import React3 from "react";

import { useRef } from "react";
import { List } from "lucide-react";

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
var extractFirstColor = (color) => {
  if (!color || !color.includes("gradient")) return color;
  const match = color.match(/#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/i);
  return match ? match[0] : "#000000";
};

import * as Icons from "lucide-react";
import { jsx as jsx2 } from "react/jsx-runtime";
var DynamicIcon = ({ name, className, size = 24, color, ...props }) => {
  const IconCmp = Icons[name] || Icons.HelpCircle;
  const style = color?.includes("gradient") ? { color: extractFirstColor(color) } : { color };
  return /* @__PURE__ */ jsx2(IconCmp, { className, size, style, ...props });
};

import { jsx as jsx3, jsxs } from "react/jsx-runtime";
var ListBlockComponent = ({ element, onUpdate, isPreview }) => {
  const {
    list = [],
    layout = "simple",
    // ✅ Layout type
    bulletStyle,
    // New Grouped Style
    // Legacy props fallback
    bulletColor: legacyColor = "var(--color-primary)",
    bulletIcon: legacyIcon = "CheckCircle2",
    textColor = "var(--color-foreground)",
    spacing = "normal",
    cardBgColor = "var(--color-input-background)",
    borderRadius = 8,
    // Legacy props (for backward compatibility)
    dividerStyle,
    showDivider,
    bulletSize,
    listGap
  } = element.data || {};
  const bulletColor = bulletStyle?.color || legacyColor;
  const bulletIcon = bulletStyle?.icon || legacyIcon;
  const elementRef = useRef(element);
  elementRef.current = element;
  const spacingValues = {
    compact: "0.25rem",
    normal: "0.5rem",
    comfortable: "0.75rem"
  };
  const gap = spacingValues[spacing] || "0.5rem";
  if (layout === "boxed") {
    return /* @__PURE__ */ jsx3(
      "div",
      {
        className: `w-full list-${element.id} flex flex-col ${element.className || ""}`,
        style: { gap, ...element.style },
        children: (list || []).map((item, index) => /* @__PURE__ */ jsx3(
          "div",
          {
            className: "p-4 transition-all hover:shadow-md",
            style: {
              background: cardBgColor,
              borderRadius: `${borderRadius}px`,
              border: "1px solid #e5e7eb"
            },
            children: /* @__PURE__ */ jsx3(
              EditableText,
              {
                tagName: "div",
                html: item,
                style: { ...getGradientTextStyle(textColor) },
                editable: !isPreview,
                onBlur: (e) => {
                  const currentElement = elementRef.current;
                  const currentList = currentElement.data?.list || [];
                  const newList = [...currentList];
                  newList[index] = e.currentTarget.innerHTML;
                  if (onUpdate)
                    onUpdate(currentElement.id, {
                      data: { ...currentElement.data, list: newList }
                    });
                }
              }
            )
          },
          index
        ))
      }
    );
  }
  if (layout === "numbered") {
    return /* @__PURE__ */ jsx3(
      "ol",
      {
        className: `w-full list-${element.id} ${element.className || ""}`,
        style: {
          listStyleType: "none",
          padding: 0,
          margin: 0,
          ...element.style
        },
        children: (list || []).map((item, index) => /* @__PURE__ */ jsxs(
          "li",
          {
            className: "flex items-start",
            style: {
              marginBottom: gap,
              gap: "0.75rem"
            },
            children: [
              /* @__PURE__ */ jsx3(
                "span",
                {
                  className: "flex-shrink-0 flex items-center justify-center font-bold rounded-full",
                  style: {
                    background: bulletColor,
                    color: "#ffffff",
                    width: "24px",
                    height: "24px",
                    fontSize: "14px"
                  },
                  children: index + 1
                }
              ),
              /* @__PURE__ */ jsx3(
                EditableText,
                {
                  tagName: "span",
                  html: item,
                  style: { ...getGradientTextStyle(textColor), flex: 1 },
                  editable: !isPreview,
                  onBlur: (e) => {
                    const currentElement = elementRef.current;
                    const currentList = currentElement.data?.list || [];
                    const newList = [...currentList];
                    newList[index] = e.currentTarget.innerHTML;
                    if (onUpdate)
                      onUpdate(currentElement.id, {
                        data: { ...currentElement.data, list: newList }
                      });
                  }
                }
              )
            ]
          },
          index
        ))
      }
    );
  }
  const iconName = bulletIcon || "CheckCircle2";
  const iconSize = bulletSize || 20;
  return /* @__PURE__ */ jsx3(
    "ul",
    {
      className: `w-full list-${element.id} ${element.className || ""}`,
      style: {
        listStyleType: "none",
        padding: 0,
        margin: 0,
        ...element.style
      },
      children: (list || []).map((item, index) => /* @__PURE__ */ jsxs(
        "li",
        {
          className: "flex items-start",
          style: {
            marginBottom: gap,
            gap: "0.75rem",
            // Consistent gap
            ...getGradientTextStyle(textColor)
          },
          children: [
            /* @__PURE__ */ jsx3("span", { className: "flex-shrink-0 mt-0.5", children: /* @__PURE__ */ jsx3(DynamicIcon, { name: iconName, color: bulletColor, size: iconSize }) }),
            /* @__PURE__ */ jsx3(
              EditableText,
              {
                tagName: "span",
                html: item,
                className: "flex-1",
                editable: !isPreview,
                onBlur: (e) => {
                  const currentElement = elementRef.current;
                  const currentList = currentElement.data?.list || [];
                  const newList = [...currentList];
                  newList[index] = e.currentTarget.innerHTML;
                  if (onUpdate)
                    onUpdate(currentElement.id, {
                      data: { ...currentElement.data, list: newList }
                    });
                }
              }
            )
          ]
        },
        index
      ))
    }
  );
};

function listRender({ data, style, className }) {
  const fakeElement = {
    id: "__render__",
    type: "custom",
    name: "list",
    style: style ?? {},
    className: className ?? "",
    data: data ?? {}
  };
  return React3.createElement(ListBlockComponent, {
    element: fakeElement,
    isPreview: true
  });
}
export {
  listRender as default
};
