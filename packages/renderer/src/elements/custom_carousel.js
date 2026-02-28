import React2 from "react";

import { useEffect, useMemo, useRef, useState } from "react";
import { Images } from "lucide-react";

var S3_PUBLIC_URL = process.env.NEXT_PUBLIC_S3_PUBLIC_URL || "https://assets.selorax.io";
var imageGetUrl = (img) => {
  if (!img) return "/placeholder.svg";
  if (img.includes("{{") || img.includes("}}")) {
    return img;
  }
  try {
    const u = new URL(img);
    const host = u.host;
    const path = decodeURIComponent(u.pathname.replace(/^\/+/, ""));
    const s3Host = new URL(S3_PUBLIC_URL).host;
    if (host === s3Host) return img;
    if (host.endsWith("cloudflarestorage.com") || host.endsWith("r2.dev")) {
      return `${S3_PUBLIC_URL}/${path}`;
    }
    return img;
  } catch {
    return S3_PUBLIC_URL ? `${S3_PUBLIC_URL}/${img}` : img;
  }
};

import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var CustomCarouselComponent = ({ element, onUpdate, isPreview, deviceView = "desktop" }) => {
  const {
    items = [],
    slidesPerViewDesktop = 3,
    slidesPerViewTablet = 2,
    slidesPerViewMobile = 1,
    gap = 24,
    enableAutoplay = true,
    autoplayInterval = 3e3,
    showArrows = true,
    showDots = true,
    cardBackground = "transparent",
    cardBorderColor = "transparent",
    cardRadius = 12,
    imageHeightDesktop = 320,
    imageHeightMobile = 220
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
    slidesPerViewMobile
  ]);
  const visibleItems = Array.isArray(items) ? items : [];
  const maxIndex = Math.max(0, visibleItems.length - 1);
  const scrollToIndex = (index) => {
    const el = containerRef.current;
    if (!el) return;
    const children = Array.from(el.children);
    if (!children.length) return;
    const clamped = Math.min(Math.max(index, 0), maxIndex);
    const target = children[clamped];
    if (!target) return;
    el.scrollTo({
      left: target.offsetLeft,
      behavior: "smooth"
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
      Math.max(800, Number(autoplayInterval) || 3e3)
    );
    return () => window.clearInterval(id);
  }, [
    enableAutoplay,
    autoplayInterval,
    currentIndex,
    maxIndex,
    visibleItems.length
  ]);
  const itemWidthPercent = 100 / (slidesPerView || 1);
  const imageHeight = deviceView === "mobile" ? imageHeightMobile || 220 : imageHeightDesktop || 320;
  return /* @__PURE__ */ jsxs(
    "div",
    {
      style: {
        width: "100%",
        position: "relative"
      },
      children: [
        /* @__PURE__ */ jsx(
          "div",
          {
            ref: containerRef,
            style: {
              display: "flex",
              overflowX: "auto",
              scrollSnapType: "x mandatory",
              gap: `${gap}px`,
              paddingBottom: 4,
              scrollbarWidth: "none"
            },
            children: visibleItems.map((item, index) => {
              const image = item.image ? imageGetUrl(item.image) : null;
              return /* @__PURE__ */ jsx(
                "div",
                {
                  style: {
                    flex: `0 0 ${itemWidthPercent}%`,
                    scrollSnapAlign: "start"
                  },
                  children: /* @__PURE__ */ jsx(
                    "div",
                    {
                      style: {
                        background: cardBackground,
                        borderRadius: cardRadius,
                        border: `1px solid ${cardBorderColor}`,
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8
                      },
                      children: image && /* @__PURE__ */ jsx(
                        "div",
                        {
                          style: {
                            borderRadius: cardRadius - 4,
                            overflow: "hidden"
                          },
                          children: /* @__PURE__ */ jsx(
                            "img",
                            {
                              src: image,
                              alt: "",
                              style: {
                                width: "100%",
                                height: `${imageHeight}px`,
                                objectFit: "cover",
                                display: "block"
                              }
                            }
                          )
                        }
                      )
                    }
                  )
                },
                item.id || index
              );
            })
          }
        ),
        showArrows && visibleItems.length > slidesPerView && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: handlePrev,
              style: {
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
                boxShadow: "none"
              },
              children: /* @__PURE__ */ jsx(
                "svg",
                {
                  viewBox: "0 0 24 24",
                  width: 18,
                  height: 18,
                  fill: "none",
                  stroke: "currentColor",
                  children: /* @__PURE__ */ jsx("path", { d: "M15 6l-6 6 6 6" })
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: handleNext,
              style: {
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
                boxShadow: "none"
              },
              children: /* @__PURE__ */ jsx(
                "svg",
                {
                  viewBox: "0 0 24 24",
                  width: 18,
                  height: 18,
                  fill: "none",
                  stroke: "currentColor",
                  children: /* @__PURE__ */ jsx("path", { d: "M9 18l6-6-6-6" })
                }
              )
            }
          )
        ] }),
        showDots && visibleItems.length > 1 && /* @__PURE__ */ jsx(
          "div",
          {
            style: {
              marginTop: 12,
              display: "flex",
              justifyContent: "center",
              gap: 8
            },
            children: visibleItems.map((_, index) => /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => scrollToIndex(index),
                style: {
                  width: 8,
                  height: 8,
                  borderRadius: "999px",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  background: index === currentIndex ? "rgba(15,23,42,0.9)" : "rgba(148,163,184,0.7)"
                }
              },
              index
            ))
          }
        )
      ]
    }
  );
};

function custom_carouselRender({ data, style, className }) {
  const fakeElement = {
    id: "__render__",
    type: "custom",
    name: "custom_carousel",
    style: style ?? {},
    className: className ?? "",
    data: data ?? {}
  };
  return React2.createElement(CustomCarouselComponent, {
    element: fakeElement,
    isPreview: true
  });
}
export {
  custom_carouselRender as default
};
