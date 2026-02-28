"use client";
import React, { useEffect, useRef, useState } from "react";
import { Images } from "lucide-react";
import { CustomComponentDef, FunnelElement } from "../../types";
import { EditableText } from "../EditableText";
import { getGradientTextStyle } from "../styleUtils";
import { imageGetUrl } from "@/utils/utils";

export const HeroSliderComponent: React.FC<{
  element: FunnelElement;
  onUpdate?: (id: string, updates: Partial<FunnelElement>) => void;
  isPreview?: boolean;
  deviceView?: "desktop" | "tablet" | "mobile";
}> = ({ element, onUpdate, isPreview, deviceView = "desktop" }) => {
  const {
    slides = [],
    enableAutoplay = true,
    autoplayInterval = 3000,
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
    chevronOffsetY = 0,
  } = element.data || {};

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [current, setCurrent] = useState(0);

  const slideHeight = deviceView === "mobile" ? heightMobile : heightDesktop;
  const {
    enableRightAd = false,
    rightAdTitle = "দৈনিক তাজা পণ্য",
    rightAdContent = "আজকের সেরা অফার",
    rightAdUrl = "/shop",
    rightAdImage = "https://placehold.co/500x600",
  } = element.data || {};
  const showRightAd =
    deviceView !== "mobile" &&
    !!enableRightAd &&
    !!(rightAdImage || rightAdTitle || rightAdContent);
  const sliderWidthClass = showRightAd ? "md:w-4/6 w-full" : "w-full";

  const getSlides = () =>
    Array.from(scrollerRef.current?.children || []) as HTMLElement[];

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    }, Math.max(500, Number(autoplayInterval) || 3000));
    return () => clearInterval(id);
  }, [enableAutoplay, autoplayInterval, current, slides.length]);

  const scrollTo = (index: number) => {
    const el = scrollerRef.current;
    const slidesEls = getSlides();
    if (!el || !slidesEls.length) return;
    const i = Math.max(0, Math.min(index, slidesEls.length - 1));
    el.scrollTo({ left: slidesEls[i].offsetLeft, behavior: "smooth" });
  };

  const updateSlide = (idx: number, field: string, value: any) => {
    if (!onUpdate) return;
    const list = element.data?.slides || [];
    const next = [...list];
    next[idx] = { ...next[idx], [field]: value };
    onUpdate(element.id, { data: { ...element.data, slides: next } });
  };

  if (!slides || slides.length === 0) {
    return (
      <div
        className="w-full rounded border border-gray-200 bg-gray-50 text-gray-500 flex items-center justify-center"
        style={{ ...element.style, height: `${slideHeight}px` }}
      >
        No slides added
      </div>
    );
  }

  return (
    <section className={`relative ${element.className || ""}`} style={element.style}>
      <div className="w-full md:flex md:gap-4">
        <div className={`${sliderWidthClass} overflow-hidden relative`}>
          <div
            ref={scrollerRef}
            className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
            style={{
              WebkitOverflowScrolling: "touch",
              scrollBehavior: "smooth",
            }}
          >
            {slides.map((data: any, index: number) => {
              const alignCenter = !!data.center;
              const dark = !!data.is_dark;
              const showBtn = !!data.has_button;
              return (
                <div
                  key={data.id || index}
                  className="flex-shrink-0 snap-start relative w-full"
                  style={{ minWidth: "100%" }}
                >
                  <div className="relative w-full">
                    <img
                      src={imageGetUrl(data.image)}
                      alt={data.title || `Slide ${index + 1}`}
                      className="w-full object-cover"
                      style={{
                        height: `${slideHeight}px`,
                        borderRadius: `${borderRadius}px`,
                        backgroundColor: "#f3f4f6",
                      }}
                    />
                    {layout === "classic" && (
                      <div
                        className={`absolute inset-0 p-6 md:p-10 ${
                          alignCenter
                            ? "flex items-center justify-center"
                            : "flex items-center"
                        }`}
                      >
                        <div className="max-w-2xl">
                          <EditableText
                            tagName="h2"
                            className={`text-2xl md:text-4xl font-bold`}
                            style={
                              dark
                                ? { color: "#ffffff" }
                                : getGradientTextStyle(titleColor)
                            }
                            html={data.title || ""}
                            editable={!isPreview}
                            onBlur={(e: any) =>
                              updateSlide(
                                index,
                                "title",
                                e.currentTarget.innerHTML
                              )
                            }
                          />
                          <EditableText
                            tagName="p"
                            className={`mt-2 text-sm md:text-base`}
                            style={
                              dark
                                ? { color: "rgba(255,255,255,0.8)" }
                                : getGradientTextStyle(subTitleColor)
                            }
                            html={data.sub_title || ""}
                            editable={!isPreview}
                            onBlur={(e: any) =>
                              updateSlide(
                                index,
                                "sub_title",
                                e.currentTarget.innerHTML
                              )
                            }
                          />
                          {showBtn && (
                            <a
                              href={data.button_link || "#"}
                              className="inline-flex mt-4 px-5 py-2 rounded-md font-semibold"
                              style={{
                                background: buttonBg,
                                color: buttonTextColor,
                              }}
                            >
                              {data.button_text || "Shop Now"}
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                    {layout === "organic" && (
                      <div className="absolute inset-0 md:py-16 md:px-14 py-10 px-6 flex flex-col h-full">
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <EditableText
                              tagName="h2"
                              className="font-bold md:text-6xl sm:text-4xl text-xl"
                              style={
                                dark
                                  ? { color: "#ffffff" }
                                  : { color: "#111827" }
                              }
                              html={data.title || ""}
                              editable={!isPreview}
                              onBlur={(e: any) =>
                                updateSlide(
                                  index,
                                  "title",
                                  e.currentTarget.innerHTML
                                )
                              }
                            />
                            <EditableText
                              tagName="p"
                              className="md:mt-6 mt-4 md:text-xl text-base"
                              style={
                                dark
                                  ? { color: "rgba(255,255,255,0.8)" }
                                  : { color: "#4b5563" }
                              }
                              html={data.sub_title || ""}
                              editable={!isPreview}
                              onBlur={(e: any) =>
                                updateSlide(
                                  index,
                                  "sub_title",
                                  e.currentTarget.innerHTML
                                )
                              }
                            />
                          </div>
                          {showBtn && (
                            <a
                              href={data.button_link || "#"}
                              className="w-fit md:px-6 md:py-3 px-3 py-2 rounded-md font-semibold md:text-base text-xs"
                              style={{
                                background: dark ? "#ffffff" : buttonBg,
                                color: dark
                                  ? "var(--color-primary)"
                                  : buttonTextColor,
                              }}
                            >
                              {data.button_text || "Shop Now"}
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                    {layout === "minimal" && (
                      <div className="absolute inset-0 p-6 md:p-8 flex items-end">
                        <div className="bg-white/80 backdrop-blur rounded-lg p-4 md:p-6">
                          <EditableText
                            tagName="h2"
                            className="text-xl md:text-3xl font-semibold"
                            style={getGradientTextStyle(titleColor)}
                            html={data.title || ""}
                            editable={!isPreview}
                            onBlur={(e: any) =>
                              updateSlide(
                                index,
                                "title",
                                e.currentTarget.innerHTML
                              )
                            }
                          />
                          <EditableText
                            tagName="p"
                            className="mt-2 text-sm md:text-base opacity-80"
                            style={getGradientTextStyle(subTitleColor)}
                            html={data.sub_title || ""}
                            editable={!isPreview}
                            onBlur={(e: any) =>
                              updateSlide(
                                index,
                                "sub_title",
                                e.currentTarget.innerHTML
                              )
                            }
                          />
                          {showBtn && (
                            <a
                              href={data.button_link || "#"}
                              className="inline-flex mt-3 px-4 py-2 rounded-md font-medium"
                              style={{
                                background: buttonBg,
                                color: buttonTextColor,
                              }}
                            >
                              {data.button_text || "Shop Now"}
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {showArrows && (
            <div
              className="absolute right-6 hidden md:flex flex-col gap-3 z-10"
              style={{
                top: `calc(50% + ${chevronOffsetY}px)`,
                transform: "translateY(-50%)",
              }}
            >
              <button
                type="button"
                className="relative hover:opacity-80 bg-white/90 rounded-md p-2 shadow"
                onClick={() => scrollTo(current - 1)}
                aria-label="Previous"
              >
                <svg
                  viewBox="0 0 24 24"
                  width={chevronSize}
                  height={chevronSize}
                  fill="none"
                  stroke="currentColor"
                >
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
              <button
                type="button"
                className="relative hover:opacity-80 bg-white/90 rounded-md p-2 shadow"
                onClick={() => scrollTo(current + 1)}
                aria-label="Next"
              >
                <svg
                  viewBox="0 0 24 24"
                  width={chevronSize}
                  height={chevronSize}
                  fill="none"
                  stroke="currentColor"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          )}

          {showIndicators && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {slides.map((_: any, i: number) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => scrollTo(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === current ? "w-8" : "w-1.5"
                  }`}
                  style={{
                    background:
                      i === current
                        ? "var(--color-primary)"
                        : "color-mix(in srgb, var(--color-primary) 30%, transparent)",
                  }}
                />
              ))}
            </div>
          )}
        </div>
        {showRightAd && (
          <div className="w-2/6 md:rounded-2xl hidden md:block relative">
            <div className="absolute top-0 left-0 w-full h-full md:py-16 md:px-14 flex flex-col justify-between">
              <div>
                <EditableText
                  tagName="h2"
                  className="text-4xl font-bold text-gray-800 mb-4 font-quicksand"
                  html={rightAdTitle || ""}
                  editable={!isPreview}
                  onBlur={(e: any) =>
                    onUpdate &&
                    onUpdate(element.id, {
                      data: {
                        ...element.data,
                        rightAdTitle: e.currentTarget.innerHTML,
                      },
                    })
                  }
                />
                <EditableText
                  tagName="p"
                  className="text-gray-600"
                  html={rightAdContent || ""}
                  editable={!isPreview}
                  onBlur={(e: any) =>
                    onUpdate &&
                    onUpdate(element.id, {
                      data: {
                        ...element.data,
                        rightAdContent: e.currentTarget.innerHTML,
                      },
                    })
                  }
                />
              </div>
              {rightAdUrl && (
                <a
                  href={rightAdUrl || "/"}
                  className="bg-primary text-white w-fit px-6 py-3 rounded-md block font-semibold mt-20"
                >
                  Shop Now
                </a>
              )}
            </div>
            <img
              src={imageGetUrl(rightAdImage)}
              alt={rightAdTitle || "Right Ad"}
              className="w-full object-cover rounded-2xl"
              style={{ height: `${slideHeight}px` }}
            />
          </div>
        )}
      </div>
    </section>
  );
};

export const CustomSliderDef: CustomComponentDef = {
  name: "Hero Slider",
  icon: <Images className="w-4 h-4" />,
  category: "Dynamic",
  component: HeroSliderComponent,
  defaultData: {
    layout: "classic",
    enableRightAd: false,
    rightAdTitle: "Shop Fresh Daily",
    rightAdContent: "Best deals from our store",
    rightAdUrl: "/shop",
    rightAdImage: "https://placehold.co/500x600",
    slides: [
      {
        id: "slide-1",
        image: "https://placehold.co/1200x540",
        title: "Authentic Date Molasses — Coconut & Almond Flavor",
        center: false,
        is_dark: false,
        sub_title: "15% OFF",
        has_button: true,
        button_link: "/shop",
        button_text: "Shop Now",
      },
      {
        id: "slide-2",
        image: "https://placehold.co/1200x540",
        title: "Traditional Date Molasses — Classic Gole Patali",
        center: false,
        is_dark: false,
        sub_title: "18% OFF",
        has_button: true,
        button_link: "/shop",
        button_text: "Shop Now",
      },
      {
        id: "slide-3",
        image: "https://placehold.co/1200x540",
        title: "Original Liquid Date Molasses",
        center: false,
        is_dark: false,
        sub_title: "Liquid Molasses",
        has_button: true,
        button_link: "/shop",
        button_text: "Shop Now",
      },
    ],
    enableAutoplay: true,
    autoplayInterval: 3000,
    showIndicators: true,
    showArrows: true,
    heightDesktop: 540,
    heightMobile: 420,
    borderRadius: 12,
    titleColor: "var(--color-foreground-heading)",
    subTitleColor: "var(--color-foreground)",
    buttonBg: "var(--color-primary)",
    buttonTextColor: "#ffffff",
    chevronSize: 20,
    chevronOffsetY: 0,
  },
  settings: {
    layout: {
      type: "select",
      label: "Layout Variant",
      options: [
        { label: "Classic", value: "classic" },
        { label: "Organic Grocery", value: "organic" },
        { label: "Minimal Overlay", value: "minimal" },
      ],
      default: "classic",
    },
    enableRightAd: {
      type: "boolean",
      label: "Show Right Ad",
      default: false,
    },
    rightAdTitle: {
      type: "text",
      label: "Right Ad Title",
      default: "দৈনিক তাজা পণ্য",
      conditionalDisplay: { field: "enableRightAd", value: true },
    },
    rightAdContent: {
      type: "text",
      label: "Right Ad Content",
      default: "আজকের সেরা অফার",
      conditionalDisplay: { field: "enableRightAd", value: true },
    },
    rightAdUrl: {
      type: "text",
      label: "Right Ad Link",
      default: "/shop",
      conditionalDisplay: { field: "enableRightAd", value: true },
    },
    rightAdImage: {
      type: "text",
      label: "Right Ad Image URL",
      default: "https://placehold.co/500x600",
      conditionalDisplay: { field: "enableRightAd", value: true },
    },
    slides: {
      type: "array_object",
      label: "Slides",
      itemSchema: {
        image: {
          type: "text",
          label: "Image URL",
          default: "https://placehold.co/1200x540",
        },
        title: { type: "text", label: "Title", default: "Headline..." },
        sub_title: { type: "text", label: "Sub Title", default: "Subtitle..." },
        center: { type: "boolean", label: "Center Content", default: false },
        is_dark: {
          type: "boolean",
          label: "Dark Overlay Text",
          default: false,
        },
        has_button: { type: "boolean", label: "Show Button", default: true },
        button_text: {
          type: "text",
          label: "Button Text",
          default: "Shop Now",
        },
        button_link: { type: "text", label: "Button Link", default: "/" },
      },
      defaultItem: {
        image: "https://placehold.co/1200x540",
        title: "Headline...",
        sub_title: "Subtitle...",
        center: false,
        is_dark: false,
        has_button: true,
        button_text: "Shop Now",
        button_link: "/",
      },
    },
    enableAutoplay: {
      type: "boolean",
      label: "Enable Autoplay",
      default: true,
    },
    autoplayInterval: {
      type: "number_slider",
      label: "Autoplay Interval (ms)",
      min: 500,
      max: 10000,
      step: 100,
      default: 3000,
    },
    showIndicators: {
      type: "boolean",
      label: "Show Indicators",
      default: true,
    },
    showArrows: {
      type: "boolean",
      label: "Show Arrows",
      default: true,
    },
    chevronSize: {
      type: "number_slider",
      label: "Chevron Size (px)",
      min: 12,
      max: 48,
      step: 1,
      default: 20,
    },
    chevronOffsetY: {
      type: "number_slider",
      label: "Chevron Vertical Offset (px)",
      min: -200,
      max: 200,
      step: 1,
      default: 0,
    },
    heightDesktop: {
      type: "number_slider",
      label: "Height (Desktop px)",
      min: 240,
      max: 800,
      step: 10,
      default: 540,
    },
    heightMobile: {
      type: "number_slider",
      label: "Height (Mobile px)",
      min: 200,
      max: 700,
      step: 10,
      default: 420,
    },
    borderRadius: {
      type: "number_slider",
      label: "Image Border Radius",
      min: 0,
      max: 40,
      step: 1,
      default: 12,
    },
    titleColor: {
      type: "color",
      label: "Title Color",
      default: "var(--color-foreground-heading)",
    },
    subTitleColor: {
      type: "color",
      label: "Sub Title Color",
      default: "var(--color-foreground)",
    },
    buttonBg: {
      type: "color",
      label: "Button Background",
      default: "var(--color-primary)",
    },
    buttonTextColor: {
      type: "color",
      label: "Button Text Color",
      default: "#ffffff",
    },
  },
  variants: [
    {
      name: "Classic",
      icon: <Images className="w-4 h-4" />,
      defaultData: { layout: "classic" },
    },
    {
      name: "Organic Grocery",
      icon: <Images className="w-4 h-4" />,
      defaultData: { layout: "organic" },
    },
    {
      name: "Minimal Overlay",
      icon: <Images className="w-4 h-4" />,
      defaultData: { layout: "minimal" },
    },
  ],
};
