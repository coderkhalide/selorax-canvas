"use client";

import React, { useMemo, useRef, useEffect } from "react";
import * as Icons from "lucide-react";
import { CUSTOM_BLOCKS } from "./custom-registry";
import { useFunnel } from "../context/FunnelContext";
import { imageGetUrl, replaceProductPlaceholders } from "./rendererUtils";

// Optional checkout component - only available in the main app
// When using the renderer standalone, this will be null
let LandingCheckoutTwo = null;
if (typeof window !== "undefined") {
  try {
    // Dynamic import for optional checkout component
    LandingCheckoutTwo =
      require("@/app/[domain]/landing/LandingCheckoutTwo").default;
  } catch {
    // Checkout component not available - this is expected in standalone usage
  }
}

// --- HELPERS ---

const DynamicIcon = ({ name, size = 24, color, className, style, ...rest }) => {
  const IconCmp = Icons[name] || Icons.HelpCircle;
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
        {...rest}
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
    <IconCmp
      size={size}
      className={className}
      style={{ color, ...style }}
      {...rest}
    />
  );
};

const StaticText = ({ tagName, html, className, style, ...rest }) => {
  const Component = tagName;
  return (
    <Component
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
      {...rest}
    />
  );
};

// --- MAIN RENDERER ---

export const PublicRenderer = ({ element, ...rest }) => {
  const { schemes, product, skus, store, checkoutRef } = useFunnel();
  const [deviceView, setDeviceView] = React.useState("desktop");
  const [isHovered, setIsHovered] = React.useState(false);

  // Auto-detect screen size
  React.useEffect(() => {
    const checkSize = () => {
      const w = window.innerWidth;
      if (w < 768) setDeviceView("mobile");
      else if (w < 1024) setDeviceView("tablet");
      else setDeviceView("desktop");
    };

    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  const isMobile = deviceView === "mobile";
  const carouselRef = useRef(null);

  // 1. Resolve Styles
  const effectiveStyle = useMemo(() => {
    const baseStyle = element.style || {};
    const rawStyle = isMobile
      ? { ...baseStyle, ...(element.tabletStyle || {}), ...(element.mobileStyle || {}) }
      : deviceView === "tablet"
        ? { ...baseStyle, ...(element.tabletStyle || {}) }
        : baseStyle;

    const { backgroundColor, color, ...rest } = rawStyle;
    const style = { ...rest };
    const data = element.data || {};

    // Handle Background Image & Overlay from data
    if (data.backgroundImage) {
      const processedBgImage = replaceProductPlaceholders(
        data.backgroundImage,
        product,
      );
      const bgImage = `url('${imageGetUrl(processedBgImage)}')`;
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
      style.color = color;
    }

    // Handle Hover Effects
    if (isHovered && element.data?.hoverStyle) {
      const hStyle = element.data.hoverStyle;
      if (hStyle.color) {
        style.color = hStyle.color;
        // Handle gradient text on hover
        if (hStyle.color.includes("gradient") && isTextElement) {
          style.backgroundImage = hStyle.color;
          style.WebkitBackgroundClip = "text";
          style.WebkitTextFillColor = "transparent";
          style.backgroundClip = "text";
        } else if (isTextElement && isGradientColor) {
          // If returning to non-gradient color from gradient base
          style.backgroundImage = "none";
          style.WebkitBackgroundClip = "unset";
          style.WebkitTextFillColor = "unset";
          style.backgroundClip = "unset";
        }
      }

      if (hStyle.backgroundColor) {
        style.backgroundColor = hStyle.backgroundColor;
        // Ensure background shorthand is updated to override any previous background
        style.background = hStyle.backgroundColor;

        if (hStyle.backgroundColor.includes("gradient")) {
          style.backgroundImage = hStyle.backgroundColor;
        } else {
          // If switching to a solid color, ensure no gradient remains
          style.backgroundImage = "none";
        }
      }

      if (hStyle.borderColor) {
        style.borderColor = hStyle.borderColor;
        style.borderStyle = style.borderStyle || "solid";
        style.borderWidth = style.borderWidth || "1px";
      }

      if (hStyle.transition) {
        style.transition = `all ${hStyle.transition} ease-in-out`;
      }
    }

    // Apply per-section theme variables if schemeId is present
    if (element.schemeId && schemes && schemes[element.schemeId]) {
      const settings = schemes[element.schemeId].settings;
      if (settings) {
        Object.entries(settings).forEach(([key, value]) => {
          style[`--color-${key.replace(/_/g, "-")}`] = value;
        });
      }
    }

    return style;
  }, [
    element.style,
    element.tabletStyle,
    element.mobileStyle,
    element.type,
    isMobile,
    deviceView,
    element.schemeId,
    schemes,
    isHovered,
    element.data,
  ]);

  // 2. Carousel Logic
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
    const processedContent = (content) =>
      replaceProductPlaceholders(content || "", product);

    const commonHoverProps = {
      onMouseEnter: () => setIsHovered(true),
      onMouseLeave: () => setIsHovered(false),
    };

    if (element.type === "custom" && element.customType) {
      const CustomDef = CUSTOM_BLOCKS[element.customType];
      if (CustomDef) {
        return (
          <CustomDef.component
            element={{ ...element, style: effectiveStyle }}
            isPreview={true}
            deviceView={deviceView}
            {...rest}
            {...commonHoverProps}
          />
        );
      }
    }

    switch (element.type) {
      case "headline":
        return (
          <StaticText
            tagName="div"
            html={processedContent(element.content)}
            style={effectiveStyle}
            className={`${element.className || ""} rich-text`}
            {...commonHoverProps}
          />
        );
      case "paragraph":
        return (
          <StaticText
            tagName="div"
            html={processedContent(element.content)}
            style={effectiveStyle}
            className={`${element.className || ""} rich-text`}
            {...commonHoverProps}
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
              if (bd.onClick === "scroll_to_checkout") {
                checkoutRef?.current?.scrollIntoView({ behavior: "smooth" });
              } else if (
                bd.onClick === "url_redirect" &&
                (bd.redirectUrl || bd.redirect_url)
              ) {
                window.location.href = bd.redirectUrl || bd.redirect_url;
              }
            }}
            {...commonHoverProps}
          >
            <span
              className="inline-flex items-center"
              style={{ gap: `${bd.iconGap ?? 8}px` }}
            >
              {bd.showIconBefore && bd.iconBefore && (
                <DynamicIcon
                  name={bd.iconBefore}
                  size={iconSize}
                  color={bd.iconColor || effectiveStyle.color}
                />
              )}
              <span
                dangerouslySetInnerHTML={{
                  __html: processedContent(element.content),
                }}
              />
              {bd.showIconAfter && bd.iconAfter && (
                <DynamicIcon
                  name={bd.iconAfter}
                  size={iconSize}
                  color={bd.iconColor || effectiveStyle.color}
                />
              )}
            </span>
          </button>
        );
      case "icon":
        return (
          <DynamicIcon
            name={element.content || "Star"}
            size={data.size || 32}
            color={effectiveStyle.color}
            style={effectiveStyle}
            className={element.className}
            {...commonHoverProps}
          />
        );
      case "image":
        const rawSrc = element.src || element.content || "/placeholder.png";
        const processedSrc = replaceProductPlaceholders(rawSrc, product);
        return (
          <img
            src={imageGetUrl(processedSrc)}
            alt="Content"
            style={effectiveStyle}
            className={element.className}
            {...commonHoverProps}
          />
        );

      case "video": {
        const videoUrl = data.videoUrl;
        const showControls = data.showControls !== false;

        let videoSrc = null;
        let isIframe = false;

        if (videoUrl) {
          if (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")) {
            const videoId =
              videoUrl.split("v=")[1]?.split("&")[0] || videoUrl.split("/").pop();
            videoSrc = `https://www.youtube.com/embed/${videoId}?controls=${showControls ? 1 : 0}`;
            isIframe = true;
          } else if (videoUrl.includes("vimeo.com")) {
            const videoId = videoUrl.split("/").pop();
            videoSrc = `https://player.vimeo.com/video/${videoId}?controls=${showControls ? 1 : 0}`;
            isIframe = true;
          } else {
            videoSrc = videoUrl;
          }
        }

        return (
          <div
            style={{
              ...effectiveStyle,
              position: "relative",
              minHeight: "200px",
              aspectRatio: effectiveStyle.aspectRatio || "16/9",
            }}
            className={`w-full ${!videoSrc ? "bg-gray-200" : ""} ${element.className || ""}`}
            {...commonHoverProps}
          >
            {videoSrc ? (
              isIframe ? (
                <iframe
                  src={videoSrc}
                  className="w-full h-full absolute inset-0"
                  style={{ border: "none" }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={videoSrc}
                  controls={showControls}
                  className="w-full h-full object-cover absolute inset-0"
                />
              )
            ) : (
              <div className="flex items-center justify-center h-full w-full text-gray-700 absolute inset-0">
                <div className="text-center">
                  <span className="text-xl font-bold block mb-2">Video Player</span>
                  <span className="text-sm text-gray-500">Add a video URL in settings</span>
                </div>
              </div>
            )}
          </div>
        );
      }
      case "input":
        return (
          <input
            type="text"
            placeholder={element.placeholder}
            style={effectiveStyle}
            className={`border p-2 rounded ${element.className}`}
            disabled
            {...commonHoverProps}
          />
        );
      case "user-checkout":
        return (
          <div
            id="checkout-section"
            style={effectiveStyle}
            className={`w-full ${element.className || ""}`}
            ref={checkoutRef}
            {...commonHoverProps}
          >
            <LandingCheckoutTwo product={product} skus={skus} store={store} role={element.data?.role || ""} />
          </div>
        );

      case "section":
      case "wrapper":
      case "row":
      case "col":
        const ContainerTag = element.type === "section" ? "section" : "div";
        const containerStyle = { ...effectiveStyle };

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
          <ContainerTag
            style={containerStyle}
            className={element.className}
            {...commonHoverProps}
          >
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
                    <PublicRenderer element={child} {...rest} />
                  </div>
                ))}
              </div>
            ) : (
              element.children?.map((child) => (
                <PublicRenderer key={child.id} element={child} {...rest} />
              ))
            )}
          </ContainerTag>
        );

      default:
        return null;
    }
  };

  return renderContent();
};
