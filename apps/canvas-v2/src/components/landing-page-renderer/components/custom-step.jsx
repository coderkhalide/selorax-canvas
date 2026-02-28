import React, { useRef } from "react";
import { EditableText } from "./EditableText";
import * as Icons from "lucide-react";

const StepsComponent = ({
  element,
  onUpdate,
  isPreview,
  deviceView = "desktop",
}) => {
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
    mobileTextSize = 14,
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

    return (
      <div
        key={index}
        className="relative w-full"
        style={{
          ...getBgStyle(stripColor),
          padding: `${pad}px`,
          borderTop: `1px solid ${borderColor}`,
          borderBottom:
            index === items.length - 1 ? `1px solid ${borderColor}` : "none",
        }}
      >
        {layout === "pyramid-left" && (
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: `${w}%`,
              ...getBgStyle(accentColor),
              clipPath: clipLeft,
            }}
          />
        )}
        {layout === "pyramid-right" && (
          <div
            className="absolute inset-y-0 right-0"
            style={{
              width: `${w}%`,
              ...getBgStyle(accentColor),
              clipPath: clipRight,
            }}
          />
        )}
        <EditableText
          tagName="p"
          className="text-center"
          style={{
            color: isTextGradient ? "transparent" : textColor,
            ...(isTextGradient
              ? {
                  backgroundImage: textColor,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }
              : {}),
            fontSize: `${fz}px`,
            lineHeight: 1.5,
            position: "relative",
          }}
          html={item.text}
          editable={!isPreview}
          onBlur={(e) => updateItem(index, e.currentTarget.innerHTML)}
        />
      </div>
    );
  };

  return (
    <div
      style={{
        ...element.style,
        ...getBgStyle(bgColor),
      }}
      className="w-full"
    >
      <div className="flex flex-col" style={{ gap: `${gap}px` }}>
        {(items || []).map((item, index) => renderRow(item, index))}
      </div>
    </div>
  );
};

export const StepsDef = {
  name: "Steps",
  icon: <Icons.AlignJustify className="w-4 h-4" />,
  category: "Content",
  component: StepsComponent,
  defaultData: {
    layout: "pyramid-left",
    items: [
      { text: "পাকস্থলীর কর্ম ক্ষমতা যায়।" },
      { text: "শরীরে রোগজীবাণু প্রবেশের সক্ষমতা বেড়ে যাবে।" },
      { text: "পাকস্থলীর ক্যানসারও হতে পারে।" },
      { text: "পাকস্থলীর পিএইচ পরিবর্তিত হয় যায়।" },
      { text: "রক্তশূন্যতা দেখা দিতে পারে।" },
    ],
    bgColor: "var(--color-input-background)",
    stripColor: "var(--color-input-background)",
    accentColor: "var(--color-border)",
    textColor: "var(--color-foreground)",
    borderColor: "var(--color-border)",
    gap: 8,
    rowPadding: 16,
    textSize: 16,
    mobileRowPadding: 12,
    mobileTextSize: 14,
  },
  settings: {
    layout: {
      type: "select",
      label: "Layout",
      options: [
        { label: "Pyramid Left", value: "pyramid-left" },
        { label: "Pyramid Right", value: "pyramid-right" },
        { label: "Flat", value: "flat" },
      ],
      default: "pyramid-left",
    },
    items: {
      type: "array_object",
      label: "Steps",
      itemSchema: {
        text: { type: "textarea", label: "Text", default: "Step text" },
      },
      defaultItem: { text: "Step text" },
    },
    bgColor: {
      type: "color",
      label: "Background",
      default: "var(--color-input-background)",
    },
    stripColor: {
      type: "color",
      label: "Strip Color",
      default: "var(--color-input-background)",
    },
    accentColor: {
      type: "color",
      label: "Accent",
      default: "var(--color-border)",
    },
    textColor: {
      type: "color",
      label: "Text Color",
      default: "var(--color-foreground)",
    },
    borderColor: {
      type: "color",
      label: "Border",
      default: "var(--color-border)",
    },
    gap: {
      type: "number_slider",
      label: "Gap",
      min: 0,
      max: 24,
      default: 8,
    },
    rowPadding: {
      type: "number_slider",
      label: "Row Padding",
      min: 0,
      max: 40,
      default: 16,
    },
    textSize: {
      type: "number_slider",
      label: "Text Size",
      min: 10,
      max: 28,
      default: 16,
    },
    mobileRowPadding: {
      type: "number_slider",
      label: "Row Padding (Mobile)",
      min: 0,
      max: 32,
      default: 12,
    },
    mobileTextSize: {
      type: "number_slider",
      label: "Text Size (Mobile)",
      min: 10,
      max: 24,
      default: 14,
    },
  },
};
