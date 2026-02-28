import React2 from "react";

import React, { useRef, useEffect } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
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
  const sliderRef = useRef(null);
  const activeLayout = isMobile && mobileLayout ? mobileLayout : layout;
  const isCarousel = activeLayout === "carousel";
  useEffect(() => {
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
    return /* @__PURE__ */ jsxs(
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
          videos.map((v, index) => /* @__PURE__ */ jsx(
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
          videos.length === 0 && /* @__PURE__ */ jsx("div", { className: "w-full h-32 bg-gray-100 flex items-center justify-center text-gray-400", children: "No Videos Added" })
        ]
      }
    );
  }
  return /* @__PURE__ */ jsxs(
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
          return /* @__PURE__ */ jsx(
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
        videos.length === 0 && /* @__PURE__ */ jsx("div", { className: "w-full h-32 bg-gray-100 flex items-center justify-center text-gray-400", children: "No Videos Added" })
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
      return /* @__PURE__ */ jsx(
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
      return /* @__PURE__ */ jsx(
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
  return /* @__PURE__ */ jsx(
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
  icon: React.createElement("span", { className: "w-4 h-4" }, "\u{1F39E}\uFE0F"),
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

function video_cardsRender({ data, style, className }) {
  const fakeElement = {
    id: "__render__",
    type: "custom",
    name: "video_cards",
    style: style ?? {},
    className: className ?? "",
    data: data ?? {}
  };
  return React2.createElement(VideoCardComponent, {
    element: fakeElement,
    isPreview: true
  });
}
export {
  video_cardsRender as default
};
