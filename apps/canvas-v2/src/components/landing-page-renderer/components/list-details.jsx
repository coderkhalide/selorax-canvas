import React, { useRef } from "react";
import { ListOrdered } from "lucide-react";
import { EditableText } from "./EditableText";
import { getGradientTextStyle } from "./styleUtils";
import { DynamicIcon } from "./utils";

/**
 * 2. ListWithDetailsBlock
 */
const ListWithDetailsComponent = ({ element, onUpdate, isPreview }) => {
  const {
    items = [],
    titleColor = "var(--color-foreground-heading)",
    descColor = "var(--color-foreground)",
  } = element.data || {};

  // Fix stale closure issue
  const elementRef = useRef(element);
  elementRef.current = element;

  const normalizedItems = Array.isArray(items) ? items : [];

  return (
    <div
      style={element.style}
      className={`w-full space-y-4 ${element.className || ""}`}
    >
      {normalizedItems.map((item, index) => (
        <div
          key={index}
          className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0"
        >
          <div className="flex items-start gap-3">
            {item.icon && (
              <div className="mt-1 flex-shrink-0">
                <DynamicIcon
                  name={item.icon}
                  color={item.color}
                  size={item.iconSize || 24}
                />
              </div>
            )}
            <div className="flex-1">
              <EditableText
                tagName="h3"
                className="font-semibold text-lg mb-1"
                style={getGradientTextStyle(titleColor)}
                html={item.title}
                editable={!isPreview}
                onBlur={(e) => {
                  const currentElement = elementRef.current;
                  const currentItems = currentElement.data?.items || [];
                  const newItems = [...currentItems];
                  newItems[index] = {
                    ...newItems[index],
                    title: e.currentTarget.innerHTML,
                  };
                  if (onUpdate)
                    onUpdate(currentElement.id, {
                      data: { ...currentElement.data, items: newItems },
                    });
                }}
              />
              <EditableText
                tagName="p"
                className="text-sm leading-relaxed"
                style={getGradientTextStyle(descColor)}
                html={item.description}
                editable={!isPreview}
                onBlur={(e) => {
                  const currentElement = elementRef.current;
                  const currentItems = currentElement.data?.items || [];
                  const newItems = [...currentItems];
                  newItems[index] = {
                    ...newItems[index],
                    description: e.currentTarget.innerHTML,
                  };
                  if (onUpdate)
                    onUpdate(currentElement.id, {
                      data: { ...currentElement.data, items: newItems },
                    });
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const ListWithDetailsDef = {
  name: "Detail List",
  icon: <ListOrdered className="w-4 h-4" />,
  category: "Content",
  component: ListWithDetailsComponent,
  defaultData: {
    items: [
      {
        title: "High Quality",
        description: "Made with premium materials.",
        icon: "Star",
        color: "var(--color-primary)",
        iconSize: 24,
      },
    ],
    titleColor: "var(--color-foreground-heading)",
    descColor: "var(--color-foreground)",
  },
  settings: {
    items: {
      type: "array_object",
      label: "Features",
      itemSchema: {
        title: { type: "text", label: "Title", default: "Feature Title" },
        description: {
          type: "textarea",
          label: "Description",
          default: "Description text.",
        },
        icon: { type: "icon", label: "Icon", default: "Star" },
        color: {
          type: "color",
          label: "Icon Color",
          default: "var(--color-primary)",
        },
        iconSize: {
          type: "number_slider",
          label: "Icon Size",
          min: 12,
          max: 64,
          default: 24,
        },
      },
      defaultItem: {
        title: "New Feature",
        description: "Description",
        icon: "Star",
        color: "var(--color-primary)",
        iconSize: 24,
      },
    },
    titleColor: {
      type: "color",
      label: "Title Color",
      default: "var(--color-foreground-heading)",
    },
    descColor: {
      type: "color",
      label: "Description Color",
      default: "var(--color-foreground)",
    },
  },
};
