import React, { useRef } from "react";
import { List } from "lucide-react";
import { EditableText } from "./EditableText";
import { getGradientTextStyle } from "./styleUtils";
import { DynamicIcon } from "./utils";

/**
 * 1. ListBlock - Supports various layouts!
 */
const ListBlockComponent = ({ element, onUpdate, isPreview }) => {
  const {
    list = [],
    layout = "simple", // ✅ Layout type
    bulletStyle, // New Grouped Style
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
    listGap,
  } = element.data || {};

  const bulletColor = bulletStyle?.color || legacyColor;
  const bulletIcon = bulletStyle?.icon || legacyIcon;

  const elementRef = useRef(element);
  elementRef.current = element;

  // Spacing values
  const spacingValues = {
    compact: "0.25rem",
    normal: "0.5rem",
    comfortable: "0.75rem",
  };
  const gap = spacingValues[spacing] || "0.5rem";

  // ✅ BOXED LAYOUT - Content same, design different!
  if (layout === "boxed") {
    return (
      <div
        className={`w-full list-${element.id} flex flex-col ${element.className || ""}`}
        style={{ gap, ...element.style }}
      >
        {(list || []).map((item, index) => (
          <div
            key={index}
            className="p-4 transition-all hover:shadow-md"
            style={{
              background: cardBgColor,
              borderRadius: `${borderRadius}px`,
              border: "1px solid #e5e7eb",
            }}
          >
            <EditableText
              tagName="div"
              html={item}
              style={{ ...getGradientTextStyle(textColor) }}
              editable={!isPreview}
              onBlur={(e) => {
                const currentElement = elementRef.current;
                const currentList = currentElement.data?.list || [];
                const newList = [...currentList];
                newList[index] = e.currentTarget.innerHTML;
                if (onUpdate)
                  onUpdate(currentElement.id, {
                    data: { ...currentElement.data, list: newList },
                  });
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  // ✅ NUMBERED LAYOUT - Content same, just numbering added!
  if (layout === "numbered") {
    return (
      <ol
        className={`w-full list-${element.id} ${element.className || ""}`}
        style={{
          listStyleType: "none",
          padding: 0,
          margin: 0,
          ...element.style,
        }}
      >
        {(list || []).map((item, index) => (
          <li
            key={index}
            className="flex items-start"
            style={{
              marginBottom: gap,
              gap: "0.75rem",
            }}
          >
            <span
              className="flex-shrink-0 flex items-center justify-center font-bold rounded-full"
              style={{
                background: bulletColor,
                color: "#ffffff",
                width: "24px",
                height: "24px",
                fontSize: "14px",
              }}
            >
              {index + 1}
            </span>
            <EditableText
              tagName="span"
              html={item}
              style={{ ...getGradientTextStyle(textColor), flex: 1 }}
              editable={!isPreview}
              onBlur={(e) => {
                const currentElement = elementRef.current;
                const currentList = currentElement.data?.list || [];
                const newList = [...currentList];
                newList[index] = e.currentTarget.innerHTML;
                if (onUpdate)
                  onUpdate(currentElement.id, {
                    data: { ...currentElement.data, list: newList },
                  });
              }}
            />
          </li>
        ))}
      </ol>
    );
  }

  // ✅ CHECK ICON & DEFAULT LAYOUT - Unified to support Dynamic Icons
  // This handles both "check" layout and "simple" layout (default) by using the selected icon.
  const iconName = bulletIcon || "CheckCircle2";
  const iconSize = bulletSize || 20;

  return (
    <ul
      className={`w-full list-${element.id} ${element.className || ""}`}
      style={{
        listStyleType: "none",
        padding: 0,
        margin: 0,
        ...element.style,
      }}
    >
      {(list || []).map((item, index) => (
        <li
          key={index}
          className="flex items-start"
          style={{
            marginBottom: gap,
            gap: "0.75rem", // Consistent gap
            ...getGradientTextStyle(textColor),
          }}
        >
          <span className="flex-shrink-0 mt-0.5">
            <DynamicIcon name={iconName} color={bulletColor} size={iconSize} />
          </span>
          <EditableText
            tagName="span"
            html={item}
            className="flex-1"
            editable={!isPreview}
            onBlur={(e) => {
              const currentElement = elementRef.current;
              const currentList = currentElement.data?.list || [];
              const newList = [...currentList];
              newList[index] = e.currentTarget.innerHTML;
              if (onUpdate)
                onUpdate(currentElement.id, {
                  data: { ...currentElement.data, list: newList },
                });
            }}
          />
        </li>
      ))}
    </ul>
  );
};

export const ListBlockDef = {
  name: "Simple List",
  icon: <List className="w-4 h-4" />,
  category: "Content",
  component: ListBlockComponent,
  defaultData: {
    list: ["Feature 1", "Feature 2", "Feature 3"],
    bulletStyle: {
      icon: "CheckCircle2",
      color: "var(--color-primary)",
    },
    textColor: "var(--color-foreground)",
    bulletSize: 20,
    dividerStyle: "dashed",
    showDivider: true,
    listGap: 8,
  },
  settings: {
    list: {
      type: "array",
      label: "List Items",
      itemType: "text",
      default: ["Item 1"],
    },
    bulletStyle: {
      type: "icon_group",
      label: "Icon Style",
      default: {
        icon: "CheckCircle2",
        color: "var(--color-primary)",
      },
    },
    textColor: {
      type: "color",
      label: "Text Color",
      default: "var(--color-foreground)",
    },
    bulletSize: {
      type: "number_slider",
      label: "Bullet Size",
      min: 8,
      max: 48,
      step: 1,
      default: 20,
    },
    listGap: {
      type: "number_slider",
      label: "Gap",
      min: 0,
      max: 50,
      step: 1,
      default: 8,
    },
    showDivider: { type: "boolean", label: "Show Divider", default: true },
    dividerStyle: {
      type: "select",
      label: "Divider Style",
      options: [
        { label: "Solid", value: "solid" },
        { label: "Dashed", value: "dashed" },
        { label: "Dotted", value: "dotted" },
      ],
      default: "dashed",
      conditionalDisplay: { field: "showDivider", value: true },
    },
  },
};
