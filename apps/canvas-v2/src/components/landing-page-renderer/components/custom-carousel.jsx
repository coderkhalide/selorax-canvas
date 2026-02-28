"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Images } from "lucide-react";
import { imageGetUrl } from "./rendererUtils";

const CustomCarouselComponent = ({
  element,
  onUpdate,
  isPreview,
  deviceView = "desktop",
}) => {
  const {
    items = [],
    slidesPerViewDesktop = 3,
    slidesPerViewTablet = 2,
    slidesPerViewMobile = 1,
    gap = 24,
    enableAutoplay = true,
    autoplayInterval = 3000,
    showArrows = true,
    showDots = true,
    cardBackground = "transparent",
    cardBorderColor = "transparent",
    cardRadius = 12,
    imageHeightDesktop = 320,
    imageHeightMobile = 220,
  } = element.data || {};

  const containerRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const slidesPerView = useMemo(() => {
    if (deviceView === "mobile") return slidesPerViewMobile || 1;
    if (deviceView === "tablet") return slidesPerViewTablet || 2;
    return slidesPerViewDesktop || 3;
  }, [
    deviceView,
    slidesPerViewDesktop,
    slidesPerViewTablet,
    slidesPerViewMobile,
  ]);

  const visibleItems = Array.isArray(items) ? items : [];
  const maxIndex = Math.max(0, visibleItems.length - 1);

  const scrollToIndex = (index) => {
    const el = containerRef.current;
    if (!el) return;
    const children = Array.from(el.children || []);
    if (!children.length) return;
    const clamped = Math.min(Math.max(index, 0), maxIndex);
    const target = children[clamped];
    if (!target) return;
    el.scrollTo({
      left: target.offsetLeft,
      behavior: "smooth",
    });
    setCurrentIndex(clamped);
  };

  const handlePrev = () => {
    const next = currentIndex - 1;
    if (next < 0) {
      scrollToIndex(maxIndex);
    } else {
      scrollToIndex(next);
    }
  };

  const handleNext = () => {
    const next = currentIndex + 1;
    if (next > maxIndex) {
      scrollToIndex(0);
    } else {
      scrollToIndex(next);
    }
  };

  useEffect(() => {
    if (!enableAutoplay) return;
    if (!visibleItems.length) return;
    const id = window.setInterval(
      () => {
        const next = currentIndex + 1 > maxIndex ? 0 : currentIndex + 1;
        scrollToIndex(next);
      },
      Math.max(800, Number(autoplayInterval) || 3000),
    );
    return () => window.clearInterval(id);
  }, [
    enableAutoplay,
    autoplayInterval,
    currentIndex,
    maxIndex,
    visibleItems.length,
  ]);

  const itemWidthPercent = 100 / (slidesPerView || 1);
  const imageHeight =
    deviceView === "mobile"
      ? imageHeightMobile || 220
      : imageHeightDesktop || 320;

  return (
    <div
      style={{
        width: "100%",
        position: "relative",
      }}
      className={element.className}
    >
      <div
        ref={containerRef}
        style={{
          display: "flex",
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          gap: `${gap}px`,
          paddingBottom: 4,
          scrollbarWidth: "none",
        }}
      >
        {visibleItems.map((item, index) => {
          const image = item.image ? imageGetUrl(item.image) : null;
          return (
            <div
              key={item.id || index}
              style={{
                flex: `0 0 ${itemWidthPercent}%`,
                scrollSnapAlign: "start",
              }}
            >
              <div
                style={{
                  background: cardBackground,
                  borderRadius: cardRadius,
                  border: `1px solid ${cardBorderColor}`,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {image && (
                  <div
                    style={{
                      borderRadius: cardRadius - 4,
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={image}
                      alt=""
                      style={{
                        width: "100%",
                        height: `${imageHeight}px`,
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showArrows && visibleItems.length > slidesPerView && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              transform: "translate(-50%, -50%)",
              width: 32,
              height: 32,
              borderRadius: "999px",
              border: "1px solid rgba(0,0,0,0.08)",
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              outline: "none",
              boxShadow: "none",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width={18}
              height={18}
              fill="none"
              stroke="currentColor"
            >
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleNext}
            style={{
              position: "absolute",
              top: "50%",
              right: 0,
              transform: "translate(50%, -50%)",
              width: 32,
              height: 32,
              borderRadius: "999px",
              border: "1px solid rgba(0,0,0,0.08)",
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              outline: "none",
              boxShadow: "none",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width={18}
              height={18}
              fill="none"
              stroke="currentColor"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </>
      )}

      {showDots && visibleItems.length > 1 && (
        <div
          style={{
            marginTop: 12,
            display: "flex",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {visibleItems.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => scrollToIndex(index)}
              style={{
                width: 8,
                height: 8,
                borderRadius: "999px",
                border: "none",
                padding: 0,
                cursor: "pointer",
                background:
                  index === currentIndex
                    ? "rgba(15,23,42,0.9)"
                    : "rgba(148,163,184,0.7)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const CustomCarouselDef = {
  name: "Custom Slider",
  icon: <Images className="w-4 h-4" />,
  category: "Dynamic",
  component: CustomCarouselComponent,
  defaultData: {
    items: [
      {
        id: "item-1",
        image: "https://placehold.co/600x400",
      },
      {
        id: "item-2",
        image: "https://placehold.co/600x400",
      },
      {
        id: "item-3",
        image: "https://placehold.co/600x400",
      },
    ],
    slidesPerViewDesktop: 3,
    slidesPerViewTablet: 2,
    slidesPerViewMobile: 1,
    gap: 24,
    enableAutoplay: true,
    autoplayInterval: 3000,
    showArrows: true,
    showDots: true,
    cardBackground: "transparent",
    cardBorderColor: "transparent",
    cardRadius: 12,
    imageHeightDesktop: 320,
    imageHeightMobile: 220,
  },
  settings: {
    items: {
      type: "array_object",
      label: "Slides",
      itemSchema: {
        image: {
          type: "text",
          label: "Image URL",
          default: "https://placehold.co/600x400",
        },
      },
      defaultItem: {
        image: "https://placehold.co/600x400",
      },
    },
    slidesPerViewDesktop: {
      type: "number_slider",
      label: "Slides per view (Desktop)",
      min: 1,
      max: 4,
      step: 1,
      default: 3,
    },
    slidesPerViewTablet: {
      type: "number_slider",
      label: "Slides per view (Tablet)",
      min: 1,
      max: 3,
      step: 1,
      default: 2,
    },
    slidesPerViewMobile: {
      type: "number_slider",
      label: "Slides per view (Mobile)",
      min: 1,
      max: 2,
      step: 1,
      default: 1,
    },
    gap: {
      type: "number_slider",
      label: "Gap between slides",
      min: 0,
      max: 40,
      step: 2,
      default: 24,
    },
    enableAutoplay: {
      type: "boolean",
      label: "Enable autoplay",
      default: true,
    },
    autoplayInterval: {
      type: "number_slider",
      label: "Autoplay interval (ms)",
      min: 800,
      max: 10000,
      step: 200,
      default: 3000,
    },
    showArrows: {
      type: "boolean",
      label: "Show arrows",
      default: true,
    },
    showDots: {
      type: "boolean",
      label: "Show dots",
      default: true,
    },
    cardBackground: {
      type: "color",
      label: "Card background",
      default: "#ffffff",
    },
    cardBorderColor: {
      type: "color",
      label: "Card border",
      default: "rgba(0,0,0,0.06)",
    },
    cardRadius: {
      type: "number_slider",
      label: "Card radius",
      min: 0,
      max: 32,
      step: 1,
      default: 12,
    },
    imageHeightDesktop: {
      type: "number_slider",
      label: "Image height (Desktop px)",
      min: 120,
      max: 800,
      step: 10,
      default: 320,
    },
    imageHeightMobile: {
      type: "number_slider",
      label: "Image height (Mobile px)",
      min: 120,
      max: 600,
      step: 10,
      default: 220,
    },
  },
};
