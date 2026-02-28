import React, { useEffect, useMemo, useRef, useState } from "react";
import { List } from "lucide-react";
import { CustomComponentDef } from "../../types";
import { EditableText } from "../EditableText";
import { getGradientTextStyle } from "../styleUtils";

export const MarqueeComponent: React.FC<any> = ({
  element,
  onUpdate,
  isPreview,
  deviceView,
}) => {
  const {
    items = [
      "New Season Collections Coming Soon",
      "Last Chance Offer",
      "Buy 1 Get 1 Free Offer Ending Soon – Order Now",
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
    fontSizeMobile = 12,
  } = element.data || {};

  const isMobile = deviceView === "mobile";
  const effectiveSpeed = isMobile ? (mobileSpeed ?? speed) : speed;
  const fontSize = isMobile ? fontSizeMobile : fontSizeDesktop;

  const elementRef = useRef(element);
  elementRef.current = element;

  const firstSetRef = useRef<HTMLDivElement | null>(null);
  const [duration, setDuration] = useState<number>(20);
  const [paused, setPaused] = useState<boolean>(false);

  useEffect(() => {
    const el = firstSetRef.current;
    if (!el) return;
    const contentWidth =
      el.scrollWidth || el.getBoundingClientRect().width || 400;
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
    textColor,
  ]);

  const animName = useMemo(
    () => `marquee_${element.id || "default"}`,
    [element.id],
  );

  const onItemBlur = (index: number, e: any) => {
    const cur = elementRef.current;
    const list = cur.data?.items || [];
    const next = [...list];
    next[index] = e.currentTarget.innerHTML;
    if (onUpdate) onUpdate(cur.id, { data: { ...cur.data, items: next } });
  };

  const Dot = () =>
    showSeparator ? (
      <span
        style={{
          marginLeft: `${itemGap / 2}px`,
          marginRight: `${itemGap / 2}px`,
          width: `${separatorSize}px`,
          height: `${separatorSize}px`,
          borderRadius: `${separatorSize / 2}px`,
          background: separatorColor,
          display: "inline-block",
        }}
      />
    ) : (
      <span style={{ marginLeft: `${itemGap}px` }} />
    );

  if (!items || items.length === 0) return null;

  return (
    <div
      style={{
        ...element.style,
        background: bgColor,
        color: textColor,
        paddingTop: `${paddingY}px`,
        paddingBottom: `${paddingY}px`,
        overflow: "hidden",
        width: "100%",
      }}
      onMouseEnter={pauseOnHover ? () => setPaused(true) : undefined}
      onMouseLeave={pauseOnHover ? () => setPaused(false) : undefined}
      className={`${uppercase ? "uppercase" : ""} ${element.className || ""}`}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes ${animName}{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}`,
        }}
      />
      <div
        style={{
          display: "inline-flex",
          whiteSpace: "nowrap",
          willChange: "transform",
          animation: `${animName} ${duration}s linear infinite`,
          animationPlayState: paused ? "paused" : "running",
        }}
      >
        <div
          ref={firstSetRef}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: `${itemGap}px`,
          }}
        >
          {items.map((message: string, index: number) => (
            <span
              key={`item-${index}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                fontSize: `${fontSize}px`,
                fontWeight: fontWeight,
                color: textColor,
              }}
            >
              <EditableText
                tagName="span"
                className=""
                style={getGradientTextStyle(textColor)}
                html={message}
                editable={!isPreview}
                onBlur={(e: any) => onItemBlur(index, e)}
              />
              <Dot />
            </span>
          ))}
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: `${itemGap}px`,
          }}
        >
          {items.map((message: string, index: number) => (
            <span
              key={`dup-${index}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                fontSize: `${fontSize}px`,
                fontWeight: fontWeight,
                color: textColor,
              }}
            >
              <span dangerouslySetInnerHTML={{ __html: message }} />
              <Dot />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export const CustomMarqueeDef: CustomComponentDef = {
  name: "Marquee",
  icon: <List className="w-4 h-4" />,
  category: "Dynamic",
  component: MarqueeComponent,
  defaultData: {
    items: [
      " New Season Collections Coming Soon",
      "Last Chance Offer",
      "Buy 1 Get 1 Free Offer Ending Soon – Order Now",
    ],
    speed: 60,
    mobileSpeed: 50,
    pauseOnHover: true,
    bgColor: "var(--color-primary)",
    textColor: "#ffffff",
    uppercase: true,
    fontWeight: "600",
    showSeparator: true,
    separatorColor: "rgba(255,255,255,0.7)",
    separatorSize: 4,
    itemGap: 24,
    paddingY: 16,
    fontSizeDesktop: 14,
    fontSizeMobile: 12,
  },
  settings: {
    items: {
      type: "array",
      label: "Messages",
      itemType: "text",
      default: ["New Offer", "Order Today", "Free Delivery Available"],
    },
    speed: {
      type: "number_slider",
      label: "Speed (px/sec)",
      min: 10,
      max: 300,
      step: 5,
      default: 60,
    },
    mobileSpeed: {
      type: "number_slider",
      label: "Mobile Speed (px/sec)",
      min: 10,
      max: 300,
      step: 5,
      default: 50,
    },
    pauseOnHover: {
      type: "boolean",
      label: "Pause On Hover",
      default: true,
    },
    bgColor: {
      type: "color",
      label: "Background",
      default: "var(--color-primary)",
    },
    textColor: {
      type: "color",
      label: "Text Color",
      default: "#ffffff",
    },
    uppercase: {
      type: "boolean",
      label: "Uppercase",
      default: true,
    },
    fontWeight: {
      type: "select",
      label: "Font Weight",
      options: [
        { label: "Normal", value: "400" },
        { label: "Medium", value: "500" },
        { label: "Semi Bold", value: "600" },
        { label: "Bold", value: "700" },
        { label: "Extra Bold", value: "800" },
      ],
      default: "600",
    },
    showSeparator: {
      type: "boolean",
      label: "Show Dot Separator",
      default: true,
    },
    separatorColor: {
      type: "color",
      label: "Dot Color",
      default: "rgba(255,255,255,0.7)",
    },
    separatorSize: {
      type: "number_slider",
      label: "Dot Size",
      min: 2,
      max: 12,
      step: 1,
      default: 4,
    },
    itemGap: {
      type: "number_slider",
      label: "Item Gap",
      min: 4,
      max: 80,
      step: 2,
      default: 24,
    },
    paddingY: {
      type: "number_slider",
      label: "Vertical Padding",
      min: 0,
      max: 40,
      step: 2,
      default: 16,
    },
    fontSizeDesktop: {
      type: "number_slider",
      label: "Desktop Font Size",
      min: 10,
      max: 24,
      step: 1,
      default: 14,
    },
    fontSizeMobile: {
      type: "number_slider",
      label: "Mobile Font Size",
      min: 10,
      max: 20,
      step: 1,
      default: 12,
    },
  },
};
