import React, { useRef, useEffect } from "react";
import { EditableText } from "./EditableText";
import * as Icons from "lucide-react";
import { getGradientTextStyle } from "./styleUtils";

const QuotesComponent = ({
  element,
  onUpdate,
  isPreview,
  deviceView = "desktop",
}) => {
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
    autoplayInterval = 3000,
    slidesPerViewMobile = 1,
    slidesPerViewDesktop = 3,
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
    }, Math.max(1000, autoplayInterval));
    return () => clearInterval(id);
  }, [
    activeLayout,
    enableAutoplay,
    autoplayInterval,
    isMobile,
    gridGap,
    slidesPerViewMobile,
    slidesPerViewDesktop,
  ]);

  const updateItem = (index, field, value) => {
    const cur = elementRef.current;
    const list = cur.data?.items || [];
    const next = [...list];
    next[index] = { ...next[index], [field]: value };
    if (onUpdate) onUpdate(cur.id, { data: { ...cur.data, items: next } });
  };

  const renderQuote = (item, index, customStyle) => {
    const baseStyle = {
      ...getBgStyle(bgColor),
      padding: `${pad}px`,
      ...customStyle,
    };
    if (layout === "bubble") {
      return (
        <div
          key={index}
          className="rounded-xl relative border border-gray-200 shadow-sm"
          style={baseStyle}
        >
          <div
            className="absolute left-8 -bottom-3 w-0 h-0"
            style={{
              borderLeft: "10px solid transparent",
              borderRight: "10px solid transparent",
              borderTop: `12px solid ${bgColor}`,
            }}
          />
          <div className="flex items-start gap-3">
            <Icons.Quote
              className="w-4 h-4"
              style={{ color: quoteMarkColor }}
            />
            <div className="flex-1">
              <EditableText
                tagName="p"
                className="text-sm leading-relaxed"
                style={getGradientTextStyle(textColor)}
                html={item.text}
                editable={!isPreview}
                onBlur={(e) =>
                  updateItem(index, "text", e.currentTarget.innerHTML)
                }
              />
              {item.author !== undefined && (
                <EditableText
                  tagName="p"
                  className="text-xs mt-2 opacity-80"
                  style={getGradientTextStyle(textColor)}
                  html={item.author}
                  editable={!isPreview}
                  onBlur={(e) =>
                    updateItem(index, "author", e.currentTarget.innerHTML)
                  }
                />
              )}
            </div>
          </div>
        </div>
      );
    }
    if (layout === "bordered") {
      return (
        <div
          key={index}
          className="rounded-lg border-2"
          style={{ ...baseStyle, borderColor: accentColor }}
        >
          <div className="flex items-start gap-2">
            <Icons.Quote
              className="w-4 h-4"
              style={{ color: quoteMarkColor }}
            />
            <EditableText
              tagName="p"
              className="text-sm leading-relaxed"
              style={getGradientTextStyle(textColor)}
              html={item.text}
              editable={!isPreview}
              onBlur={(e) =>
                updateItem(index, "text", e.currentTarget.innerHTML)
              }
            />
          </div>
        </div>
      );
    }
    if (layout === "minimal") {
      return (
        <div key={index} className="rounded-md" style={baseStyle}>
          <div className="flex items-start gap-2">
            <Icons.Quote
              className="w-4 h-4"
              style={{ color: quoteMarkColor }}
            />
            <EditableText
              tagName="p"
              className="text-sm"
              style={getGradientTextStyle(textColor)}
              html={item.text}
              editable={!isPreview}
              onBlur={(e) =>
                updateItem(index, "text", e.currentTarget.innerHTML)
              }
            />
          </div>
        </div>
      );
    }
    return (
      <div
        key={index}
        className="rounded-xl border border-gray-200 shadow-sm"
        style={baseStyle}
      >
        <div className="flex items-start gap-3">
          <Icons.Quote className="w-4 h-4" style={{ color: quoteMarkColor }} />
          <div className="flex-1">
            <EditableText
              tagName="p"
              className="text-sm leading-relaxed"
              style={getGradientTextStyle(textColor)}
              html={item.text}
              editable={!isPreview}
              onBlur={(e) =>
                updateItem(index, "text", e.currentTarget.innerHTML)
              }
            />
            {item.author !== undefined && (
              <EditableText
                tagName="p"
                className="text-xs mt-2 opacity-80"
                style={getGradientTextStyle(textColor)}
                html={item.author}
                editable={!isPreview}
                onBlur={(e) =>
                  updateItem(index, "author", e.currentTarget.innerHTML)
                }
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  if (activeLayout === "carousel") {
    const slides = isMobile ? slidesPerViewMobile : slidesPerViewDesktop;
    const cardWidthPercent = 100 / Math.max(1, slides);
    return (
      <div
        ref={sliderRef}
        style={{
          ...element.style,
          display: "flex",
          overflowX: "auto",
          gap: `${gridGap}px`,
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        }}
        className="w-full"
      >
        {(items || []).map((item, index) =>
          renderQuote(item, index, {
            flex: `0 0 ${cardWidthPercent}%`,
            scrollSnapAlign: "start",
          })
        )}
      </div>
    );
  }

  const desktopCols = columns || 3;
  const gridCols = isMobile ? mobileColumns : desktopCols;
  return (
    <div
      style={{
        ...element.style,
        display: "grid",
        gridTemplateColumns: isPreview
          ? `repeat(auto-fit, minmax(200px, 1fr))`
          : `repeat(${gridCols}, minmax(0, 1fr))`,
        gap: `${gridGap}px`,
      }}
      className="w-full"
    >
      {(items || []).map((item, index) => renderQuote(item, index))}
    </div>
  );
};

export const QuotesDef = {
  name: "Quotes",
  icon: <Icons.Quote className="w-4 h-4" />,
  category: "Content",
  component: QuotesComponent,
  defaultData: {
    layout: "grid",
    mobileLayout: "carousel",
    items: [
      {
        text: "সম্পূর্ণ প্রাকৃতিক ও নিরাপদ উপায়ে গ্যাস্ট্রিকের স্থায়ী সমাধান পাবেন।",
        author: "সাবরিনা রহমান",
      },
      {
        text: "সম্পূর্ণ প্রাকৃতিক ও নিরাপদ উপায়ে গ্যাস্ট্রিকের স্থায়ী সমাধান পাবেন।",
        author: "মৌসুমী আক্তার",
      },
      {
        text: "সম্পূর্ণ প্রাকৃতিক ও নিরাপদ উপায়ে গ্যাস্ট্রিকের স্থায়ী সমাধান পাবেন।",
        author: "সাবরিনা রহমান",
      },
    ],
    bgColor: "var(--color-input-background)",
    textColor: "var(--color-foreground)",
    accentColor: "var(--color-border)",
    quoteMarkColor: "var(--color-primary)",
    gap: 24,
    columns: 3,
    cardPadding: 20,
    mobileColumns: 1,
    mobileGap: 16,
    mobileCardPadding: 16,
    enableAutoplay: true,
    autoplayInterval: 3000,
    slidesPerViewMobile: 1,
    slidesPerViewDesktop: 3,
  },
  settings: {
    layout: {
      type: "select",
      label: "Layout",
      options: [
        { label: "Grid", value: "grid" },
        { label: "Bubble", value: "bubble" },
        { label: "Bordered", value: "bordered" },
        { label: "Minimal", value: "minimal" },
        { label: "Carousel", value: "carousel" },
      ],
      default: "grid",
    },
    mobileLayout: {
      type: "select",
      label: "Mobile Layout",
      options: [
        { label: "Grid", value: "grid" },
        { label: "Carousel", value: "carousel" },
      ],
      default: "carousel",
    },
    items: {
      type: "array_object",
      label: "Quotes",
      itemSchema: {
        text: { type: "textarea", label: "Text", default: "Quote text" },
        author: { type: "text", label: "Author", default: "" },
      },
      defaultItem: { text: "Quote text", author: "" },
    },
    bgColor: {
      type: "color",
      label: "Background",
      default: "var(--color-input-background)",
    },
    textColor: {
      type: "color",
      label: "Text Color",
      default: "var(--color-foreground)",
    },
    accentColor: {
      type: "color",
      label: "Accent",
      default: "var(--color-border)",
    },
    quoteMarkColor: {
      type: "color",
      label: "Quote Mark",
      default: "var(--color-primary)",
    },
    gap: {
      type: "number_slider",
      label: "Gap",
      min: 0,
      max: 64,
      default: 24,
    },
    columns: {
      type: "number_slider",
      label: "Columns",
      min: 1,
      max: 5,
      default: 3,
    },
    cardPadding: {
      type: "number_slider",
      label: "Padding",
      min: 0,
      max: 64,
      default: 20,
    },
    mobileGap: {
      type: "number_slider",
      label: "Gap (Mobile)",
      min: 0,
      max: 40,
      default: 16,
    },
    mobileColumns: {
      type: "number_slider",
      label: "Columns (Mobile)",
      min: 1,
      max: 3,
      default: 1,
    },
    mobileCardPadding: {
      type: "number_slider",
      label: "Padding (Mobile)",
      min: 0,
      max: 40,
      default: 16,
    },
    enableAutoplay: { type: "boolean", label: "Autoplay", default: true },
    autoplayInterval: {
      type: "number_slider",
      label: "Autoplay Speed",
      min: 1000,
      max: 8000,
      default: 3000,
    },
    slidesPerViewMobile: {
      type: "number_slider",
      label: "Slides (Mobile)",
      min: 1,
      max: 2,
      default: 1,
    },
    slidesPerViewDesktop: {
      type: "number_slider",
      label: "Slides (Desktop)",
      min: 1,
      max: 4,
      default: 3,
    },
  },
};
