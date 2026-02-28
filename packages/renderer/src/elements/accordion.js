import React3 from "react";

import { useState, useRef } from "react";

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
var AccordionComponent = ({ element, onUpdate, isPreview }) => {
  const {
    items = [],
    allowMultiple = true,
    titleColor = "var(--color-foreground-heading)",
    contentColor = "var(--color-foreground)",
    borderColor = "var(--color-border, #e5e7eb)",
    backgroundColor = "var(--color-background, #ffffff)",
    activeBackgroundColor = "var(--color-surface, #f9fafb)",
    hoverBackgroundColor = "var(--color-surface-hover, #f3f4f6)",
    borderRadius = 12,
    gap = 12,
    animationDuration = 300
  } = element.data || {};
  const [openItems, setOpenItems] = useState([0]);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const elementRef = useRef(element);
  elementRef.current = element;
  const toggleItem = (index) => {
    if (allowMultiple) {
      if (openItems.includes(index)) {
        setOpenItems(openItems.filter((i) => i !== index));
      } else {
        setOpenItems([...openItems, index]);
      }
    } else {
      if (openItems.includes(index)) {
        setOpenItems([]);
      } else {
        setOpenItems([index]);
      }
    }
  };
  const updateItem = (index, field, value) => {
    const currentElement = elementRef.current;
    const currentItems = currentElement.data?.items || [];
    const newItems = [...currentItems];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };
    if (onUpdate)
      onUpdate(currentElement.id, {
        data: { ...currentElement.data, items: newItems }
      });
  };
  return /* @__PURE__ */ jsx2(
    "div",
    {
      style: {
        ...element.style,
        display: "flex",
        flexDirection: "column",
        gap: `${gap}px`
      },
      className: `w-full ${element.className || ""}`,
      children: items.map((item, index) => {
        const isOpen = openItems.includes(index);
        const isHovered = hoveredIndex === index;
        let bgColor = backgroundColor;
        if (isOpen) {
          bgColor = activeBackgroundColor;
        } else if (isHovered) {
          bgColor = hoverBackgroundColor;
        }
        return /* @__PURE__ */ jsxs(
          "div",
          {
            className: "border overflow-hidden",
            style: {
              borderColor,
              borderRadius: `${borderRadius}px`,
              backgroundColor: bgColor,
              transition: `all ${animationDuration}ms ease`,
              cursor: "pointer"
            },
            onClick: () => toggleItem(index),
            onMouseEnter: () => setHoveredIndex(index),
            onMouseLeave: () => setHoveredIndex(null),
            children: [
              /* @__PURE__ */ jsxs(
                "div",
                {
                  className: "flex items-center justify-between p-4",
                  style: { userSelect: "none" },
                  children: [
                    /* @__PURE__ */ jsx2(
                      EditableText,
                      {
                        tagName: "h3",
                        className: "font-semibold text-lg flex-1 mr-4",
                        style: getGradientTextStyle(titleColor),
                        html: item.title,
                        editable: !isPreview,
                        onBlur: (e) => updateItem(index, "title", e.currentTarget.innerHTML)
                      }
                    ),
                    /* @__PURE__ */ jsx2(
                      "div",
                      {
                        className: "shrink-0 flex items-center justify-center",
                        style: {
                          color: isOpen ? "var(--color-primary, #3b82f6)" : "var(--color-foreground-muted, #6b7280)",
                          transition: `transform ${animationDuration}ms ease, color ${animationDuration}ms ease`,
                          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)"
                        },
                        children: /* @__PURE__ */ jsx2(Icons.ChevronDown, { size: 20, strokeWidth: 2 })
                      }
                    )
                  ]
                }
              ),
              /* @__PURE__ */ jsx2(
                "div",
                {
                  style: {
                    display: "grid",
                    gridTemplateRows: isOpen ? "1fr" : "0fr",
                    transition: `grid-template-rows ${animationDuration}ms ease`
                  },
                  children: /* @__PURE__ */ jsx2("div", { style: { overflow: "hidden" }, children: /* @__PURE__ */ jsx2(
                    "div",
                    {
                      className: "px-4 pb-4 border-t",
                      style: {
                        borderColor,
                        borderTopStyle: "dashed",
                        opacity: isOpen ? 1 : 0,
                        transition: `opacity ${animationDuration}ms ease`
                      },
                      children: /* @__PURE__ */ jsx2(
                        EditableText,
                        {
                          tagName: "div",
                          className: "pt-4 text-base leading-relaxed",
                          style: getGradientTextStyle(contentColor),
                          html: item.content,
                          editable: !isPreview,
                          onBlur: (e) => updateItem(index, "content", e.currentTarget.innerHTML)
                        }
                      )
                    }
                  ) })
                }
              )
            ]
          },
          index
        );
      })
    }
  );
};

function accordionRender({ data, style, className }) {
  const fakeElement = {
    id: "__render__",
    type: "custom",
    name: "accordion",
    style: style ?? {},
    className: className ?? "",
    data: data ?? {}
  };
  return React3.createElement(AccordionComponent, {
    element: fakeElement,
    isPreview: true
  });
}
export {
  accordionRender as default
};
