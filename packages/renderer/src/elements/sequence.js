import React17 from "react";

import { useRef as useRef16 } from "react";

import React from "react";
import { jsx } from "react/jsx-runtime";
var EditableText = React.memo(({
  tagName,
  html,
  className,
  style,
  editable,
  onBlur,
  elementRef,
  ...props
}) => {
  const Tag = tagName || "div";
  return /* @__PURE__ */ jsx(
    Tag,
    {
      ref: elementRef,
      className,
      style,
      contentEditable: editable,
      suppressContentEditableWarning: true,
      onBlur,
      dangerouslySetInnerHTML: { __html: html },
      ...props
    }
  );
}, (prevProps, nextProps) => {
  return prevProps.html === nextProps.html && prevProps.editable === nextProps.editable && JSON.stringify(prevProps.style) === JSON.stringify(nextProps.style) && prevProps.className === nextProps.className;
});

import * as Icons7 from "lucide-react";

import {
  createContext,
  useContext,
  useState as useState7,
  useCallback as useCallback3,
  useRef as useRef15,
  useEffect as useEffect10
} from "react";

import { useRef, useEffect } from "react";
import * as Icons from "lucide-react";

var getGradientTextStyle = (color) => {
  if (color?.includes("gradient")) {
    return {
      backgroundImage: color,
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
      color: "transparent",
      WebkitTextFillColor: "transparent"
    };
  }
  return { color };
};

import { jsx as jsx2, jsxs } from "react/jsx-runtime";

import { useRef as useRef2, useEffect as useEffect2 } from "react";
import * as Icons2 from "lucide-react";
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";

import { useRef as useRef3 } from "react";
import * as Icons3 from "lucide-react";
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";

import React5, { useRef as useRef4, useEffect as useEffect3 } from "react";
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
var VideoCardComponent = ({ element, onUpdate, isPreview, deviceView = "desktop" }) => {
  const isMobile = deviceView === "mobile";
  const {
    videos = [],
    gap = 16,
    layout = "carousel",
    mobileLayout = "grid",
    slidesPerViewMobile = 1,
    slidesPerViewDesktop = 3,
    enableAutoplay = true,
    autoplayInterval = 3e3,
    gridColumnsMobile = 2,
    gridColumnsDesktop = 3,
    gridMinWidth = 220,
    mobileAspectRatio = "16/9",
    desktopAspectRatio = "16/9",
    videoHeightMobile,
    videoHeightDesktop,
    showControls = true,
    cardRadius = 12,
    allowFullscreen = true
  } = element.data || {};
  const sliderRef = useRef4(null);
  const activeLayout = isMobile && mobileLayout ? mobileLayout : layout;
  const isCarousel = activeLayout === "carousel";
  useEffect3(() => {
    if (!isCarousel || !enableAutoplay || !sliderRef.current) return;
    const el = sliderRef.current;
    const slides = isMobile ? slidesPerViewMobile : slidesPerViewDesktop;
    const id = setInterval(() => {
      const step = el.clientWidth / Math.max(1, slides) + (gap || 0);
      const nextLeft = el.scrollLeft + step;
      const isAtEnd = nextLeft + el.clientWidth >= el.scrollWidth - 1;
      el.scrollTo({ left: isAtEnd ? 0 : nextLeft, behavior: "smooth" });
    }, Math.max(1e3, autoplayInterval));
    return () => clearInterval(id);
  }, [
    isCarousel,
    enableAutoplay,
    autoplayInterval,
    isMobile,
    gap,
    slidesPerViewMobile,
    slidesPerViewDesktop
  ]);
  if (isCarousel) {
    const slides = isMobile ? slidesPerViewMobile : slidesPerViewDesktop;
    const cardWidthPercent = 100 / Math.max(1, slides);
    const aspect = isMobile ? mobileAspectRatio : desktopAspectRatio;
    const videoHeight = isMobile ? videoHeightMobile : videoHeightDesktop;
    return /* @__PURE__ */ jsxs4(
      "div",
      {
        ref: sliderRef,
        style: {
          ...element.style,
          display: "flex",
          overflowX: "auto",
          gap: `${gap}px`,
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          paddingBottom: "20px"
        },
        className: "w-full no-scrollbar",
        children: [
          videos.map((v, index) => /* @__PURE__ */ jsx5(
            "div",
            {
              style: {
                flex: `0 0 ${cardWidthPercent}%`,
                scrollSnapAlign: "start",
                borderRadius: `${cardRadius}px`
              },
              className: "overflow-hidden bg-gray-100",
              children: renderVideo(
                v.url,
                aspect,
                videoHeight,
                showControls,
                allowFullscreen
              )
            },
            index
          )),
          videos.length === 0 && /* @__PURE__ */ jsx5("div", { className: "w-full h-32 bg-gray-100 flex items-center justify-center text-gray-400", children: "No Videos Added" })
        ]
      }
    );
  }
  return /* @__PURE__ */ jsxs4(
    "div",
    {
      style: {
        ...element.style,
        display: "grid",
        gridTemplateColumns: (isMobile ? gridColumnsMobile : gridColumnsDesktop) ? `repeat(${isMobile ? gridColumnsMobile : gridColumnsDesktop}, 1fr)` : `repeat(auto-fit, minmax(${gridMinWidth}px, 1fr))`,
        gap: `${gap}px`
      },
      className: "w-full",
      children: [
        videos.map((v, index) => {
          const aspect = isMobile ? mobileAspectRatio : desktopAspectRatio;
          const videoHeight = isMobile ? videoHeightMobile : videoHeightDesktop;
          return /* @__PURE__ */ jsx5(
            "div",
            {
              className: "overflow-hidden bg-gray-200",
              style: { borderRadius: `${cardRadius}px` },
              children: renderVideo(
                v.url,
                aspect,
                videoHeight,
                showControls,
                allowFullscreen
              )
            },
            index
          );
        }),
        videos.length === 0 && /* @__PURE__ */ jsx5("div", { className: "w-full h-32 bg-gray-100 flex items-center justify-center text-gray-400", children: "No Videos Added" })
      ]
    }
  );
};
var isYouTubeUrl = (url) => {
  try {
    const u = new URL(url);
    return u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be");
  } catch {
    return false;
  }
};
var getYouTubeIdAndList = (url) => {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "");
      const list = u.searchParams.get("list") || void 0;
      return { id, list };
    }
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/watch")) {
        const id = u.searchParams.get("v") || void 0;
        const list = u.searchParams.get("list") || void 0;
        return { id, list };
      }
      const parts = u.pathname.split("/").filter(Boolean);
      const embedIdx = parts.indexOf("embed");
      if (embedIdx !== -1 && parts[embedIdx + 1]) {
        return { id: parts[embedIdx + 1], list: void 0 };
      }
    }
    return {};
  } catch {
    return {};
  }
};
var getYouTubeEmbedUrl = (url, controls) => {
  const { id, list } = getYouTubeIdAndList(url);
  if (list && !id) {
    return `https://www.youtube.com/embed/videoseries?list=${list}&controls=${controls ? 1 : 0}`;
  }
  if (!id) return null;
  const listParam = list ? `&list=${list}` : "";
  return `https://www.youtube.com/embed/${id}?controls=${controls ? 1 : 0}${listParam}`;
};
var isVimeoUrl = (url) => {
  try {
    const u = new URL(url);
    return u.hostname.includes("vimeo.com");
  } catch {
    return false;
  }
};
var getVimeoId = (url) => {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && /^[0-9]+$/.test(last)) return last;
    return null;
  } catch {
    return null;
  }
};
var getVimeoEmbedUrl = (url) => {
  const id = getVimeoId(url);
  if (!id) return null;
  return `https://player.vimeo.com/video/${id}`;
};
var renderVideo = (url, aspect, height, controls, allowFullscreen) => {
  if (isYouTubeUrl(url)) {
    const src = getYouTubeEmbedUrl(url, !!controls);
    if (src) {
      return /* @__PURE__ */ jsx5(
        "iframe",
        {
          src,
          className: "w-full h-full",
          style: {
            aspectRatio: aspect,
            height: height ? `${height}px` : void 0
          },
          frameBorder: "0",
          allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
          allowFullScreen: !!allowFullscreen
        }
      );
    }
  }
  if (isVimeoUrl(url)) {
    const src = getVimeoEmbedUrl(url);
    if (src) {
      return /* @__PURE__ */ jsx5(
        "iframe",
        {
          src,
          className: "w-full h-full",
          style: {
            aspectRatio: aspect,
            height: height ? `${height}px` : void 0
          },
          frameBorder: "0",
          allow: "autoplay; fullscreen; picture-in-picture",
          allowFullScreen: !!allowFullscreen
        }
      );
    }
  }
  return /* @__PURE__ */ jsx5(
    "video",
    {
      src: url,
      controls: !!controls,
      className: "w-full h-full",
      style: {
        aspectRatio: aspect,
        height: height ? `${height}px` : void 0
      }
    }
  );
};
var VideoCardDef = {
  name: "Video Cards",
  icon: React5.createElement("span", { className: "w-4 h-4" }, "\u{1F39E}\uFE0F"),
  category: "Media",
  component: VideoCardComponent,
  defaultData: {
    layout: "carousel",
    mobileLayout: "grid",
    gap: 16,
    slidesPerViewMobile: 1,
    slidesPerViewDesktop: 3,
    enableAutoplay: true,
    autoplayInterval: 3e3,
    gridColumnsMobile: 2,
    gridColumnsDesktop: 3,
    gridMinWidth: 220,
    mobileAspectRatio: "16/9",
    desktopAspectRatio: "16/9",
    showControls: true,
    cardRadius: 12,
    allowFullscreen: true,
    videos: [
      {
        url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
      },
      {
        url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
      },
      {
        url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
      }
    ]
  },
  settings: {
    layout: {
      type: "select",
      label: "Layout",
      options: [
        { label: "Grid", value: "grid" },
        { label: "Carousel", value: "carousel" }
      ],
      default: "carousel"
    },
    mobileLayout: {
      type: "select",
      label: "Mobile Layout",
      options: [
        { label: "Grid", value: "grid" },
        { label: "Carousel", value: "carousel" }
      ],
      default: "grid",
      conditionalDisplay: { field: "_device", value: "mobile" }
    },
    videos: {
      type: "array_object",
      label: "Videos",
      itemSchema: {
        url: {
          type: "text",
          label: "Video URL",
          default: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
        }
      },
      defaultItem: {
        url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
      }
    },
    gap: { type: "number_slider", label: "Gap", min: 0, max: 60, default: 16 },
    slidesPerViewDesktop: {
      type: "number_slider",
      label: "Slides (Desktop)",
      min: 1,
      max: 6,
      default: 3,
      conditionalDisplay: { field: "_device", value: "desktop" }
    },
    slidesPerViewMobile: {
      type: "number_slider",
      label: "Slides (Mobile)",
      min: 1,
      max: 3,
      default: 1,
      conditionalDisplay: { field: "_device", value: "mobile" }
    },
    gridColumnsDesktop: {
      type: "number_slider",
      label: "Grid Columns (Desktop)",
      min: 1,
      max: 6,
      default: 3,
      conditionalDisplay: { field: "_device", value: "desktop" }
    },
    gridColumnsMobile: {
      type: "number_slider",
      label: "Grid Columns (Mobile)",
      min: 1,
      max: 3,
      default: 2,
      conditionalDisplay: { field: "_device", value: "mobile" }
    },
    gridMinWidth: {
      type: "number_slider",
      label: "Grid Min Card Width",
      min: 160,
      max: 400,
      default: 220
    },
    desktopAspectRatio: {
      type: "select",
      label: "Aspect Ratio (Desktop)",
      options: [
        { label: "16:9", value: "16/9" },
        { label: "4:3", value: "4/3" },
        { label: "1:1", value: "1/1" },
        { label: "9:16", value: "9/16" }
      ],
      default: "16/9",
      conditionalDisplay: { field: "_device", value: "desktop" }
    },
    mobileAspectRatio: {
      type: "select",
      label: "Aspect Ratio (Mobile)",
      options: [
        { label: "16:9", value: "16/9" },
        { label: "4:3", value: "4/3" },
        { label: "1:1", value: "1/1" },
        { label: "9:16", value: "9/16" }
      ],
      default: "16/9",
      conditionalDisplay: { field: "_device", value: "mobile" }
    },
    videoHeightDesktop: {
      type: "number_slider",
      label: "Video Height (px, Desktop)",
      min: 160,
      max: 800,
      default: void 0,
      conditionalDisplay: { field: "_device", value: "desktop" }
    },
    videoHeightMobile: {
      type: "number_slider",
      label: "Video Height (px, Mobile)",
      min: 120,
      max: 600,
      default: void 0,
      conditionalDisplay: { field: "_device", value: "mobile" }
    },
    showControls: { type: "boolean", label: "Show Controls", default: true },
    cardRadius: {
      type: "number_slider",
      label: "Card Radius",
      min: 0,
      max: 24,
      default: 12
    },
    allowFullscreen: {
      type: "boolean",
      label: "Allow Fullscreen",
      default: true
    },
    enableAutoplay: {
      type: "boolean",
      label: "Autoplay Carousel",
      default: true
    },
    autoplayInterval: {
      type: "number_slider",
      label: "Autoplay Speed",
      min: 1e3,
      max: 8e3,
      default: 3e3
    }
  }
};

import { useRef as useRef5 } from "react";
import { List } from "lucide-react";

import * as Icons4 from "lucide-react";
import { jsx as jsx6 } from "react/jsx-runtime";

import { jsx as jsx7, jsxs as jsxs5 } from "react/jsx-runtime";

import { useRef as useRef6 } from "react";
import { ListOrdered } from "lucide-react";
import { jsx as jsx8, jsxs as jsxs6 } from "react/jsx-runtime";

import { Images } from "lucide-react";

var S3_PUBLIC_URL = process.env.NEXT_PUBLIC_S3_PUBLIC_URL || "https://assets.selorax.io";

import { jsx as jsx9, jsxs as jsxs7 } from "react/jsx-runtime";

import React8, { useRef as useRef7 } from "react";
import { Timer } from "lucide-react";
import { jsx as jsx10, jsxs as jsxs8 } from "react/jsx-runtime";

import { useEffect as useEffect4, useRef as useRef8, useState } from "react";
import { Images as Images2 } from "lucide-react";
import { jsx as jsx11, jsxs as jsxs9 } from "react/jsx-runtime";

import { useEffect as useEffect5, useMemo, useRef as useRef9, useState as useState2 } from "react";
import { Images as Images3 } from "lucide-react";
import { Fragment, jsx as jsx12, jsxs as jsxs10 } from "react/jsx-runtime";

import { useEffect as useEffect6, useMemo as useMemo2, useRef as useRef10, useState as useState3 } from "react";
import { List as List2 } from "lucide-react";
import { jsx as jsx13, jsxs as jsxs11 } from "react/jsx-runtime";

import {
  useCallback,
  useEffect as useEffect7,
  useMemo as useMemo3,
  useRef as useRef11,
  useState as useState4
} from "react";
import { Grid, ChevronLeft, ChevronRight } from "lucide-react";
import { Fragment as Fragment2, jsx as jsx14, jsxs as jsxs12 } from "react/jsx-runtime";

import * as Icons5 from "lucide-react";
import { jsx as jsx15, jsxs as jsxs13 } from "react/jsx-runtime";

import { useState as useState5, useRef as useRef12 } from "react";
import * as Icons6 from "lucide-react";
import { jsx as jsx16, jsxs as jsxs14 } from "react/jsx-runtime";

import { useEffect as useEffect8, useRef as useRef13 } from "react";
import { Code } from "lucide-react";
import { jsx as jsx17 } from "react/jsx-runtime";

import { useState as useState6, useCallback as useCallback2, useEffect as useEffect9, useRef as useRef14 } from "react";

import { jsx as jsx18 } from "react/jsx-runtime";
var FunnelContext = createContext(void 0);
var useFunnel = () => {
  const context = useContext(FunnelContext);
  return context ?? null;
};

import { jsx as jsx19, jsxs as jsxs15 } from "react/jsx-runtime";
var DynamicIcon2 = ({ name, size = 24, color, className }) => {
  const IconCmp = Icons7[name] || Icons7.HelpCircle;
  const isGradient = color?.includes("gradient");
  if (isGradient) {
    return /* @__PURE__ */ jsxs15(
      "span",
      {
        className,
        style: {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          width: size,
          height: size
        },
        children: [
          /* @__PURE__ */ jsx19(
            "span",
            {
              style: {
                position: "absolute",
                inset: 0,
                background: color,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              },
              children: /* @__PURE__ */ jsx19(IconCmp, { size, stroke: "currentColor", fill: "currentColor" })
            }
          ),
          /* @__PURE__ */ jsx19(IconCmp, { size, style: { opacity: 0 } })
        ]
      }
    );
  }
  return /* @__PURE__ */ jsx19(IconCmp, { size, style: { color }, className });
};
var SequenceComponent = ({ element, onUpdate, isPreview }) => {
  const funnelCtx = useFunnel();
  const deviceView = funnelCtx?.deviceView ?? "desktop";
  const isMobile = deviceView === "mobile";
  const {
    items = [],
    layout = "vertical-boxes",
    // "vertical-boxes", "vertical-dots", "chevron", "skewed"
    pyramidColor = "var(--color-input-background)",
    // Also serves as box background
    textColor = "var(--color-foreground)",
    numberColor = "var(--color-primary)",
    // Also serves as icon/accent color
    lineColor = "var(--color-border)",
    gap = 24,
    rowPadding = 16,
    textSize = 16,
    mobileRowPadding = 12,
    mobileTextSize = 14,
    mobileGap = 16,
    markerType = "number"
    // "number", "icon", "dot"
  } = element.data || {};
  const elementRef = useRef16(element);
  elementRef.current = element;
  const pad = isMobile ? mobileRowPadding : rowPadding;
  const fz = isMobile ? mobileTextSize : textSize;
  const gridGap = isMobile ? mobileGap : gap;
  const getBgStyle = (color) => {
    if (!color) return {};
    if (color.includes("gradient")) return { background: color };
    if (color.startsWith("var")) return { background: color };
    return { backgroundColor: color };
  };
  const updateItem = (index, field, value) => {
    const cur = elementRef.current;
    const list = cur.data?.items || [];
    const next = [...list];
    next[index] = { ...next[index], [field]: value };
    if (onUpdate) onUpdate(cur.id, { data: { ...cur.data, items: next } });
  };
  const renderMarkerContent = (item, index, size) => {
    if (markerType === "icon") {
      return /* @__PURE__ */ jsx19(
        DynamicIcon2,
        {
          name: item.icon || "Check",
          size: size * 0.6,
          color: numberColor
        }
      );
    }
    if (markerType === "number") {
      return /* @__PURE__ */ jsx19(
        EditableText,
        {
          tagName: "span",
          className: "font-bold leading-none",
          style: {
            ...getGradientTextStyle(numberColor),
            fontSize: `${size * 0.5}px`
          },
          html: item.number || String(index + 1),
          editable: !isPreview,
          onBlur: (e) => updateItem(index, "number", e.currentTarget.innerHTML)
        }
      );
    }
    return null;
  };
  const renderVerticalBoxes = () => {
    const isDot = markerType === "dot";
    const markerSize = isDot ? isMobile ? 16 : 20 : isMobile ? 32 : 40;
    return /* @__PURE__ */ jsxs15("div", { className: "flex flex-col w-full relative py-10", children: [
      /* @__PURE__ */ jsx19(
        "div",
        {
          className: "absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 transform md:-translate-x-1/2",
          style: { ...getBgStyle(lineColor) }
        }
      ),
      items.map((item, index) => {
        const isEven = index % 2 === 0;
        return /* @__PURE__ */ jsxs15(
          "div",
          {
            className: "flex flex-col md:flex-row w-full relative items-stretch min-h-[80px]",
            style: { marginBottom: index === items.length - 1 ? 0 : gridGap },
            children: [
              /* @__PURE__ */ jsx19(
                "div",
                {
                  className: "absolute left-4 md:left-1/2 transform -translate-x-1/2 z-10 flex items-center justify-center",
                  style: {
                    top: "50%",
                    marginTop: "-1px"
                    // Fine tune vertical alignment
                  },
                  children: /* @__PURE__ */ jsx19(
                    "div",
                    {
                      className: `rounded-full border-2 relative z-20 flex items-center justify-center ${!isDot ? "shadow-sm" : ""}`,
                      style: {
                        width: markerSize,
                        height: markerSize,
                        borderColor: lineColor,
                        ...getBgStyle(pyramidColor),
                        transform: "translateY(-50%)"
                      },
                      children: !isDot && renderMarkerContent(item, index, markerSize)
                    }
                  )
                }
              ),
              /* @__PURE__ */ jsx19(
                "div",
                {
                  className: `flex-1 w-full pl-12 md:pl-0 flex flex-col justify-center ${isEven ? "md:order-1 md:text-right md:pr-[128px]" : "md:order-2 md:text-left md:pl-[128px]"}`,
                  children: /* @__PURE__ */ jsxs15("div", { className: "relative w-full", children: [
                    /* @__PURE__ */ jsx19(
                      "div",
                      {
                        className: `hidden md:block absolute top-1/2 h-0.5 transform -translate-y-1/2 ${isEven ? "-right-16" : "-left-16"}`,
                        style: {
                          ...getBgStyle(lineColor),
                          width: "64px"
                        }
                      }
                    ),
                    /* @__PURE__ */ jsxs15(
                      "div",
                      {
                        className: "rounded-lg shadow-sm group hover:shadow-md transition-shadow inline-block w-full",
                        style: {
                          ...getBgStyle(pyramidColor),
                          padding: `${pad}px`
                        },
                        children: [
                          /* @__PURE__ */ jsx19(
                            EditableText,
                            {
                              tagName: "div",
                              className: "font-medium leading-snug",
                              style: {
                                ...getGradientTextStyle(textColor),
                                fontSize: `${fz}px`
                              },
                              html: item.text,
                              editable: !isPreview,
                              onBlur: (e) => updateItem(index, "text", e.currentTarget.innerHTML)
                            }
                          ),
                          item.subtext && /* @__PURE__ */ jsx19(
                            EditableText,
                            {
                              tagName: "div",
                              className: "mt-3 opacity-80 border-t pt-2",
                              style: {
                                borderColor: lineColor,
                                ...getGradientTextStyle(textColor),
                                fontSize: `${fz}px`
                              },
                              html: item.subtext,
                              editable: !isPreview,
                              onBlur: (e) => updateItem(
                                index,
                                "subtext",
                                e.currentTarget.innerHTML
                              )
                            }
                          )
                        ]
                      }
                    )
                  ] })
                }
              ),
              /* @__PURE__ */ jsx19(
                "div",
                {
                  className: `flex-1 hidden md:block ${isEven ? "md:order-2" : "md:order-1"}`
                }
              )
            ]
          },
          index
        );
      })
    ] });
  };
  const renderVerticalLeft = () => {
    const isDot = markerType === "dot";
    const markerSize = isDot ? isMobile ? 16 : 20 : isMobile ? 32 : 40;
    const LINE_HEIGHT_FACTOR = 1.375;
    const topOffset = pad + fz * LINE_HEIGHT_FACTOR / 2;
    return /* @__PURE__ */ jsxs15("div", { className: "flex flex-col w-full relative py-4 md:py-6", children: [
      /* @__PURE__ */ jsx19(
        "div",
        {
          className: "absolute left-4 md:left-6 top-0 bottom-0 w-0.5",
          style: { ...getBgStyle(lineColor) }
        }
      ),
      items.map((item, index) => {
        return /* @__PURE__ */ jsxs15(
          "div",
          {
            className: "flex w-full relative items-start",
            style: { marginBottom: index === items.length - 1 ? 0 : gridGap },
            children: [
              /* @__PURE__ */ jsx19(
                "div",
                {
                  className: "absolute left-4 md:left-6 transform -translate-x-1/2 z-10 flex items-center justify-center rounded-full border-2",
                  style: {
                    top: topOffset,
                    marginTop: -markerSize / 2,
                    // Center vertically on the topOffset line
                    width: markerSize,
                    height: markerSize,
                    borderColor: lineColor,
                    ...getBgStyle(pyramidColor)
                  },
                  children: !isDot && renderMarkerContent(item, index, markerSize)
                }
              ),
              /* @__PURE__ */ jsx19(
                "div",
                {
                  className: "absolute left-4 md:left-6 h-0.5 transform -translate-y-1/2",
                  style: {
                    top: topOffset,
                    ...getBgStyle(lineColor),
                    width: isMobile ? "24px" : "40px"
                    // Responsive connector length
                  }
                }
              ),
              /* @__PURE__ */ jsx19("div", { className: `w-full ${isMobile ? "pl-[44px]" : "pl-[56px]"}`, children: /* @__PURE__ */ jsxs15(
                "div",
                {
                  className: "rounded-lg shadow-sm w-full",
                  style: { ...getBgStyle(pyramidColor), padding: `${pad}px` },
                  children: [
                    /* @__PURE__ */ jsx19(
                      EditableText,
                      {
                        tagName: "div",
                        className: "font-medium leading-snug",
                        style: {
                          ...getGradientTextStyle(textColor),
                          fontSize: `${fz}px`
                        },
                        html: item.text,
                        editable: !isPreview,
                        onBlur: (e) => updateItem(index, "text", e.currentTarget.innerHTML)
                      }
                    ),
                    item.subtext && /* @__PURE__ */ jsx19(
                      EditableText,
                      {
                        tagName: "div",
                        className: "mt-2 opacity-80",
                        style: {
                          ...getGradientTextStyle(textColor),
                          fontSize: `${fz}px`
                        },
                        html: item.subtext,
                        editable: !isPreview,
                        onBlur: (e) => updateItem(index, "subtext", e.currentTarget.innerHTML)
                      }
                    )
                  ]
                }
              ) })
            ]
          },
          index
        );
      })
    ] });
  };
  const renderListSkewed = () => {
    return /* @__PURE__ */ jsx19("div", { className: "flex flex-col w-full", style: { gap: `${gridGap}px` }, children: items.map((item, index) => {
      return /* @__PURE__ */ jsxs15(
        "div",
        {
          className: "flex items-center w-full flex-col md:flex-row",
          children: [
            /* @__PURE__ */ jsx19(
              "div",
              {
                className: "flex-shrink-0 w-28 h-14 md:w-40 md:h-16 flex items-center justify-center relative",
                style: {
                  ...getBgStyle(pyramidColor),
                  clipPath: "polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)",
                  marginBottom: isMobile ? `${pad}px` : void 0
                },
                children: /* @__PURE__ */ jsx19("div", { className: "flex items-center justify-center transform skew-x-[-10deg]", children: markerType === "icon" ? /* @__PURE__ */ jsx19(
                  DynamicIcon2,
                  {
                    name: item.icon || "Check",
                    size: isMobile ? 20 : 28,
                    color: numberColor
                  }
                ) : markerType === "number" ? /* @__PURE__ */ jsx19(
                  EditableText,
                  {
                    tagName: "span",
                    className: "text-xl md:text-3xl font-bold",
                    style: getGradientTextStyle(numberColor),
                    html: item.number || String(index + 1),
                    editable: !isPreview,
                    onBlur: (e) => updateItem(index, "number", e.currentTarget.innerHTML)
                  }
                ) : null })
              }
            ),
            /* @__PURE__ */ jsx19(
              "div",
              {
                className: "flex-1 w-full flex items-center",
                style: { paddingLeft: `${pad}px`, paddingRight: `${pad}px` },
                children: /* @__PURE__ */ jsx19(
                  EditableText,
                  {
                    tagName: "div",
                    className: "font-medium leading-snug",
                    style: {
                      ...getGradientTextStyle(textColor),
                      fontSize: `${fz}px`
                    },
                    html: item.text,
                    editable: !isPreview,
                    onBlur: (e) => updateItem(index, "text", e.currentTarget.innerHTML)
                  }
                )
              }
            )
          ]
        },
        index
      );
    }) });
  };
  const renderGridRounded = () => {
    return /* @__PURE__ */ jsx19(
      "div",
      {
        className: `grid w-full ${isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-3"}`,
        style: { gap: `${gridGap}px` },
        children: items.map((item, index) => {
          return /* @__PURE__ */ jsxs15("div", { className: "flex flex-col items-center text-center", children: [
            /* @__PURE__ */ jsx19(
              "div",
              {
                className: "w-full relative flex items-center justify-center",
                style: {
                  ...getBgStyle(pyramidColor),
                  borderRadius: "9999px",
                  // Pill shape
                  padding: `${pad}px`,
                  marginBottom: `${gridGap}px`
                },
                children: markerType === "icon" ? /* @__PURE__ */ jsx19(
                  DynamicIcon2,
                  {
                    name: item.icon || "Check",
                    size: isMobile ? 24 : 28,
                    color: numberColor
                  }
                ) : markerType === "number" ? /* @__PURE__ */ jsx19(
                  EditableText,
                  {
                    tagName: "span",
                    className: "font-bold",
                    style: {
                      ...getGradientTextStyle(numberColor),
                      fontSize: `${fz}px`
                    },
                    html: item.number || String(index + 1),
                    editable: !isPreview,
                    onBlur: (e) => updateItem(index, "number", e.currentTarget.innerHTML)
                  }
                ) : null
              }
            ),
            /* @__PURE__ */ jsx19(
              EditableText,
              {
                tagName: "div",
                className: "font-medium leading-snug px-2",
                style: {
                  ...getGradientTextStyle(textColor),
                  fontSize: `${fz}px`
                },
                html: item.text,
                editable: !isPreview,
                onBlur: (e) => updateItem(index, "text", e.currentTarget.innerHTML)
              }
            )
          ] }, index);
        })
      }
    );
  };
  const renderGridSkewed = () => {
    return /* @__PURE__ */ jsx19(
      "div",
      {
        className: `grid w-full ${isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-3"}`,
        style: { gap: `${gridGap}px` },
        children: items.map((item, index) => {
          return /* @__PURE__ */ jsxs15("div", { className: "flex flex-col items-center text-center", children: [
            /* @__PURE__ */ jsx19(
              "div",
              {
                className: "w-full relative flex items-center justify-center",
                style: {
                  ...getBgStyle(pyramidColor),
                  clipPath: "polygon(10% 0%, 100% 0%, 90% 100%, 0% 100%)",
                  padding: `${pad}px`,
                  marginBottom: `${gridGap}px`
                },
                children: markerType === "icon" ? /* @__PURE__ */ jsx19(
                  DynamicIcon2,
                  {
                    name: item.icon || "Check",
                    size: isMobile ? 24 : 28,
                    color: numberColor
                  }
                ) : /* @__PURE__ */ jsx19(
                  EditableText,
                  {
                    tagName: "span",
                    className: "font-bold",
                    style: {
                      ...getGradientTextStyle(numberColor),
                      fontSize: `${fz}px`
                    },
                    html: item.number || String(index + 1),
                    editable: !isPreview,
                    onBlur: (e) => updateItem(index, "number", e.currentTarget.innerHTML)
                  }
                )
              }
            ),
            /* @__PURE__ */ jsx19(
              EditableText,
              {
                tagName: "div",
                className: "font-medium leading-snug px-2",
                style: {
                  ...getGradientTextStyle(textColor),
                  fontSize: `${fz}px`
                },
                html: item.text,
                editable: !isPreview,
                onBlur: (e) => updateItem(index, "text", e.currentTarget.innerHTML)
              }
            )
          ] }, index);
        })
      }
    );
  };
  return /* @__PURE__ */ jsxs15("div", { style: element.style, className: "w-full", children: [
    layout === "vertical-boxes" && renderVerticalBoxes(),
    layout === "vertical-left" && renderVerticalLeft(),
    layout === "list-skewed" && renderListSkewed(),
    layout === "grid-rounded" && renderGridRounded(),
    layout === "grid-skewed" && renderGridSkewed(),
    ![
      "vertical-boxes",
      "vertical-left",
      "list-skewed",
      "grid-rounded",
      "grid-skewed"
    ].includes(layout) && renderVerticalBoxes()
  ] });
};

function sequenceRender({ data, style, className }) {
  const fakeElement = {
    id: "__render__",
    type: "custom",
    name: "sequence",
    style: style ?? {},
    className: className ?? "",
    data: data ?? {}
  };
  return React17.createElement(SequenceComponent, {
    element: fakeElement,
    isPreview: true
  });
}
export {
  sequenceRender as default
};
