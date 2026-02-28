"use client";
import React, { useMemo, useRef, useEffect } from "react";
import * as Icons from "lucide-react";
import { FunnelElement } from "../types";
import { CUSTOM_BLOCKS } from "./custom-registry";
import { useFunnel } from "../context/PublicFunnelContext";
import { imageGetUrl } from "@/utils/utils";

// --- HELPERS ---

const DynamicIcon: React.FC<{
  name: string;
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}> = ({ name, size = 24, color, className, style }) => {
  const IconCmp = (Icons as any)[name] || Icons.HelpCircle;
  const isGradient = color?.includes("gradient");

  if (isGradient) {
    return (
      <span
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          ...style,
        }}
      >
        <span
          style={{
            position: "absolute",
            inset: 0,
            background: color,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconCmp size={size} stroke="currentColor" fill="currentColor" />
        </span>
        <IconCmp size={size} style={{ opacity: 0 }} />
      </span>
    );
  }

  return (
    <IconCmp size={size} className={className} style={{ color, ...style }} />
  );
};

const StaticText: React.FC<{
  tagName: string;
  html: string;
  className?: string;
  style?: React.CSSProperties;
}> = ({ tagName, html, className, style }) => {
  const Component = tagName as any;
  return (
    <Component
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

// --- MAIN RENDERER ---

export const PublicRenderer: React.FC<{
  element: FunnelElement;
}> = ({ element }) => {
  const { schemes } = useFunnel();
  const [deviceView, setDeviceView] = React.useState<"desktop" | "tablet" | "mobile">("desktop");

  // স্ক্রিন সাইজ অটোমেটিক ডিটেকশন (Auto-detect screen size)
  React.useEffect(() => {
    const checkSize = () => {
      const w = window.innerWidth;
      if (w < 768) setDeviceView("mobile");
      else if (w < 1024) setDeviceView("tablet");
      else setDeviceView("desktop");
    };

    checkSize(); // Initialize on mount
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  const isMobile = deviceView === "mobile";
  const carouselRef = useRef<HTMLDivElement | null>(null);

  // 1. Resolve Styles (Desktop vs Mobile) - এখন এটি অটোমেটিক!
  const effectiveStyle: React.CSSProperties = useMemo(() => {
    const baseStyle = element.style || {};
    const rawStyle = isMobile
      ? { ...baseStyle, ...(element.tabletStyle || {}), ...(element.mobileStyle || {}) }
      : deviceView === "tablet"
        ? { ...baseStyle, ...(element.tabletStyle || {}) }
        : baseStyle;

    const { backgroundColor, color, ...rest } = rawStyle;
    const style: React.CSSProperties = { ...rest };
    const data = element.data || {};

    // Handle Background Image & Overlay from data
    if (data.backgroundImage) {
      const bgImage = `url('${imageGetUrl(data.backgroundImage)}')`;
      const overlay = data.backgroundOverlay;

      if (overlay) {
        style.backgroundImage = `linear-gradient(${overlay}, ${overlay}), ${bgImage}`;
      } else {
        style.backgroundImage = bgImage;
      }

      style.backgroundSize = data.backgroundSize || "cover";
      style.backgroundPosition = data.backgroundPosition || "center";
      style.backgroundRepeat = "no-repeat";

      if (backgroundColor) {
        style.backgroundColor = backgroundColor;
      }
    } else if (backgroundColor) {
      style.background = backgroundColor;
    }

    const isTextElement = ["headline", "paragraph", "button", "icon"].includes(
      element.type,
    );
    const isGradientColor =
      typeof color === "string" && color.includes("gradient");

    if (isTextElement && isGradientColor) {
      style.backgroundImage = color;
      style.WebkitBackgroundClip = "text";
      style.WebkitTextFillColor = "transparent";
      style.backgroundClip = "text";
    } else {
      style.color = color as string;
    }

    if (element.schemeId && schemes && schemes[element.schemeId]) {
      const settings = schemes[element.schemeId].settings;
      if (settings) {
        Object.entries(settings).forEach(([key, value]) => {
          (style as any)[`--color-${key.replace(/_/g, "-")}`] = value as string;
        });
      }
    }

    return style;
  }, [
    element.style,
    element.tabletStyle,
    element.mobileStyle,
    element.type,
    element.schemeId,
    isMobile,
    deviceView,
    schemes,
  ]);

  // 2. Carousel Logic (Optional but kept for functionality)
  const data = element.data || {};
  const isCarousel =
    (element.type === "col" &&
      (isMobile ? data.mobileContainerLayout : data.containerLayout) ===
        "carousel") ||
    (element.type === "row" &&
      (isMobile ? data.mobileRowContainerLayout : data.rowContainerLayout) ===
        "carousel");

  useEffect(() => {
    if (!isCarousel || !carouselRef.current || !data.enableAutoplay) return;
    const slides = isMobile
      ? data.slidesPerViewMobile || 1
      : data.slidesPerViewDesktop || 3;
    const gap = parseInt(String(effectiveStyle.gap || "0"));

    const el = carouselRef.current;
    const id = setInterval(
      () => {
        const step = el.clientWidth / Math.max(1, slides) + (gap || 0);
        const nextLeft = el.scrollLeft + step;
        const isAtEnd = nextLeft + el.clientWidth >= el.scrollWidth - 1;
        el.scrollTo({ left: isAtEnd ? 0 : nextLeft, behavior: "smooth" });
      },
      Math.max(1000, data.autoplayInterval || 3000),
    );
    return () => clearInterval(id);
  }, [
    isCarousel,
    isMobile,
    data.enableAutoplay,
    data.autoplayInterval,
    effectiveStyle.gap,
  ]);

  // 3. Render Logic
  const renderContent = () => {
    // Custom Components
    if (element.type === "custom" && element.customType) {
      const CustomDef = CUSTOM_BLOCKS[element.customType];
      if (CustomDef) {
        return (
          <CustomDef.component
            element={{ ...element, style: effectiveStyle }}
            isPreview={true}
            deviceView={deviceView}
          />
        );
      }
    }

    switch (element.type) {
      case "headline":
        return (
          <StaticText
            tagName="h1"
            html={element.content || ""}
            style={effectiveStyle}
            className={element.className}
          />
        );
      case "paragraph":
        return (
          <StaticText
            tagName="p"
            html={element.content || ""}
            style={effectiveStyle}
            className={element.className}
          />
        );
      case "button":
        const bd = data;
        const iconSize = (isMobile && bd.iconSizeMobile) || bd.iconSize || 18;
        return (
          <button
            style={effectiveStyle}
            className={element.className}
            onClick={() => {
              if (
                bd.onClick === "url_redirect" &&
                (bd.redirectUrl || bd.redirect_url)
              ) {
                window.location.href = bd.redirectUrl || bd.redirect_url;
              }
            }}
          >
            <span className="inline-flex items-center">
              {element.content || "Button"}
              {bd.showIcon && bd.iconName && (
                <DynamicIcon
                  name={bd.iconName}
                  size={iconSize}
                  className={bd.iconPosition === "left" ? "mr-2" : "ml-2"}
                />
              )}
            </span>
          </button>
        );
      case "image":
        return (
          <img
            src={element.content || "/placeholder.png"}
            alt="Content"
            style={effectiveStyle}
            className={element.className}
          />
        );

      case "video":
        const videoSrc = element.content;
        return (
          <div
            style={effectiveStyle}
            className={`relative w-full ${element.className || ""} ${
              !videoSrc ? "bg-gray-200" : ""
            }`}
          >
            {videoSrc ? (
              <iframe
                src={videoSrc}
                className="w-full h-full absolute inset-0"
                frameBorder="0"
                allowFullScreen
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                <Icons.Video size={48} />
              </div>
            )}
          </div>
        );
      case "icon":
        return (
          <DynamicIcon
            name={element.content || "HelpCircle"}
            size={parseInt(String(effectiveStyle.fontSize || 24))}
            color={effectiveStyle.color as string}
            className={element.className}
            style={effectiveStyle}
          />
        );
      case "wrapper":
      case "row":
      case "col":
      case "section": {
        const ContainerTag =
          element.type === "section" ? ("section" as const) : ("div" as const);
        const containerStyle: React.CSSProperties = { ...effectiveStyle };

        const layout =
          element.type === "row"
            ? isMobile
              ? data.mobileRowContainerLayout
              : data.rowContainerLayout
            : isMobile
              ? data.mobileContainerLayout
              : data.containerLayout;

        if (layout === "grid") {
          const cols =
            element.type === "row"
              ? isMobile
                ? data.rowGridColumnsMobile
                : data.rowGridColumnsDesktop
              : isMobile
                ? data.gridColumnsMobile
                : data.gridColumnsDesktop;

          if (cols) {
            containerStyle.display = "grid";
            containerStyle.gridTemplateColumns = `repeat(${cols}, 1fr)`;
          }
        }

        return (
          <ContainerTag style={containerStyle} className={element.className}>
            {isCarousel ? (
              <div
                ref={carouselRef}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  overflowX: "auto",
                  gap: containerStyle.gap,
                  scrollSnapType: "x mandatory",
                  scrollbarWidth: "none",
                }}
              >
                {element.children?.map((child) => (
                  <div
                    key={child.id}
                    style={{
                      flex: `0 0 ${
                        100 /
                        (isMobile
                          ? data.slidesPerViewMobile || 1
                          : data.slidesPerViewDesktop || 3)
                      }%`,
                      scrollSnapAlign: "start",
                    }}
                  >
                    <PublicRenderer element={child} />
                  </div>
                ))}
              </div>
            ) : (
              element.children?.map((child) => (
                <PublicRenderer key={child.id} element={child} />
              ))
            )}
          </ContainerTag>
        );
      }
      default:
        return null;
    }
  };

  return renderContent();
};
