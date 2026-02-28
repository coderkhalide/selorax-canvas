import React3 from "react";

import { useRef } from "react";
import { ListOrdered } from "lucide-react";

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
var ListWithDetailsComponent = ({ element, onUpdate, isPreview }) => {
  const {
    items = [],
    titleColor = "var(--color-foreground-heading)",
    descColor = "var(--color-foreground)"
  } = element.data || {};
  const elementRef = useRef(element);
  elementRef.current = element;
  const normalizedItems = Array.isArray(items) ? items : [];
  return /* @__PURE__ */ jsx3("div", { style: element.style, className: `w-full space-y-4 ${element.className || ""}`, children: normalizedItems.map((item, index) => /* @__PURE__ */ jsx3(
    "div",
    {
      className: "border-b border-gray-200 pb-4 last:border-b-0 last:pb-0",
      children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
        item.icon && /* @__PURE__ */ jsx3("div", { className: "mt-1 flex-shrink-0", children: /* @__PURE__ */ jsx3(
          DynamicIcon,
          {
            name: item.icon,
            color: item.color,
            size: item.iconSize || 24
          }
        ) }),
        /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
          /* @__PURE__ */ jsx3(
            EditableText,
            {
              tagName: "h3",
              className: "font-semibold text-lg mb-1",
              style: getGradientTextStyle(titleColor),
              html: item.title,
              editable: !isPreview,
              onBlur: (e) => {
                const currentElement = elementRef.current;
                const currentItems = currentElement.data?.items || [];
                const newItems = [...currentItems];
                newItems[index] = {
                  ...newItems[index],
                  title: e.currentTarget.innerHTML
                };
                if (onUpdate)
                  onUpdate(currentElement.id, {
                    data: { ...currentElement.data, items: newItems }
                  });
              }
            }
          ),
          /* @__PURE__ */ jsx3(
            EditableText,
            {
              tagName: "p",
              className: "text-sm leading-relaxed",
              style: getGradientTextStyle(descColor),
              html: item.description,
              editable: !isPreview,
              onBlur: (e) => {
                const currentElement = elementRef.current;
                const currentItems = currentElement.data?.items || [];
                const newItems = [...currentItems];
                newItems[index] = {
                  ...newItems[index],
                  description: e.currentTarget.innerHTML
                };
                if (onUpdate)
                  onUpdate(currentElement.id, {
                    data: { ...currentElement.data, items: newItems }
                  });
              }
            }
          )
        ] })
      ] })
    },
    index
  )) });
};

function list_detailsRender({ data, style, className }) {
  const fakeElement = {
    id: "__render__",
    type: "custom",
    name: "list_details",
    style: style ?? {},
    className: className ?? "",
    data: data ?? {}
  };
  return React3.createElement(ListWithDetailsComponent, {
    element: fakeElement,
    isPreview: true
  });
}
export {
  list_detailsRender as default
};
