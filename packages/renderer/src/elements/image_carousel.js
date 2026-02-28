import React from "react";

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

import { jsx, jsxs } from "react/jsx-runtime";
var ImageCarouselComponent = ({ element, onUpdate, isPreview, deviceView = "desktop" }) => {
  const isMobile = deviceView === "mobile";
  const isTablet = deviceView === "tablet";
  const {
    images = [],
    image_fit,
    image_gap = 16,
    enableAutoplay = true,
    scrollSpeed = 30,
    height = "500px",
    mobileHeight = "400px",
    tabletHeight = "450px",
    imageWidth = 350,
    borderRadius = 12
  } = element.data || {};
  const effectiveHeight = isMobile ? mobileHeight || "400px" : isTablet ? tabletHeight || "450px" : height || "500px";
  const effectiveImageWidth = isMobile ? Math.min(imageWidth, 280) : isTablet ? Math.min(imageWidth, 320) : imageWidth;
  const animationDuration = `${scrollSpeed}s`;
  const duplicatedImages = [...images, ...images, ...images, ...images];
  const uniqueId = element.id || "carousel";
  const singleSetWidth = images.length * (effectiveImageWidth + image_gap);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      style: { ...element.style, overflow: "hidden" },
      className: `w-full ${element.className || ""}`,
      children: [
        /* @__PURE__ */ jsx("style", { children: `
        @keyframes marquee-${uniqueId} {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-${singleSetWidth}px, 0, 0);
          }
        }
        .marquee-track-${uniqueId} {
          display: flex;
          width: max-content;
          animation: ${enableAutoplay ? `marquee-${uniqueId} ${animationDuration} linear infinite` : "none"};
          will-change: transform;
        }
        .marquee-track-${uniqueId}:hover {
          animation-play-state: paused;
        }
      ` }),
        /* @__PURE__ */ jsx("div", { className: "relative w-full", style: { height: effectiveHeight }, children: images.length > 0 ? /* @__PURE__ */ jsx(
          "div",
          {
            className: `marquee-track-${uniqueId}`,
            style: { gap: `${image_gap}px` },
            children: duplicatedImages.map((img, idx) => /* @__PURE__ */ jsx(
              "div",
              {
                className: "flex-shrink-0",
                style: {
                  width: `${effectiveImageWidth}px`,
                  height: effectiveHeight
                },
                children: /* @__PURE__ */ jsx(
                  "img",
                  {
                    src: imageGetUrl(img?.image),
                    alt: `Slide ${idx % images.length + 1}`,
                    className: "w-full h-full bg-gray-100",
                    draggable: false,
                    style: {
                      objectFit: image_fit || "cover",
                      borderRadius: `${borderRadius}px`
                    }
                  }
                )
              },
              idx
            ))
          }
        ) : /* @__PURE__ */ jsx(
          "div",
          {
            className: "w-full bg-gray-100 flex items-center justify-center",
            style: { height: effectiveHeight },
            children: /* @__PURE__ */ jsx(
              "img",
              {
                src: imageGetUrl(void 0),
                alt: "Placeholder",
                className: "w-64 h-64 object-contain opacity-70"
              }
            )
          }
        ) })
      ]
    }
  );
};

function image_carouselRender({ data, style, className }) {
  const fakeElement = {
    id: "__render__",
    type: "custom",
    name: "image_carousel",
    style: style ?? {},
    className: className ?? "",
    data: data ?? {}
  };
  return React.createElement(ImageCarouselComponent, {
    element: fakeElement,
    isPreview: true
  });
}
export {
  image_carouselRender as default
};
