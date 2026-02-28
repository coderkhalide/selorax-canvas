import React3 from "react";

import { useEffect, useRef, useState } from "react";
import { Images } from "lucide-react";

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

import { jsx as jsx2, jsxs } from "react/jsx-runtime";
var HeroSliderComponent = ({ element, onUpdate, isPreview, deviceView = "desktop" }) => {
  const {
    slides = [],
    enableAutoplay = true,
    autoplayInterval = 3e3,
    showIndicators = true,
    showArrows = true,
    heightDesktop = 540,
    heightMobile = 420,
    borderRadius = 12,
    layout = "classic",
    titleColor = "var(--color-foreground-heading)",
    subTitleColor = "var(--color-foreground)",
    buttonBg = "var(--color-primary)",
    buttonTextColor = "#ffffff",
    chevronSize = 20,
    chevronOffsetY = 0
  } = element.data || {};
  const scrollerRef = useRef(null);
  const [current, setCurrent] = useState(0);
  const slideHeight = deviceView === "mobile" ? heightMobile : heightDesktop;
  const {
    enableRightAd = false,
    rightAdTitle = "\u09A6\u09C8\u09A8\u09BF\u0995 \u09A4\u09BE\u099C\u09BE \u09AA\u09A3\u09CD\u09AF",
    rightAdContent = "\u0986\u099C\u0995\u09C7\u09B0 \u09B8\u09C7\u09B0\u09BE \u0985\u09AB\u09BE\u09B0",
    rightAdUrl = "/shop",
    rightAdImage = "https://placehold.co/500x600"
  } = element.data || {};
  const showRightAd = deviceView !== "mobile" && !!enableRightAd && !!(rightAdImage || rightAdTitle || rightAdContent);
  const sliderWidthClass = showRightAd ? "md:w-4/6 w-full" : "w-full";
  const getSlides = () => Array.from(scrollerRef.current?.children || []);
  const getSelectedIndex = () => {
    const el = scrollerRef.current;
    if (!el) return 0;
    const slidesEls = getSlides();
    if (slidesEls.length === 0) return 0;
    const x = el.scrollLeft;
    let idx = 0;
    let min = Math.abs(slidesEls[0].offsetLeft - x);
    for (let i = 1; i < slidesEls.length; i++) {
      const d = Math.abs(slidesEls[i].offsetLeft - x);
      if (d < min) {
        min = d;
        idx = i;
      }
    }
    return idx;
  };
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => setCurrent(getSelectedIndex());
    el.addEventListener("scroll", onScroll, { passive: true });
    const onResize = () => onScroll();
    window.addEventListener("resize", onResize);
    onResize();
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [slides.length]);
  useEffect(() => {
    if (!enableAutoplay) return;
    const el = scrollerRef.current;
    if (!el) return;
    const id = setInterval(() => {
      const slidesEls = getSlides();
      if (!slidesEls.length) return;
      const next = (current + 1) % slidesEls.length;
      el.scrollTo({ left: slidesEls[next].offsetLeft, behavior: "smooth" });
    }, Math.max(500, Number(autoplayInterval) || 3e3));
    return () => clearInterval(id);
  }, [enableAutoplay, autoplayInterval, current, slides.length]);
  const scrollTo = (index) => {
    const el = scrollerRef.current;
    const slidesEls = getSlides();
    if (!el || !slidesEls.length) return;
    const i = Math.max(0, Math.min(index, slidesEls.length - 1));
    el.scrollTo({ left: slidesEls[i].offsetLeft, behavior: "smooth" });
  };
  const updateSlide = (idx, field, value) => {
    if (!onUpdate) return;
    const list = element.data?.slides || [];
    const next = [...list];
    next[idx] = { ...next[idx], [field]: value };
    onUpdate(element.id, { data: { ...element.data, slides: next } });
  };
  if (!slides || slides.length === 0) {
    return /* @__PURE__ */ jsx2(
      "div",
      {
        className: "w-full rounded border border-gray-200 bg-gray-50 text-gray-500 flex items-center justify-center",
        style: { ...element.style, height: `${slideHeight}px` },
        children: "No slides added"
      }
    );
  }
  return /* @__PURE__ */ jsx2("section", { className: `relative ${element.className || ""}`, style: element.style, children: /* @__PURE__ */ jsxs("div", { className: "w-full md:flex md:gap-4", children: [
    /* @__PURE__ */ jsxs("div", { className: `${sliderWidthClass} overflow-hidden relative`, children: [
      /* @__PURE__ */ jsx2(
        "div",
        {
          ref: scrollerRef,
          className: "flex overflow-x-auto snap-x snap-mandatory scrollbar-hide",
          style: {
            WebkitOverflowScrolling: "touch",
            scrollBehavior: "smooth"
          },
          children: slides.map((data, index) => {
            const alignCenter = !!data.center;
            const dark = !!data.is_dark;
            const showBtn = !!data.has_button;
            return /* @__PURE__ */ jsx2(
              "div",
              {
                className: "flex-shrink-0 snap-start relative w-full",
                style: { minWidth: "100%" },
                children: /* @__PURE__ */ jsxs("div", { className: "relative w-full", children: [
                  /* @__PURE__ */ jsx2(
                    "img",
                    {
                      src: imageGetUrl(data.image),
                      alt: data.title || `Slide ${index + 1}`,
                      className: "w-full object-cover",
                      style: {
                        height: `${slideHeight}px`,
                        borderRadius: `${borderRadius}px`,
                        backgroundColor: "#f3f4f6"
                      }
                    }
                  ),
                  layout === "classic" && /* @__PURE__ */ jsx2(
                    "div",
                    {
                      className: `absolute inset-0 p-6 md:p-10 ${alignCenter ? "flex items-center justify-center" : "flex items-center"}`,
                      children: /* @__PURE__ */ jsxs("div", { className: "max-w-2xl", children: [
                        /* @__PURE__ */ jsx2(
                          EditableText,
                          {
                            tagName: "h2",
                            className: `text-2xl md:text-4xl font-bold`,
                            style: dark ? { color: "#ffffff" } : getGradientTextStyle(titleColor),
                            html: data.title || "",
                            editable: !isPreview,
                            onBlur: (e) => updateSlide(
                              index,
                              "title",
                              e.currentTarget.innerHTML
                            )
                          }
                        ),
                        /* @__PURE__ */ jsx2(
                          EditableText,
                          {
                            tagName: "p",
                            className: `mt-2 text-sm md:text-base`,
                            style: dark ? { color: "rgba(255,255,255,0.8)" } : getGradientTextStyle(subTitleColor),
                            html: data.sub_title || "",
                            editable: !isPreview,
                            onBlur: (e) => updateSlide(
                              index,
                              "sub_title",
                              e.currentTarget.innerHTML
                            )
                          }
                        ),
                        showBtn && /* @__PURE__ */ jsx2(
                          "a",
                          {
                            href: data.button_link || "#",
                            className: "inline-flex mt-4 px-5 py-2 rounded-md font-semibold",
                            style: {
                              background: buttonBg,
                              color: buttonTextColor
                            },
                            children: data.button_text || "Shop Now"
                          }
                        )
                      ] })
                    }
                  ),
                  layout === "organic" && /* @__PURE__ */ jsx2("div", { className: "absolute inset-0 md:py-16 md:px-14 py-10 px-6 flex flex-col h-full", children: /* @__PURE__ */ jsxs("div", { className: "flex-1 flex flex-col justify-between", children: [
                    /* @__PURE__ */ jsxs("div", { children: [
                      /* @__PURE__ */ jsx2(
                        EditableText,
                        {
                          tagName: "h2",
                          className: "font-bold md:text-6xl sm:text-4xl text-xl",
                          style: dark ? { color: "#ffffff" } : { color: "#111827" },
                          html: data.title || "",
                          editable: !isPreview,
                          onBlur: (e) => updateSlide(
                            index,
                            "title",
                            e.currentTarget.innerHTML
                          )
                        }
                      ),
                      /* @__PURE__ */ jsx2(
                        EditableText,
                        {
                          tagName: "p",
                          className: "md:mt-6 mt-4 md:text-xl text-base",
                          style: dark ? { color: "rgba(255,255,255,0.8)" } : { color: "#4b5563" },
                          html: data.sub_title || "",
                          editable: !isPreview,
                          onBlur: (e) => updateSlide(
                            index,
                            "sub_title",
                            e.currentTarget.innerHTML
                          )
                        }
                      )
                    ] }),
                    showBtn && /* @__PURE__ */ jsx2(
                      "a",
                      {
                        href: data.button_link || "#",
                        className: "w-fit md:px-6 md:py-3 px-3 py-2 rounded-md font-semibold md:text-base text-xs",
                        style: {
                          background: dark ? "#ffffff" : buttonBg,
                          color: dark ? "var(--color-primary)" : buttonTextColor
                        },
                        children: data.button_text || "Shop Now"
                      }
                    )
                  ] }) }),
                  layout === "minimal" && /* @__PURE__ */ jsx2("div", { className: "absolute inset-0 p-6 md:p-8 flex items-end", children: /* @__PURE__ */ jsxs("div", { className: "bg-white/80 backdrop-blur rounded-lg p-4 md:p-6", children: [
                    /* @__PURE__ */ jsx2(
                      EditableText,
                      {
                        tagName: "h2",
                        className: "text-xl md:text-3xl font-semibold",
                        style: getGradientTextStyle(titleColor),
                        html: data.title || "",
                        editable: !isPreview,
                        onBlur: (e) => updateSlide(
                          index,
                          "title",
                          e.currentTarget.innerHTML
                        )
                      }
                    ),
                    /* @__PURE__ */ jsx2(
                      EditableText,
                      {
                        tagName: "p",
                        className: "mt-2 text-sm md:text-base opacity-80",
                        style: getGradientTextStyle(subTitleColor),
                        html: data.sub_title || "",
                        editable: !isPreview,
                        onBlur: (e) => updateSlide(
                          index,
                          "sub_title",
                          e.currentTarget.innerHTML
                        )
                      }
                    ),
                    showBtn && /* @__PURE__ */ jsx2(
                      "a",
                      {
                        href: data.button_link || "#",
                        className: "inline-flex mt-3 px-4 py-2 rounded-md font-medium",
                        style: {
                          background: buttonBg,
                          color: buttonTextColor
                        },
                        children: data.button_text || "Shop Now"
                      }
                    )
                  ] }) })
                ] })
              },
              data.id || index
            );
          })
        }
      ),
      showArrows && /* @__PURE__ */ jsxs(
        "div",
        {
          className: "absolute right-6 hidden md:flex flex-col gap-3 z-10",
          style: {
            top: `calc(50% + ${chevronOffsetY}px)`,
            transform: "translateY(-50%)"
          },
          children: [
            /* @__PURE__ */ jsx2(
              "button",
              {
                type: "button",
                className: "relative hover:opacity-80 bg-white/90 rounded-md p-2 shadow",
                onClick: () => scrollTo(current - 1),
                "aria-label": "Previous",
                children: /* @__PURE__ */ jsx2(
                  "svg",
                  {
                    viewBox: "0 0 24 24",
                    width: chevronSize,
                    height: chevronSize,
                    fill: "none",
                    stroke: "currentColor",
                    children: /* @__PURE__ */ jsx2("path", { d: "M15 6l-6 6 6 6" })
                  }
                )
              }
            ),
            /* @__PURE__ */ jsx2(
              "button",
              {
                type: "button",
                className: "relative hover:opacity-80 bg-white/90 rounded-md p-2 shadow",
                onClick: () => scrollTo(current + 1),
                "aria-label": "Next",
                children: /* @__PURE__ */ jsx2(
                  "svg",
                  {
                    viewBox: "0 0 24 24",
                    width: chevronSize,
                    height: chevronSize,
                    fill: "none",
                    stroke: "currentColor",
                    children: /* @__PURE__ */ jsx2("path", { d: "M9 18l6-6-6-6" })
                  }
                )
              }
            )
          ]
        }
      ),
      showIndicators && /* @__PURE__ */ jsx2("div", { className: "absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10", children: slides.map((_, i) => /* @__PURE__ */ jsx2(
        "button",
        {
          type: "button",
          onClick: () => scrollTo(i),
          "aria-label": `Go to slide ${i + 1}`,
          className: `h-1.5 rounded-full transition-all duration-300 ${i === current ? "w-8" : "w-1.5"}`,
          style: {
            background: i === current ? "var(--color-primary)" : "color-mix(in srgb, var(--color-primary) 30%, transparent)"
          }
        },
        i
      )) })
    ] }),
    showRightAd && /* @__PURE__ */ jsxs("div", { className: "w-2/6 md:rounded-2xl hidden md:block relative", children: [
      /* @__PURE__ */ jsxs("div", { className: "absolute top-0 left-0 w-full h-full md:py-16 md:px-14 flex flex-col justify-between", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx2(
            EditableText,
            {
              tagName: "h2",
              className: "text-4xl font-bold text-gray-800 mb-4 font-quicksand",
              html: rightAdTitle || "",
              editable: !isPreview,
              onBlur: (e) => onUpdate && onUpdate(element.id, {
                data: {
                  ...element.data,
                  rightAdTitle: e.currentTarget.innerHTML
                }
              })
            }
          ),
          /* @__PURE__ */ jsx2(
            EditableText,
            {
              tagName: "p",
              className: "text-gray-600",
              html: rightAdContent || "",
              editable: !isPreview,
              onBlur: (e) => onUpdate && onUpdate(element.id, {
                data: {
                  ...element.data,
                  rightAdContent: e.currentTarget.innerHTML
                }
              })
            }
          )
        ] }),
        rightAdUrl && /* @__PURE__ */ jsx2(
          "a",
          {
            href: rightAdUrl || "/",
            className: "bg-primary text-white w-fit px-6 py-3 rounded-md block font-semibold mt-20",
            children: "Shop Now"
          }
        )
      ] }),
      /* @__PURE__ */ jsx2(
        "img",
        {
          src: imageGetUrl(rightAdImage),
          alt: rightAdTitle || "Right Ad",
          className: "w-full object-cover rounded-2xl",
          style: { height: `${slideHeight}px` }
        }
      )
    ] })
  ] }) });
};

function hero_sliderRender({ data, style, className }) {
  const fakeElement = {
    id: "__render__",
    type: "custom",
    name: "hero_slider",
    style: style ?? {},
    className: className ?? "",
    data: data ?? {}
  };
  return React3.createElement(HeroSliderComponent, {
    element: fakeElement,
    isPreview: true
  });
}
export {
  hero_sliderRender as default
};
