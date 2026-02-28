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
var GalleryComponent = ({ element, onUpdate, isPreview, deviceView = "desktop" }) => {
  const isMobile = deviceView === "mobile";
  const {
    items = [],
    gap = 16,
    borderRadius = 16,
    hoverEffect = "zoom"
  } = element.data || {};
  const getSpanStyle = (size) => {
    if (isMobile) return { gridColumn: "span 1", gridRow: "span 1" };
    switch (size) {
      case "tall":
        return { gridColumn: "span 1", gridRow: "span 2" };
      case "wide":
        return { gridColumn: "span 2", gridRow: "span 1" };
      case "big":
        return { gridColumn: "span 2", gridRow: "span 2" };
      default:
        return { gridColumn: "span 1", gridRow: "span 1" };
    }
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      style: {
        ...element.style,
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(250px, 1fr))",
        gridAutoRows: "250px",
        gridAutoFlow: "dense",
        gap: `${gap}px`
      },
      className: `w-full ${element.className || ""}`,
      children: [
        items.map((item, index) => {
          const spanStyle = getSpanStyle(item.size);
          return /* @__PURE__ */ jsx(
            "div",
            {
              className: `relative group/bento overflow-hidden ${hoverEffect === "zoom" ? "cursor-pointer" : ""}`,
              style: {
                ...spanStyle,
                borderRadius: `${borderRadius}px`,
                backgroundColor: "#f3f4f6"
              },
              children: /* @__PURE__ */ jsx(
                "img",
                {
                  src: imageGetUrl(item?.image),
                  alt: item.title || `Gallery Item ${index}`,
                  className: `w-full h-full object-cover transition-transform duration-700 ${hoverEffect === "zoom" ? "group-hover/bento:scale-110" : ""}`
                }
              )
            },
            index
          );
        }),
        items.length === 0 && /* @__PURE__ */ jsx(
          "div",
          {
            className: "w-full bg-gray-100 flex items-center justify-center",
            style: {
              gridColumn: "1/-1",
              gridRow: "span 1",
              borderRadius: `${borderRadius}px`
            },
            children: /* @__PURE__ */ jsx(
              "img",
              {
                src: imageGetUrl(void 0),
                alt: "Placeholder",
                className: "w-64 h-64 object-contain opacity-70"
              }
            )
          }
        )
      ]
    }
  );
};

function galleryRender({ data, style, className }) {
  const fakeElement = {
    id: "__render__",
    type: "custom",
    name: "gallery",
    style: style ?? {},
    className: className ?? "",
    data: data ?? {}
  };
  return React.createElement(GalleryComponent, {
    element: fakeElement,
    isPreview: true
  });
}
export {
  galleryRender as default
};
