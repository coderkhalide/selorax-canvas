import React2 from "react";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Grid, ChevronLeft, ChevronRight } from "lucide-react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var buildKey = (item, index) => item?.slug || item?.category_slug || item?.id || item?.category_id || `${item?.name || "category"}-${index}`;
var resolveHref = (item) => {
  if (item?.slug) return `/category/${item.slug}`;
  if (item?.category_slug) return `/category/${item.category_slug}`;
  return "/products";
};
var resolveLabel = (item) => item?.name || item?.title || "Collection";
var resolveImage = (item) => item?.image || item?.thumbnail || item?.cover_image || item?.cover_photo || (typeof item?.images === "string" ? item.images.split(",")[0] : null) || item?.media || item?.icon || item?.icon_url || item?.icon_white || item?.icon_black || null;
var CustomCategoryComponent = ({
  element,
  onUpdate,
  isPreview,
  deviceView
}) => {
  const {
    categories = [],
    itemWidth = 160,
    itemHeight = 128,
    gap = 16,
    scrollStep = 320,
    showArrows = true,
    showLabels = true,
    autoplay = true,
    autoplaySpeed = 3e3,
    labelColor = "#0D1D17",
    placeholderColor = "#7A7F85",
    borderColor = "#E1E4E6",
    hoverBg = "#F5F5F5",
    // New settings
    layout = "simple",
    heading = "Featured Categories",
    description = "Pellentesque ante neque, faucibus et delito an pretium vestibulum del varius quam.",
    headingColor = "#1D2B3A",
    descriptionColor = "#555C63",
    cardBackground = "#F5F5F5",
    cardHoverBackground = "#E9F6F1",
    activeColor = "#0F645D",
    inactiveColor = "#CBD8E0",
    // Slider-specific
    sliderGap = 24,
    sliderCardBg = "#FFFFFF",
    sliderBorderColor = "#E1E4E6",
    sliderActiveDotColor = "#0D1D17",
    sliderInactiveDotColor = "#9CA3AF",
    sliderPerSm = 1,
    sliderPerMd = 2,
    sliderPerLg = 3,
    sliderPerXl = 4,
    sliderPer2xl = 6,
    // Simplified controls
    mobileItems = 1,
    desktopItems = 4
  } = element.data || {};
  const list = useMemo(() => (categories || []).filter(Boolean), [categories]);
  const scrollerRef = useRef(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [currentSnap, setCurrentSnap] = useState(0);
  const [snapCount, setSnapCount] = useState(1);
  const [perView, setPerView] = useState(1);
  const updateButtons = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) {
      setCanPrev(false);
      setCanNext(false);
      return;
    }
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const eps = 8;
    setCanPrev(scrollLeft > eps);
    setCanNext(scrollLeft + clientWidth < scrollWidth - eps);
  }, []);
  useEffect(() => {
    updateButtons();
    window.addEventListener("resize", updateButtons);
    return () => window.removeEventListener("resize", updateButtons);
  }, [list, updateButtons]);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const handler = () => updateButtons();
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [updateButtons]);
  useEffect(() => {
    if (layout !== "slider" && layout !== "shop_by_category" && layout !== "mf_card")
      return;
    const compute = () => {
      const w = typeof window !== "undefined" ? window.innerWidth : 1024;
      let pv = 1;
      if (layout === "shop_by_category" || layout === "mf_card") {
        const isMobile = deviceView === "mobile" ? true : deviceView === "desktop" ? false : w < 768;
        pv = isMobile ? Math.max(1, mobileItems) : Math.max(1, desktopItems);
      } else {
        pv = w < 640 ? Math.max(1, sliderPerSm) : w < 768 ? Math.max(1, sliderPerMd) : w < 1024 ? Math.max(1, sliderPerLg) : w < 1280 ? Math.max(1, sliderPerXl) : Math.max(1, sliderPer2xl);
      }
      setPerView(pv);
      const count = Math.max(1, Math.ceil(list.length / pv));
      setSnapCount(count);
      const el = scrollerRef.current;
      if (el) {
        const idx = Math.round(el.scrollLeft / el.clientWidth);
        setCurrentSnap(Math.min(count - 1, Math.max(0, idx)));
      }
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [
    list.length,
    layout,
    sliderPerSm,
    sliderPerMd,
    sliderPerLg,
    sliderPerXl,
    sliderPer2xl,
    mobileItems,
    desktopItems,
    deviceView
  ]);
  useEffect(() => {
    if (layout !== "slider" && layout !== "mf_card") return;
    const el = scrollerRef.current;
    if (!el) return;
    const handler = () => {
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      setCurrentSnap((prev) => prev !== idx ? idx : prev);
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [layout]);
  const handleScroll = useCallback(
    (dir) => {
      const el = scrollerRef.current;
      if (!el) return;
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const maxScroll = scrollWidth - clientWidth;
      const step = layout === "featured" ? clientWidth / 2 : layout === "slider" ? clientWidth : layout === "shop_by_category" ? clientWidth : layout === "mf_card" ? clientWidth : scrollStep;
      if (dir === "next") {
        if (scrollLeft >= maxScroll - 10) {
          el.scrollTo({ left: 0, behavior: "smooth" });
        } else {
          el.scrollBy({ left: step, behavior: "smooth" });
        }
      } else {
        el.scrollBy({ left: -step, behavior: "smooth" });
      }
      requestAnimationFrame(updateButtons);
    },
    [scrollStep, updateButtons, layout]
  );
  const handleLinkClick = useCallback(
    (e) => {
      if (!isPreview) e.preventDefault();
    },
    [isPreview]
  );
  useEffect(() => {
    if (!autoplay || isHovered || !list.length) return;
    const interval = setInterval(() => {
      handleScroll("next");
    }, autoplaySpeed);
    return () => clearInterval(interval);
  }, [autoplay, autoplaySpeed, isHovered, list.length, handleScroll]);
  if (!list.length) return null;
  if (layout === "shop_by_category") {
    const visible = list.slice(0, 10);
    return /* @__PURE__ */ jsx(
      "section",
      {
        className: `py-12 md:py-20 ${element.className || ""}`,
        style: {
          ...element.style,
          background: element.data?.sectionBg || "var(--color-variant-background-color)"
        },
        onMouseEnter: () => setIsHovered(true),
        onMouseLeave: () => setIsHovered(false),
        children: /* @__PURE__ */ jsxs("div", { className: "mx-auto container px-4", children: [
          /* @__PURE__ */ jsx("div", { className: "flex flex-col items-center text-center", children: /* @__PURE__ */ jsx(
            "h2",
            {
              className: "mt-3 text-3xl font-semibold md:text-4xl",
              style: {
                color: element.data?.headingColor || "var(--color-foreground-heading)"
              },
              children: heading
            }
          ) }),
          /* @__PURE__ */ jsxs("div", { className: "relative mt-10", children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => handleScroll("prev"),
                disabled: !canPrev,
                className: "absolute left-[-18px] top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border shadow-[0_12px_30px_rgba(0,0,0,0.12)] transition disabled:cursor-not-allowed disabled:opacity-40 sm:left-[-28px]",
                style: {
                  background: element.data?.arrowBgColor || "var(--color-primary-button-text)",
                  borderColor: element.data?.borderColor || "var(--color-border)",
                  color: element.data?.labelColor || "var(--color-foreground)"
                },
                children: /* @__PURE__ */ jsx(ChevronLeft, { className: "h-5 w-5" })
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => handleScroll("next"),
                disabled: !canNext,
                className: "absolute right-[-18px] top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border shadow-[0_12px_30px_rgba(0,0,0,0.12)] transition disabled:cursor-not-allowed disabled:opacity-40 sm:right-[-28px]",
                style: {
                  background: element.data?.arrowBgColor || "var(--color-primary-button-text)",
                  borderColor: element.data?.borderColor || "var(--color-border)",
                  color: element.data?.labelColor || "var(--color-foreground)"
                },
                children: /* @__PURE__ */ jsx(ChevronRight, { className: "h-5 w-5" })
              }
            ),
            /* @__PURE__ */ jsx("div", { className: "overflow-hidden", children: /* @__PURE__ */ jsx(
              "div",
              {
                ref: scrollerRef,
                className: "flex ml-0 overflow-x-auto scroll-smooth pb-2",
                style: { scrollbarWidth: "none", gap: `${sliderGap}px` },
                children: visible.map((item, index) => {
                  const href = resolveHref(item);
                  const label = resolveLabel(item);
                  const imageSrc = resolveImage(item);
                  const key = buildKey(item, index);
                  return /* @__PURE__ */ jsx(
                    "div",
                    {
                      className: "shrink-0",
                      style: { flex: `0 0 ${100 / Math.max(1, perView)}%` },
                      children: /* @__PURE__ */ jsx(
                        "a",
                        {
                          href,
                          className: "group relative block h-full rounded p-4",
                          style: {
                            background: element.data?.sliderCardBg || "var(--color-variant-background-color)",
                            borderColor: element.data?.sliderBorderColor || "var(--color-variant-border-color)"
                          },
                          onClick: handleLinkClick,
                          children: /* @__PURE__ */ jsxs("div", { className: "relative mx-auto h-60 md:h-72 w-full overflow-hidden rounded", children: [
                            imageSrc ? /* @__PURE__ */ jsx(
                              "img",
                              {
                                src: imageSrc,
                                alt: label,
                                className: "h-full w-full object-cover transition duration-500 group-hover:scale-105"
                              }
                            ) : /* @__PURE__ */ jsx("div", { className: "flex h-full w-full items-center justify-center", children: /* @__PURE__ */ jsx(
                              "span",
                              {
                                className: "rounded-full px-6 py-2 text-base font-semibold shadow-[0_15px_35px_rgba(0,0,0,0.14)]",
                                style: {
                                  background: element.data?.chipBgColor || "var(--color-primary-button-text)",
                                  color: element.data?.chipTextColor || "var(--color-primary-button_background)"
                                },
                                children: label
                              }
                            ) }),
                            /* @__PURE__ */ jsx("div", { className: "absolute inset-0 flex items-center justify-center", children: /* @__PURE__ */ jsx(
                              "span",
                              {
                                className: "rounded-full px-6 py-2 text-base font-semibold shadow-[0_15px_35px_rgba(0,0,0,0.14)]",
                                style: {
                                  background: element.data?.chipBgColor || "var(--color-primary-button-text)",
                                  color: element.data?.chipTextColor || "var(--color-primary-button_background)"
                                },
                                children: label
                              }
                            ) })
                          ] })
                        }
                      )
                    },
                    key
                  );
                })
              }
            ) })
          ] })
        ] })
      }
    );
  }
  if (layout === "slider") {
    const getPerView = () => perView;
    const computeSnapFromIndex = (index) => {
      const perView2 = getPerView();
      return Math.floor(index / perView2);
    };
    const scrollToSnap = (index) => {
      const el = scrollerRef.current;
      if (!el) return;
      el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
    };
    return /* @__PURE__ */ jsxs(
      "div",
      {
        className: `px-6 ${element.className || ""}`,
        style: { ...element.style },
        onMouseEnter: () => setIsHovered(true),
        onMouseLeave: () => setIsHovered(false),
        children: [
          /* @__PURE__ */ jsx("div", { className: "flex w-full items-center justify-between", children: /* @__PURE__ */ jsx(
            "h2",
            {
              className: "text-2xl font-semibold sm:text-3xl",
              style: { color: headingColor },
              children: heading
            }
          ) }),
          /* @__PURE__ */ jsxs("div", { className: "mt-10 relative", children: [
            /* @__PURE__ */ jsx("div", { className: "overflow-hidden", children: /* @__PURE__ */ jsx(
              "div",
              {
                ref: scrollerRef,
                className: "flex overflow-x-auto scroll-smooth pb-4 min-h-[220px]",
                style: { scrollbarWidth: "none", gap: `${sliderGap}px` },
                children: list.map((item, index) => {
                  const href = resolveHref(item);
                  const label = resolveLabel(item);
                  const imageSrc = resolveImage(item);
                  const key = buildKey(item, index);
                  return /* @__PURE__ */ jsxs(
                    "a",
                    {
                      href,
                      className: "group flex h-full shrink-0 flex-col items-center rounded-lg border px-6 pb-7 pt-14 text-center transition-all duration-300",
                      style: {
                        borderColor: sliderBorderColor,
                        backgroundColor: sliderCardBg,
                        flex: `0 0 ${100 / Math.max(1, perView)}%`
                      },
                      onMouseEnter: () => setCurrentSnap(computeSnapFromIndex(index)),
                      onClick: handleLinkClick,
                      children: [
                        /* @__PURE__ */ jsx("div", { className: "relative h-24 w-24 sm:h-24 sm:w-24", children: imageSrc ? /* @__PURE__ */ jsx(
                          "img",
                          {
                            src: imageSrc,
                            alt: label,
                            className: "h-full w-full object-contain transition-transform duration-300",
                            style: {}
                          }
                        ) : /* @__PURE__ */ jsx(
                          "div",
                          {
                            className: "flex h-full w-full items-center justify-center text-xs font-semibold",
                            style: { color: placeholderColor },
                            children: label?.[0] || ""
                          }
                        ) }),
                        /* @__PURE__ */ jsx("div", { className: "relative mt-8", children: /* @__PURE__ */ jsx(
                          "p",
                          {
                            className: "text-lg font-medium",
                            style: { color: labelColor },
                            children: label
                          }
                        ) })
                      ]
                    },
                    key
                  );
                })
              }
            ) }),
            (element.data?.sliderShowArrows || element.data?.sliderShowDots) && /* @__PURE__ */ jsx("div", { className: "mt-8 flex justify-center", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 px-4 py-2", children: [
              element.data?.sliderShowArrows && /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => handleScroll("prev"),
                  className: "flex h-8 w-8 items-center justify-center rounded-full transition",
                  style: { color: labelColor },
                  "aria-label": "Previous",
                  children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", viewBox: "0 0 24 24", fill: "none", children: /* @__PURE__ */ jsx(
                    "path",
                    {
                      d: "M15 6L9 12L15 18",
                      stroke: "currentColor",
                      strokeWidth: "1.5",
                      strokeLinecap: "round",
                      strokeLinejoin: "round"
                    }
                  ) })
                }
              ),
              element.data?.sliderShowDots && /* @__PURE__ */ jsx("div", { className: "flex items-center gap-2", children: Array.from({ length: snapCount }).map((_, i) => /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => scrollToSnap(i),
                  "aria-label": `Go to slide ${i + 1}`,
                  className: "rounded-full transition-all duration-300",
                  style: {
                    width: i === currentSnap ? 24 : 8,
                    height: 8,
                    backgroundColor: i === currentSnap ? sliderActiveDotColor : sliderInactiveDotColor
                  }
                },
                i
              )) }),
              element.data?.sliderShowArrows && /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => handleScroll("next"),
                  className: "flex h-8 w-8 items-center justify-center rounded-full transition",
                  style: { color: labelColor },
                  "aria-label": "Next",
                  children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", viewBox: "0 0 24 24", fill: "none", children: /* @__PURE__ */ jsx(
                    "path",
                    {
                      d: "M9 6L15 12L9 18",
                      stroke: "currentColor",
                      strokeWidth: "1.5",
                      strokeLinecap: "round",
                      strokeLinejoin: "round"
                    }
                  ) })
                }
              )
            ] }) })
          ] })
        ]
      }
    );
  }
  if (layout === "featured") {
    return /* @__PURE__ */ jsxs(
      "div",
      {
        className: `space-y-10 ${element.className || ""}`,
        style: { ...element.style },
        onMouseEnter: () => setIsHovered(true),
        onMouseLeave: () => setIsHovered(false),
        children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx(
              "h2",
              {
                className: "text-3xl font-semibold sm:text-[40px]",
                style: { color: headingColor },
                children: heading
              }
            ) }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  onClick: () => handleScroll("prev"),
                  "aria-label": "View previous categories",
                  disabled: !canPrev,
                  className: `relative flex h-6 w-6 items-center justify-center rounded-full border transition-colors duration-200 ${canPrev ? "hover:bg-opacity-5" : "border-none opacity-50"}`,
                  style: {
                    borderColor: canPrev ? activeColor : "transparent"
                  },
                  children: [
                    /* @__PURE__ */ jsx(
                      "span",
                      {
                        className: "h-2 w-2 rounded-full",
                        style: {
                          backgroundColor: canPrev ? activeColor : inactiveColor
                        }
                      }
                    ),
                    canPrev && /* @__PURE__ */ jsx(
                      "span",
                      {
                        className: "absolute inset-0 rounded-full border opacity-60",
                        style: { borderColor: activeColor }
                      }
                    )
                  ]
                }
              ),
              /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  onClick: () => handleScroll("next"),
                  "aria-label": "View next categories",
                  disabled: !canNext,
                  className: `relative flex h-6 w-6 items-center justify-center rounded-full border transition-colors duration-200 ${canNext ? "hover:bg-opacity-5" : "border-none opacity-50"}`,
                  style: {
                    borderColor: canNext ? activeColor : "transparent"
                  },
                  children: [
                    /* @__PURE__ */ jsx(
                      "span",
                      {
                        className: "h-2 w-2 rounded-full",
                        style: {
                          backgroundColor: canNext ? activeColor : inactiveColor
                        }
                      }
                    ),
                    canNext && /* @__PURE__ */ jsx(
                      "span",
                      {
                        className: "absolute inset-0 rounded-full border opacity-60",
                        style: { borderColor: activeColor }
                      }
                    )
                  ]
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "w-full overflow-hidden", children: /* @__PURE__ */ jsx(
            "div",
            {
              ref: scrollerRef,
              className: "flex overflow-x-auto scroll-smooth items-stretch pb-4",
              style: {
                gap: "20px",
                // gap-5 equivalent
                scrollbarWidth: "none"
              },
              children: list.map((category, index) => {
                const key = buildKey(category, index);
                const href = resolveHref(category);
                const label = resolveLabel(category);
                const imageSrc = resolveImage(category);
                return /* @__PURE__ */ jsx(
                  "div",
                  {
                    className: "shrink-0 basis-1/2 sm:basis-1/3 lg:basis-1/6",
                    children: /* @__PURE__ */ jsxs(
                      "a",
                      {
                        href,
                        className: "group flex h-full flex-col rounded-xl p-6 text-center transition",
                        style: {
                          backgroundColor: cardBackground,
                          "--hover-bg": cardHoverBackground
                        },
                        onMouseEnter: (e) => {
                          e.currentTarget.style.backgroundColor = cardHoverBackground;
                        },
                        onMouseLeave: (e) => {
                          e.currentTarget.style.backgroundColor = cardBackground;
                        },
                        onClick: handleLinkClick,
                        children: [
                          /* @__PURE__ */ jsx("div", { className: "mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full bg-white shadow-inner sm:h-28 sm:w-28", children: imageSrc ? /* @__PURE__ */ jsx(
                            "img",
                            {
                              src: imageSrc,
                              alt: label,
                              width: 120,
                              height: 120,
                              className: "h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            }
                          ) : /* @__PURE__ */ jsx(
                            "div",
                            {
                              className: "flex h-full w-full items-center justify-center text-xs font-semibold",
                              style: { color: headingColor },
                              children: label?.[0] || ""
                            }
                          ) }),
                          /* @__PURE__ */ jsx(
                            "h3",
                            {
                              className: "text-base font-semibold line-clamp-2 min-h-[42px]",
                              style: { color: headingColor },
                              children: label
                            }
                          )
                        ]
                      }
                    )
                  },
                  key
                );
              })
            }
          ) })
        ]
      }
    );
  }
  if (layout === "split") {
    return /* @__PURE__ */ jsx(
      "div",
      {
        className: `px-4 py-6 sm:px-6 lg:px-8 md:pt-16 ${element.className || ""}`,
        style: { ...element.style },
        onMouseEnter: () => setIsHovered(true),
        onMouseLeave: () => setIsHovered(false),
        children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 md:flex-row", children: [
          /* @__PURE__ */ jsxs("div", { className: "md:max-w-sm overflow-hidden p-1", children: [
            /* @__PURE__ */ jsx(
              "h2",
              {
                className: "text-2xl font-semibold md:text-[40px]",
                style: { color: headingColor },
                children: heading
              }
            ),
            /* @__PURE__ */ jsx(
              "p",
              {
                className: "mt-3 text-sm md:text-base whitespace-normal break-words",
                style: { color: descriptionColor },
                children: description
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "relative w-full overflow-hidden md:flex-1 mt-4 md:mt-0", children: [
            /* @__PURE__ */ jsx(
              "div",
              {
                ref: scrollerRef,
                className: "flex gap-x-4 overflow-x-auto scroll-smooth pb-4 min-h-[140px]",
                style: {
                  scrollbarWidth: "none"
                },
                children: list.map((item, index) => {
                  const href = resolveHref(item);
                  const label = resolveLabel(item);
                  const imageSrc = resolveImage(item);
                  const key = buildKey(item, index);
                  return /* @__PURE__ */ jsxs(
                    "a",
                    {
                      href,
                      className: "flex w-32 shrink-0 flex-col items-center text-center transition hover:opacity-90 md:w-40",
                      onClick: handleLinkClick,
                      children: [
                        /* @__PURE__ */ jsx("div", { className: "relative flex h-24 w-full items-center justify-center md:h-32", children: imageSrc ? /* @__PURE__ */ jsx(
                          "img",
                          {
                            src: imageSrc,
                            alt: label,
                            width: 160,
                            height: 160,
                            className: "h-20 w-full max-w-[100px] object-cover md:h-24 md:max-w-[120px]"
                          }
                        ) : /* @__PURE__ */ jsx(
                          "span",
                          {
                            className: "text-sm font-semibold",
                            style: { color: placeholderColor },
                            children: label
                          }
                        ) }),
                        /* @__PURE__ */ jsx(
                          "span",
                          {
                            className: "text-sm font-medium hover:underline",
                            style: { color: labelColor },
                            children: label
                          }
                        )
                      ]
                    },
                    key
                  );
                })
              }
            ),
            showArrows && /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx("div", { className: "pointer-events-none absolute inset-y-0 left-0 flex items-center justify-start md:left-6", children: /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => handleScroll("prev"),
                  disabled: !canPrev,
                  className: "pointer-events-auto hidden h-10 w-10 -translate-x-2 items-center justify-center rounded-full border bg-white shadow-sm transition hover:bg-gray-50 disabled:opacity-40 md:-translate-x-6 md:flex md:h-12 md:w-12",
                  style: {
                    borderColor,
                    color: labelColor
                  },
                  "aria-label": "Scroll categories backward",
                  children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", viewBox: "0 0 24 24", fill: "none", children: /* @__PURE__ */ jsx(
                    "path",
                    {
                      d: "M15 6L9 12L15 18",
                      stroke: "currentColor",
                      strokeWidth: "1.5",
                      strokeLinecap: "round",
                      strokeLinejoin: "round"
                    }
                  ) })
                }
              ) }),
              /* @__PURE__ */ jsx("div", { className: "pointer-events-none absolute inset-y-0 right-0 flex items-center justify-end md:right-8", children: /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => handleScroll("next"),
                  disabled: !canNext,
                  className: "pointer-events-auto hidden h-10 w-10 translate-x-2 items-center justify-center rounded-full border bg-white shadow-sm transition hover:bg-gray-50 disabled:opacity-40 md:flex md:translate-x-6 md:h-12 md:w-12",
                  style: {
                    borderColor,
                    color: labelColor
                  },
                  "aria-label": "Scroll categories forward",
                  children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", viewBox: "0 0 24 24", fill: "none", children: /* @__PURE__ */ jsx(
                    "path",
                    {
                      d: "M9 6L15 12L9 18",
                      stroke: "currentColor",
                      strokeWidth: "1.5",
                      strokeLinecap: "round",
                      strokeLinejoin: "round"
                    }
                  ) })
                }
              ) })
            ] })
          ] })
        ] })
      }
    );
  }
  if (layout === "mf_card") {
    const getPerView = () => perView;
    const computeSnapFromIndex = (index) => {
      const perView2 = getPerView();
      return Math.floor(index / perView2);
    };
    const scrollToSnap = (index) => {
      const el = scrollerRef.current;
      if (!el) return;
      el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
    };
    return /* @__PURE__ */ jsx(
      "section",
      {
        className: `py-10 md:py-16 ${element.className || ""}`,
        style: {
          ...element.style,
          background: element.data?.sectionBg || "var(--color-variant-background-color)"
        },
        onMouseEnter: () => setIsHovered(true),
        onMouseLeave: () => setIsHovered(false),
        children: /* @__PURE__ */ jsxs("div", { className: "mx-auto container px-4", children: [
          /* @__PURE__ */ jsx("div", { className: "flex flex-col items-center text-center", children: /* @__PURE__ */ jsx(
            "h2",
            {
              className: "mt-2 text-2xl font-semibold md:text-4xl",
              style: {
                color: element.data?.headingColor || "var(--color-foreground-heading)"
              },
              children: heading
            }
          ) }),
          /* @__PURE__ */ jsxs("div", { className: "mt-8 relative", children: [
            /* @__PURE__ */ jsx("div", { className: "overflow-hidden", children: /* @__PURE__ */ jsx(
              "div",
              {
                ref: scrollerRef,
                className: "flex overflow-x-auto scroll-smooth pb-2",
                style: { scrollbarWidth: "none", gap: `${sliderGap}px` },
                children: list.map((item, index) => {
                  const href = resolveHref(item);
                  const label = resolveLabel(item);
                  const imageSrc = resolveImage(item);
                  const key = buildKey(item, index);
                  return /* @__PURE__ */ jsxs(
                    "a",
                    {
                      href,
                      className: "flex aspect-square flex-col items-center justify-center group rounded-xl border shadow-sm md:px-6 md:py-8 p-2 md:gap-4 transition hover:shadow-md w-full h-full shrink-0",
                      style: {
                        background: element.data?.sliderCardBg || "var(--color-variant-background-color)",
                        borderColor: element.data?.sliderBorderColor || "var(--color-variant-border-color)",
                        flex: `0 0 ${100 / Math.max(1, perView)}%`
                      },
                      onMouseEnter: () => setCurrentSnap(computeSnapFromIndex(index)),
                      onClick: handleLinkClick,
                      children: [
                        /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center mb-2 md:mb-2", children: imageSrc ? /* @__PURE__ */ jsx(
                          "img",
                          {
                            src: imageSrc,
                            alt: label,
                            width: 60,
                            height: 60,
                            className: "w-12 h-12 md:w-16 md:h-16 object-contain"
                          }
                        ) : /* @__PURE__ */ jsx("div", { className: "w-12 h-12 md:w-16 md:h-16 flex items-center justify-center rounded-md", children: /* @__PURE__ */ jsx(
                          "span",
                          {
                            className: "text-sm md:text-base font-semibold",
                            style: {
                              color: element.data?.labelColor || "var(--color-foreground)"
                            },
                            children: label?.[0] || ""
                          }
                        ) }) }),
                        /* @__PURE__ */ jsx(
                          "p",
                          {
                            className: "text-center font-semibold",
                            style: {
                              color: element.data?.labelColor || "var(--color-foreground-heading)",
                              fontSize: "1rem"
                            },
                            children: label
                          }
                        )
                      ]
                    },
                    key
                  );
                })
              }
            ) }),
            (element.data?.mfShowArrows || element.data?.mfShowDots) && /* @__PURE__ */ jsx("div", { className: "mt-6 flex justify-center", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 px-4 py-2", children: [
              element.data?.mfShowArrows && /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => handleScroll("prev"),
                  className: "flex h-8 w-8 items-center justify-center rounded-full transition",
                  style: { color: labelColor },
                  "aria-label": "Previous",
                  children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", viewBox: "0 0 24 24", fill: "none", children: /* @__PURE__ */ jsx(
                    "path",
                    {
                      d: "M15 6L9 12L15 18",
                      stroke: "currentColor",
                      strokeWidth: "1.5",
                      strokeLinecap: "round",
                      strokeLinejoin: "round"
                    }
                  ) })
                }
              ),
              element.data?.mfShowDots && /* @__PURE__ */ jsx("div", { className: "flex items-center gap-2", children: Array.from({ length: snapCount }).map((_, i) => /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => scrollToSnap(i),
                  "aria-label": `Go to slide ${i + 1}`,
                  className: "rounded-full transition-all duration-300",
                  style: {
                    width: i === currentSnap ? 24 : 8,
                    height: 8,
                    backgroundColor: i === currentSnap ? sliderActiveDotColor : sliderInactiveDotColor
                  }
                },
                i
              )) }),
              element.data?.mfShowArrows && /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => handleScroll("next"),
                  className: "flex h-8 w-8 items-center justify-center rounded-full transition",
                  style: { color: labelColor },
                  "aria-label": "Next",
                  children: /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", viewBox: "0 0 24 24", fill: "none", children: /* @__PURE__ */ jsx(
                    "path",
                    {
                      d: "M9 6L15 12L9 18",
                      stroke: "currentColor",
                      strokeWidth: "1.5",
                      strokeLinecap: "round",
                      strokeLinejoin: "round"
                    }
                  ) })
                }
              )
            ] }) })
          ] })
        ] })
      }
    );
  }
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: `relative group ${element.className || ""}`,
      style: { ...element.style },
      onMouseEnter: () => setIsHovered(true),
      onMouseLeave: () => setIsHovered(false),
      children: [
        /* @__PURE__ */ jsx("div", { className: "overflow-hidden", children: /* @__PURE__ */ jsx(
          "div",
          {
            ref: scrollerRef,
            className: "flex overflow-x-auto scroll-smooth pb-4",
            style: {
              gap: `${gap}px`,
              scrollbarWidth: "none"
            },
            children: list.map((item, index) => {
              const href = resolveHref(item);
              const label = resolveLabel(item);
              const imageSrc = resolveImage(item);
              const key = buildKey(item, index);
              return /* @__PURE__ */ jsxs(
                "a",
                {
                  href,
                  className: "flex shrink-0 flex-col items-center text-center transition md:w-40",
                  style: { width: `${itemWidth}px` },
                  onClick: handleLinkClick,
                  children: [
                    /* @__PURE__ */ jsx(
                      "div",
                      {
                        className: "relative flex w-full items-center justify-center",
                        style: { height: `${itemHeight}px` },
                        children: imageSrc ? /* @__PURE__ */ jsx(
                          "img",
                          {
                            src: imageSrc,
                            alt: label,
                            style: {
                              width: "100%",
                              maxWidth: `${itemWidth - 40}px`,
                              height: `${Math.max(64, itemHeight - 40)}px`,
                              objectFit: "cover",
                              borderRadius: "4px"
                            }
                          }
                        ) : /* @__PURE__ */ jsx(
                          "span",
                          {
                            className: "text-sm font-semibold",
                            style: { color: placeholderColor },
                            children: label
                          }
                        )
                      }
                    ),
                    showLabels && /* @__PURE__ */ jsx(
                      "span",
                      {
                        className: "text-sm font-medium hover:underline",
                        style: { color: labelColor },
                        dangerouslySetInnerHTML: { __html: label }
                      }
                    )
                  ]
                },
                key
              );
            })
          }
        ) }),
        showArrows && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("div", { className: "pointer-events-none absolute inset-y-0 left-6 flex items-center justify-start", children: /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => handleScroll("prev"),
              disabled: !canPrev,
              className: "pointer-events-auto hidden h-12 w-12 -translate-x-6 items-center justify-center rounded-full border bg-white text-black shadow-sm transition disabled:opacity-40 md:flex",
              style: { borderColor, color: labelColor },
              "aria-label": "Scroll categories backward",
              children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", viewBox: "0 0 24 24", fill: "none", children: /* @__PURE__ */ jsx(
                "path",
                {
                  d: "M15 6L9 12L15 18",
                  stroke: "currentColor",
                  strokeWidth: "1.5",
                  strokeLinecap: "round",
                  strokeLinejoin: "round"
                }
              ) })
            }
          ) }),
          /* @__PURE__ */ jsx("div", { className: "pointer-events-none absolute inset-y-0 right-8 flex items-center justify-end", children: /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => handleScroll("next"),
              disabled: !canNext,
              className: "pointer-events-auto hidden h-12 w-12 translate-x-6 items-center justify-center rounded-full border bg-white text-black shadow-sm transition disabled:opacity-40 md:flex",
              style: { borderColor, color: labelColor },
              "aria-label": "Scroll categories forward",
              children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", viewBox: "0 0 24 24", fill: "none", children: /* @__PURE__ */ jsx(
                "path",
                {
                  d: "M9 6L15 12L9 18",
                  stroke: "currentColor",
                  strokeWidth: "1.5",
                  strokeLinecap: "round",
                  strokeLinejoin: "round"
                }
              ) })
            }
          ) })
        ] })
      ]
    }
  );
};

function categoryRender({ data, style, className }) {
  const fakeElement = {
    id: "__render__",
    type: "custom",
    name: "category",
    style: style ?? {},
    className: className ?? "",
    data: data ?? {}
  };
  return React2.createElement(CustomCategoryComponent, {
    element: fakeElement,
    isPreview: true
  });
}
export {
  categoryRender as default
};
