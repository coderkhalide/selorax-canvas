import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Grid, ChevronLeft, ChevronRight } from "lucide-react";
import { CustomComponentDef } from "../../types";

const buildKey = (item: any, index: number) =>
  item?.slug ||
  item?.category_slug ||
  item?.id ||
  item?.category_id ||
  `${item?.name || "category"}-${index}`;

const resolveHref = (item: any) => {
  if (item?.slug) return `/category/${item.slug}`;
  if (item?.category_slug) return `/category/${item.category_slug}`;
  return "/products";
};

const resolveLabel = (item: any) => item?.name || item?.title || "Collection";

const resolveImage = (item: any) =>
  item?.image ||
  item?.thumbnail ||
  item?.cover_image ||
  item?.cover_photo ||
  (typeof item?.images === "string" ? item.images.split(",")[0] : null) ||
  item?.media ||
  item?.icon ||
  item?.icon_url ||
  item?.icon_white ||
  item?.icon_black ||
  null;

export const CustomCategoryComponent: React.FC<any> = ({
  element,
  onUpdate,
  isPreview,
  deviceView,
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
    autoplaySpeed = 3000,
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
    desktopItems = 4,
  } = element.data || {};

  const list = useMemo(() => (categories || []).filter(Boolean), [categories]);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
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
    // Add resize listener to update buttons when container resizes
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

  // Slider/Shop by Category: compute snap count based on viewport
  useEffect(() => {
    if (
      layout !== "slider" &&
      layout !== "shop_by_category" &&
      layout !== "mf_card"
    )
      return;
    const compute = () => {
      const w = typeof window !== "undefined" ? window.innerWidth : 1024;
      let pv = 1;
      if (layout === "shop_by_category" || layout === "mf_card") {
        const isMobile =
          deviceView === "mobile"
            ? true
            : deviceView === "desktop"
              ? false
              : w < 768;
        pv = isMobile ? Math.max(1, mobileItems) : Math.max(1, desktopItems);
      } else {
        pv =
          w < 640
            ? Math.max(1, sliderPerSm)
            : w < 768
              ? Math.max(1, sliderPerMd)
              : w < 1024
                ? Math.max(1, sliderPerLg)
                : w < 1280
                  ? Math.max(1, sliderPerXl)
                  : Math.max(1, sliderPer2xl);
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
    deviceView,
  ]);

  // Slider: update current snap on scroll
  useEffect(() => {
    if (layout !== "slider" && layout !== "mf_card") return;
    const el = scrollerRef.current;
    if (!el) return;
    const handler = () => {
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      setCurrentSnap((prev) => (prev !== idx ? idx : prev));
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [layout]);

  const handleScroll = useCallback(
    (dir: "prev" | "next") => {
      const el = scrollerRef.current;
      if (!el) return;

      const { scrollLeft, scrollWidth, clientWidth } = el;
      const maxScroll = scrollWidth - clientWidth;
      const step =
        layout === "featured"
          ? clientWidth / 2
          : layout === "slider"
            ? clientWidth
            : layout === "shop_by_category"
              ? clientWidth
              : layout === "mf_card"
                ? clientWidth
                : scrollStep;

      if (dir === "next") {
        if (scrollLeft >= maxScroll - 10) {
          // Loop back to start if at end
          el.scrollTo({ left: 0, behavior: "smooth" });
        } else {
          el.scrollBy({ left: step, behavior: "smooth" });
        }
      } else {
        el.scrollBy({ left: -step, behavior: "smooth" });
      }
      requestAnimationFrame(updateButtons);
    },
    [scrollStep, updateButtons, layout],
  );

  const handleLinkClick = useCallback(
    (e: React.MouseEvent<any>) => {
      if (!isPreview) e.preventDefault();
    },
    [isPreview],
  );
  // Autoplay Logic
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
    return (
      <section
        className={`py-12 md:py-20 ${element.className || ""}`}
        style={{
          ...element.style,
          background:
            element.data?.sectionBg || "var(--color-variant-background-color)",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="mx-auto container px-4">
          <div className="flex flex-col items-center text-center">
            <h2
              className="mt-3 text-3xl font-semibold md:text-4xl"
              style={{
                color:
                  element.data?.headingColor ||
                  "var(--color-foreground-heading)",
              }}
            >
              {heading}
            </h2>
          </div>
          <div className="relative mt-10">
            <button
              type="button"
              onClick={() => handleScroll("prev")}
              disabled={!canPrev}
              className="absolute left-[-18px] top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border shadow-[0_12px_30px_rgba(0,0,0,0.12)] transition disabled:cursor-not-allowed disabled:opacity-40 sm:left-[-28px]"
              style={{
                background:
                  element.data?.arrowBgColor ||
                  "var(--color-primary-button-text)",
                borderColor: element.data?.borderColor || "var(--color-border)",
                color: element.data?.labelColor || "var(--color-foreground)",
              }}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => handleScroll("next")}
              disabled={!canNext}
              className="absolute right-[-18px] top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border shadow-[0_12px_30px_rgba(0,0,0,0.12)] transition disabled:cursor-not-allowed disabled:opacity-40 sm:right-[-28px]"
              style={{
                background:
                  element.data?.arrowBgColor ||
                  "var(--color-primary-button-text)",
                borderColor: element.data?.borderColor || "var(--color-border)",
                color: element.data?.labelColor || "var(--color-foreground)",
              }}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="overflow-hidden">
              <div
                ref={scrollerRef}
                className="flex ml-0 overflow-x-auto scroll-smooth pb-2"
                style={{ scrollbarWidth: "none", gap: `${sliderGap}px` }}
              >
                {visible.map((item: any, index: number) => {
                  const href = resolveHref(item);
                  const label = resolveLabel(item);
                  const imageSrc = resolveImage(item);
                  const key = buildKey(item, index);
                  return (
                    <div
                      key={key}
                      className="shrink-0"
                      style={{ flex: `0 0 ${100 / Math.max(1, perView)}%` }}
                    >
                      <a
                        href={href}
                        className="group relative block h-full rounded p-4"
                        style={{
                          background:
                            element.data?.sliderCardBg ||
                            "var(--color-variant-background-color)",
                          borderColor:
                            element.data?.sliderBorderColor ||
                            "var(--color-variant-border-color)",
                        }}
                        onClick={handleLinkClick}
                      >
                        <div className="relative mx-auto h-60 md:h-72 w-full overflow-hidden rounded">
                          {imageSrc ? (
                            <img
                              src={imageSrc}
                              alt={label}
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <span
                                className="rounded-full px-6 py-2 text-base font-semibold shadow-[0_15px_35px_rgba(0,0,0,0.14)]"
                                style={{
                                  background:
                                    element.data?.chipBgColor ||
                                    "var(--color-primary-button-text)",
                                  color:
                                    element.data?.chipTextColor ||
                                    "var(--color-primary-button_background)",
                                }}
                              >
                                {label}
                              </span>
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span
                              className="rounded-full px-6 py-2 text-base font-semibold shadow-[0_15px_35px_rgba(0,0,0,0.14)]"
                              style={{
                                background:
                                  element.data?.chipBgColor ||
                                  "var(--color-primary-button-text)",
                                color:
                                  element.data?.chipTextColor ||
                                  "var(--color-primary-button_background)",
                              }}
                            >
                              {label}
                            </span>
                          </div>
                        </div>
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (layout === "slider") {
    const getPerView = () => perView;
    const computeSnapFromIndex = (index: number) => {
      const perView = getPerView();
      return Math.floor(index / perView);
    };
    const scrollToSnap = (index: number) => {
      const el = scrollerRef.current;
      if (!el) return;
      el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
    };

    return (
      <div
        className={`px-6 ${element.className || ""}`}
        style={{ ...element.style }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex w-full items-center justify-between">
          <h2
            className="text-2xl font-semibold sm:text-3xl"
            style={{ color: headingColor }}
          >
            {heading}
          </h2>
        </div>

        <div className="mt-10 relative">
          <div className="overflow-hidden">
            <div
              ref={scrollerRef}
              className="flex overflow-x-auto scroll-smooth pb-4 min-h-[220px]"
              style={{ scrollbarWidth: "none", gap: `${sliderGap}px` }}
            >
              {list.map((item: any, index: number) => {
                const href = resolveHref(item);
                const label = resolveLabel(item);
                const imageSrc = resolveImage(item);
                const key = buildKey(item, index);
                return (
                  <a
                    key={key}
                    href={href}
                    className="group flex h-full shrink-0 flex-col items-center rounded-lg border px-6 pb-7 pt-14 text-center transition-all duration-300"
                    style={{
                      borderColor: sliderBorderColor,
                      backgroundColor: sliderCardBg,
                      flex: `0 0 ${100 / Math.max(1, perView)}%`,
                    }}
                    onMouseEnter={() =>
                      setCurrentSnap(computeSnapFromIndex(index))
                    }
                    onClick={handleLinkClick}
                  >
                    <div className="relative h-24 w-24 sm:h-24 sm:w-24">
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt={label}
                          className="h-full w-full object-contain transition-transform duration-300"
                          style={{}}
                        />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center text-xs font-semibold"
                          style={{ color: placeholderColor }}
                        >
                          {label?.[0] || ""}
                        </div>
                      )}
                    </div>

                    <div className="relative mt-8">
                      <p
                        className="text-lg font-medium"
                        style={{ color: labelColor }}
                      >
                        {label}
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>

          {(element.data?.sliderShowArrows || element.data?.sliderShowDots) && (
            <div className="mt-8 flex justify-center">
              <div className="flex items-center gap-4 px-4 py-2">
                {element.data?.sliderShowArrows && (
                  <button
                    type="button"
                    onClick={() => handleScroll("prev")}
                    className="flex h-8 w-8 items-center justify-center rounded-full transition"
                    style={{ color: labelColor }}
                    aria-label="Previous"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M15 6L9 12L15 18"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}
                {element.data?.sliderShowDots && (
                  <div className="flex items-center gap-2">
                    {Array.from({ length: snapCount }).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => scrollToSnap(i)}
                        aria-label={`Go to slide ${i + 1}`}
                        className="rounded-full transition-all duration-300"
                        style={{
                          width: i === currentSnap ? 24 : 8,
                          height: 8,
                          backgroundColor:
                            i === currentSnap
                              ? sliderActiveDotColor
                              : sliderInactiveDotColor,
                        }}
                      />
                    ))}
                  </div>
                )}
                {element.data?.sliderShowArrows && (
                  <button
                    type="button"
                    onClick={() => handleScroll("next")}
                    className="flex h-8 w-8 items-center justify-center rounded-full transition"
                    style={{ color: labelColor }}
                    aria-label="Next"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M9 6L15 12L9 18"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (layout === "featured") {
    return (
      <div
        className={`space-y-10 ${element.className || ""}`}
        style={{ ...element.style }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2
              className="text-3xl font-semibold sm:text-[40px]"
              style={{ color: headingColor }}
            >
              {heading}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleScroll("prev")}
              aria-label="View previous categories"
              disabled={!canPrev}
              className={`relative flex h-6 w-6 items-center justify-center rounded-full border transition-colors duration-200 ${
                canPrev ? "hover:bg-opacity-5" : "border-none opacity-50"
              }`}
              style={{
                borderColor: canPrev ? activeColor : "transparent",
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: canPrev ? activeColor : inactiveColor,
                }}
              />
              {canPrev && (
                <span
                  className="absolute inset-0 rounded-full border opacity-60"
                  style={{ borderColor: activeColor }}
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => handleScroll("next")}
              aria-label="View next categories"
              disabled={!canNext}
              className={`relative flex h-6 w-6 items-center justify-center rounded-full border transition-colors duration-200 ${
                canNext ? "hover:bg-opacity-5" : "border-none opacity-50"
              }`}
              style={{
                borderColor: canNext ? activeColor : "transparent",
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: canNext ? activeColor : inactiveColor,
                }}
              />
              {canNext && (
                <span
                  className="absolute inset-0 rounded-full border opacity-60"
                  style={{ borderColor: activeColor }}
                />
              )}
            </button>
          </div>
        </div>

        <div className="w-full overflow-hidden">
          <div
            ref={scrollerRef}
            className="flex overflow-x-auto scroll-smooth items-stretch pb-4"
            style={{
              gap: "20px", // gap-5 equivalent
              scrollbarWidth: "none",
            }}
          >
            {list.map((category: any, index: number) => {
              const key = buildKey(category, index);
              const href = resolveHref(category);
              const label = resolveLabel(category);
              const imageSrc = resolveImage(category);

              return (
                <div
                  key={key}
                  className="shrink-0 basis-1/2 sm:basis-1/3 lg:basis-1/6"
                >
                  <a
                    href={href}
                    className="group flex h-full flex-col rounded-xl p-6 text-center transition"
                    style={
                      {
                        backgroundColor: cardBackground,
                        "--hover-bg": cardHoverBackground,
                      } as any
                    }
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        cardHoverBackground;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = cardBackground;
                    }}
                    onClick={handleLinkClick}
                  >
                    <div className="mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full bg-white shadow-inner sm:h-28 sm:w-28">
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt={label}
                          width={120}
                          height={120}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center text-xs font-semibold"
                          style={{ color: headingColor }}
                        >
                          {label?.[0] || ""}
                        </div>
                      )}
                    </div>
                    <h3
                      className="text-base font-semibold line-clamp-2 min-h-[42px]"
                      style={{ color: headingColor }}
                    >
                      {label}
                    </h3>
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (layout === "split") {
    return (
      <div
        className={`px-4 py-6 sm:px-6 lg:px-8 md:pt-16 ${element.className || ""}`}
        style={{ ...element.style }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="md:max-w-sm overflow-hidden p-1">
            <h2
              className="text-2xl font-semibold md:text-[40px]"
              style={{ color: headingColor }}
            >
              {heading}
            </h2>
            <p
              className="mt-3 text-sm md:text-base whitespace-normal break-words"
              style={{ color: descriptionColor }}
            >
              {description}
            </p>
          </div>
          <div className="relative w-full overflow-hidden md:flex-1 mt-4 md:mt-0">
            <div
              ref={scrollerRef}
              className="flex gap-x-4 overflow-x-auto scroll-smooth pb-4 min-h-[140px]"
              style={{
                scrollbarWidth: "none",
              }}
            >
              {list.map((item: any, index: number) => {
                const href = resolveHref(item);
                const label = resolveLabel(item);
                const imageSrc = resolveImage(item);
                const key = buildKey(item, index);
                return (
                  <a
                    key={key}
                    href={href}
                    className="flex w-32 shrink-0 flex-col items-center text-center transition hover:opacity-90 md:w-40"
                    onClick={handleLinkClick}
                  >
                    <div className="relative flex h-24 w-full items-center justify-center md:h-32">
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt={label}
                          width={160}
                          height={160}
                          className="h-20 w-full max-w-[100px] object-cover md:h-24 md:max-w-[120px]"
                        />
                      ) : (
                        <span
                          className="text-sm font-semibold"
                          style={{ color: placeholderColor }}
                        >
                          {label}
                        </span>
                      )}
                    </div>
                    <span
                      className="text-sm font-medium hover:underline"
                      style={{ color: labelColor }}
                    >
                      {label}
                    </span>
                  </a>
                );
              })}
            </div>

            {showArrows && (
              <>
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-start md:left-6">
                  <button
                    type="button"
                    onClick={() => handleScroll("prev")}
                    disabled={!canPrev}
                    className="pointer-events-auto hidden h-10 w-10 -translate-x-2 items-center justify-center rounded-full border bg-white shadow-sm transition hover:bg-gray-50 disabled:opacity-40 md:-translate-x-6 md:flex md:h-12 md:w-12"
                    style={{
                      borderColor,
                      color: labelColor,
                    }}
                    aria-label="Scroll categories backward"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M15 6L9 12L15 18"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center justify-end md:right-8">
                  <button
                    type="button"
                    onClick={() => handleScroll("next")}
                    disabled={!canNext}
                    className="pointer-events-auto hidden h-10 w-10 translate-x-2 items-center justify-center rounded-full border bg-white shadow-sm transition hover:bg-gray-50 disabled:opacity-40 md:flex md:translate-x-6 md:h-12 md:w-12"
                    style={{
                      borderColor,
                      color: labelColor,
                    }}
                    aria-label="Scroll categories forward"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M9 6L15 12L9 18"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (layout === "mf_card") {
    const getPerView = () => perView;
    const computeSnapFromIndex = (index: number) => {
      const perView = getPerView();
      return Math.floor(index / perView);
    };
    const scrollToSnap = (index: number) => {
      const el = scrollerRef.current;
      if (!el) return;
      el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
    };

    return (
      <section
        className={`py-10 md:py-16 ${element.className || ""}`}
        style={{
          ...element.style,
          background:
            element.data?.sectionBg || "var(--color-variant-background-color)",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="mx-auto container px-4">
          <div className="flex flex-col items-center text-center">
            <h2
              className="mt-2 text-2xl font-semibold md:text-4xl"
              style={{
                color:
                  element.data?.headingColor ||
                  "var(--color-foreground-heading)",
              }}
            >
              {heading}
            </h2>
          </div>
          <div className="mt-8 relative">
            <div className="overflow-hidden">
              <div
                ref={scrollerRef}
                className="flex overflow-x-auto scroll-smooth pb-2"
                style={{ scrollbarWidth: "none", gap: `${sliderGap}px` }}
              >
                {list.map((item: any, index: number) => {
                  const href = resolveHref(item);
                  const label = resolveLabel(item);
                  const imageSrc = resolveImage(item);
                  const key = buildKey(item, index);
                  return (
                    <a
                      key={key}
                      href={href}
                      className="flex aspect-square flex-col items-center justify-center group rounded-xl border shadow-sm md:px-6 md:py-8 p-2 md:gap-4 transition hover:shadow-md w-full h-full shrink-0"
                      style={{
                        background:
                          element.data?.sliderCardBg ||
                          "var(--color-variant-background-color)",
                        borderColor:
                          element.data?.sliderBorderColor ||
                          "var(--color-variant-border-color)",
                        flex: `0 0 ${100 / Math.max(1, perView)}%`,
                      }}
                      onMouseEnter={() =>
                        setCurrentSnap(computeSnapFromIndex(index))
                      }
                      onClick={handleLinkClick}
                    >
                      <div className="flex items-center justify-center mb-2 md:mb-2">
                        {imageSrc ? (
                          <img
                            src={imageSrc}
                            alt={label}
                            width={60}
                            height={60}
                            className="w-12 h-12 md:w-16 md:h-16 object-contain"
                          />
                        ) : (
                          <div className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center rounded-md">
                            <span
                              className="text-sm md:text-base font-semibold"
                              style={{
                                color:
                                  element.data?.labelColor ||
                                  "var(--color-foreground)",
                              }}
                            >
                              {label?.[0] || ""}
                            </span>
                          </div>
                        )}
                      </div>
                      <p
                        className="text-center font-semibold"
                        style={{
                          color:
                            element.data?.labelColor ||
                            "var(--color-foreground-heading)",
                          fontSize: "1rem",
                        }}
                      >
                        {label}
                      </p>
                    </a>
                  );
                })}
              </div>
            </div>

            {(element.data?.mfShowArrows || element.data?.mfShowDots) && (
              <div className="mt-6 flex justify-center">
                <div className="flex items-center gap-4 px-4 py-2">
                  {element.data?.mfShowArrows && (
                    <button
                      type="button"
                      onClick={() => handleScroll("prev")}
                      className="flex h-8 w-8 items-center justify-center rounded-full transition"
                      style={{ color: labelColor }}
                      aria-label="Previous"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M15 6L9 12L15 18"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  )}
                  {element.data?.mfShowDots && (
                    <div className="flex items-center gap-2">
                      {Array.from({ length: snapCount }).map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => scrollToSnap(i)}
                          aria-label={`Go to slide ${i + 1}`}
                          className="rounded-full transition-all duration-300"
                          style={{
                            width: i === currentSnap ? 24 : 8,
                            height: 8,
                            backgroundColor:
                              i === currentSnap
                                ? sliderActiveDotColor
                                : sliderInactiveDotColor,
                          }}
                        />
                      ))}
                    </div>
                  )}
                  {element.data?.mfShowArrows && (
                    <button
                      type="button"
                      onClick={() => handleScroll("next")}
                      className="flex h-8 w-8 items-center justify-center rounded-full transition"
                      style={{ color: labelColor }}
                      aria-label="Next"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M9 6L15 12L9 18"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  // Default Simple Layout
  return (
    <div
      className={`relative group ${element.className || ""}`}
      style={{ ...element.style }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="overflow-hidden">
        <div
          ref={scrollerRef}
          className="flex overflow-x-auto scroll-smooth pb-4"
          style={{
            gap: `${gap}px`,
            scrollbarWidth: "none",
          }}
        >
          {list.map((item: any, index: number) => {
            const href = resolveHref(item);
            const label = resolveLabel(item);
            const imageSrc = resolveImage(item);
            const key = buildKey(item, index);
            return (
              <a
                key={key}
                href={href}
                className="flex shrink-0 flex-col items-center text-center transition md:w-40"
                style={{ width: `${itemWidth}px` }}
                onClick={handleLinkClick}
              >
                <div
                  className="relative flex w-full items-center justify-center"
                  style={{ height: `${itemHeight}px` }}
                >
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt={label}
                      style={{
                        width: "100%",
                        maxWidth: `${itemWidth - 40}px`,
                        height: `${Math.max(64, itemHeight - 40)}px`,
                        objectFit: "cover",
                        borderRadius: "4px",
                      }}
                    />
                  ) : (
                    <span
                      className="text-sm font-semibold"
                      style={{ color: placeholderColor }}
                    >
                      {label}
                    </span>
                  )}
                </div>
                {showLabels && (
                  <span
                    className="text-sm font-medium hover:underline"
                    style={{ color: labelColor }}
                    dangerouslySetInnerHTML={{ __html: label }}
                  />
                )}
              </a>
            );
          })}
        </div>
      </div>
      {showArrows && (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-6 flex items-center justify-start">
            <button
              type="button"
              onClick={() => handleScroll("prev")}
              disabled={!canPrev}
              className="pointer-events-auto hidden h-12 w-12 -translate-x-6 items-center justify-center rounded-full border bg-white text-black shadow-sm transition disabled:opacity-40 md:flex"
              style={{ borderColor, color: labelColor }}
              aria-label="Scroll categories backward"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                <path
                  d="M15 6L9 12L15 18"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-8 flex items-center justify-end">
            <button
              type="button"
              onClick={() => handleScroll("next")}
              disabled={!canNext}
              className="pointer-events-auto hidden h-12 w-12 translate-x-6 items-center justify-center rounded-full border bg-white text-black shadow-sm transition disabled:opacity-40 md:flex"
              style={{ borderColor, color: labelColor }}
              aria-label="Scroll categories forward"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 6L15 12L9 18"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export const CustomCategoryDef: CustomComponentDef = {
  name: "Category Carousel",
  icon: <Grid className="w-4 h-4" />,
  category: "Dynamic",
  component: CustomCategoryComponent,
  variants: [
    {
      name: "Simple List",
      icon: <Grid className="w-4 h-4" />,
      defaultData: { layout: "simple" },
    },
    {
      name: "Featured Grid",
      icon: <Grid className="w-4 h-4" />,
      defaultData: { layout: "featured" },
    },
    {
      name: "Split Layout",
      icon: <Grid className="w-4 h-4" />,
      defaultData: { layout: "split" },
    },
    {
      name: "Category Slider",
      icon: <Grid className="w-4 h-4" />,
      defaultData: { layout: "slider" },
    },
    {
      name: "Shop by Category",
      icon: <Grid className="w-4 h-4" />,
      defaultData: { layout: "shop_by_category" },
    },
    {
      name: "Square Cards",
      icon: <Grid className="w-4 h-4" />,
      defaultData: { layout: "mf_card", mobileItems: 2, desktopItems: 5 },
    },
  ],
  defaultData: {
    categories: [
      {
        category_id: "1",
        name: "Fresh Fruits",
        slug: "fresh-fruits",
        image: "https://picsum.photos/id/102/300/300",
      },
      {
        category_id: "2",
        name: "Vegetables",
        slug: "vegetables",
        image: "https://picsum.photos/id/103/300/300",
      },
      {
        category_id: "3",
        name: "Snacks",
        slug: "snacks",
        image: "https://picsum.photos/id/104/300/300",
      },
      {
        category_id: "4",
        name: "Beverages",
        slug: "beverages",
        image: "https://picsum.photos/id/106/300/300",
      },
      {
        category_id: "5",
        name: "Dairy",
        slug: "dairy",
        image: "https://picsum.photos/id/108/300/300",
      },
      {
        category_id: "6",
        name: "Bakery",
        slug: "bakery",
        image: "https://picsum.photos/id/111/300/300",
      },
      {
        category_id: "7",
        name: "Breakfast",
        slug: "breakfast",
        image: "https://picsum.photos/id/112/300/300",
      },
      {
        category_id: "8",
        name: "Meat",
        slug: "meat",
        image: "https://picsum.photos/id/113/300/300",
      },
    ],
    itemWidth: 160,
    itemHeight: 128,
    gap: 16,
    scrollStep: 320,
    showArrows: true,
    showLabels: true,
    autoplay: true,
    autoplaySpeed: 3000,
    labelColor: "var(--color-foreground)",
    placeholderColor: "var(--color-foreground)",
    borderColor: "var(--color-border)",
    hoverBg: "#F5F5F5",
    // New defaults
    layout: "simple",
    heading: "Featured Categories",
    headingColor: "var(--color-foreground-heading)",
    cardBackground: "var(--color-variant-background-color)",
    cardHoverBackground: "var(--color-variant-hover-background-color)",
    activeColor: "var(--color-primary)",
    inactiveColor: "var(--color-border)",
    sliderGap: 24,
    sliderCardBg: "var(--color-variant-background-color)",
    sliderBorderColor: "var(--color-variant-border-color)",
    sliderActiveDotColor: "var(--color-primary)",
    sliderInactiveDotColor: "var(--color-border)",
    sliderPerSm: 1,
    sliderPerMd: 2,
    sliderPerLg: 3,
    sliderPerXl: 4,
    sliderPer2xl: 6,
    mobileItems: 1,
    desktopItems: 4,
    sectionBg: "var(--color-variant-background-color)",
    chipBgColor: "var(--color-primary-button-text)",
    chipTextColor: "var(--color-primary-button-background)",
    arrowBgColor: "var(--color-primary-button-text)",
    sliderShowArrows: true,
    sliderShowDots: true,
    mfShowArrows: true,
    mfShowDots: true,
  },
  settings: {
    layout: {
      type: "select",
      label: "Layout",
      options: [
        { label: "Simple List", value: "simple" },
        { label: "Featured Grid", value: "featured" },
        { label: "Split Layout", value: "split" },
        { label: "Category Slider", value: "slider" },
        { label: "Shop by Category", value: "shop_by_category" },
        { label: "Square Cards", value: "mf_card" },
      ],
      default: "simple",
    },
    heading: {
      type: "text",
      label: "Heading",
      default: "Featured Categories",
    },
    description: {
      type: "text",
      label: "Description (Split)",
      default:
        "Pellentesque ante neque, faucibus et delito an pretium vestibulum del varius quam.",
    },
    categories: {
      type: "array_object",
      label: "Categories",
      itemSchema: {
        category_id: { type: "text", label: "ID", default: "" },
        name: { type: "text", label: "Name", default: "Category" },
        slug: { type: "text", label: "Slug", default: "" },
        image: { type: "text", label: "Image URL", default: "" },
      },
      defaultItem: { category_id: "", name: "Category", slug: "", image: "" },
    },
    itemWidth: {
      type: "number_slider",
      label: "Item Width (Simple)",
      min: 100,
      max: 240,
      step: 10,
      default: 160,
      conditionalDisplay: { field: "layout", value: "simple" },
    },
    itemHeight: {
      type: "number_slider",
      label: "Item Height (Simple)",
      min: 80,
      max: 240,
      step: 8,
      default: 128,
      conditionalDisplay: { field: "layout", value: "simple" },
    },
    gap: {
      type: "number_slider",
      label: "Gap",
      min: 0,
      max: 40,
      step: 2,
      default: 16,
      conditionalDisplay: { field: "layout", value: "simple" },
    },
    scrollStep: {
      type: "number_slider",
      label: "Scroll Step",
      min: 80,
      max: 600,
      step: 20,
      default: 320,
      conditionalDisplay: { field: "layout", value: "simple" },
    },
    showArrows: {
      type: "boolean",
      label: "Show Arrows (Simple)",
      default: true,
      conditionalDisplay: { field: "layout", value: "simple" },
    },
    autoplay: {
      type: "boolean",
      label: "Autoplay",
      default: true,
    },
    autoplaySpeed: {
      type: "number_slider",
      label: "Autoplay Speed (ms)",
      min: 1000,
      max: 10000,
      step: 500,
      default: 3000,
    },
    showLabels: {
      type: "boolean",
      label: "Show Labels (Simple)",
      default: true,
      conditionalDisplay: { field: "layout", value: "simple" },
    },
    labelColor: {
      type: "color",
      label: "Label Color (Simple)",
      default: "#0D1D17",
      conditionalDisplay: { field: "layout", value: "simple" },
    },
    placeholderColor: {
      type: "color",
      label: "Placeholder Color (Simple)",
      default: "#7A7F85",
      conditionalDisplay: { field: "layout", value: "simple" },
    },
    borderColor: {
      type: "color",
      label: "Arrow Border (Simple)",
      default: "#E1E4E6",
      conditionalDisplay: { field: "layout", value: "simple" },
    },
    hoverBg: {
      type: "color",
      label: "Hover Background (Simple)",
      default: "#F5F5F5",
      conditionalDisplay: { field: "layout", value: "simple" },
    },
    // New Settings UI
    headingColor: {
      type: "color",
      label: "Heading Color",
      default: "#1D2B3A",
    },
    descriptionColor: {
      type: "color",
      label: "Desc Color (Split)",
      default: "#555C63",
      conditionalDisplay: { field: "layout", value: "split" },
    },
    cardBackground: {
      type: "color",
      label: "Card Background (Featured)",
      default: "#F5F5F5",
      conditionalDisplay: { field: "layout", value: "featured" },
    },
    cardHoverBackground: {
      type: "color",
      label: "Card Hover Bg (Featured)",
      default: "#E9F6F1",
      conditionalDisplay: { field: "layout", value: "featured" },
    },
    activeColor: {
      type: "color",
      label: "Active Color (Featured)",
      default: "#0F645D",
      conditionalDisplay: { field: "layout", value: "featured" },
    },
    inactiveColor: {
      type: "color",
      label: "Inactive Color (Featured)",
      default: "#CBD8E0",
      conditionalDisplay: { field: "layout", value: "featured" },
    },
    // Slider settings
    sliderGap: {
      type: "number_slider",
      label: "Slider Gap",
      min: 0,
      max: 40,
      step: 2,
      default: 24,
    },
    sliderCardBg: {
      type: "color",
      label: "Slider Card Background",
      default: "#FFFFFF",
    },
    sliderBorderColor: {
      type: "color",
      label: "Slider Card Border",
      default: "#E1E4E6",
    },
    sliderActiveDotColor: {
      type: "color",
      label: "Slider Active Dot",
      default: "#0D1D17",
      conditionalDisplay: { field: "layout", value: "slider" },
    },
    sliderInactiveDotColor: {
      type: "color",
      label: "Slider Inactive Dot",
      default: "#9CA3AF",
      conditionalDisplay: { field: "layout", value: "slider" },
    },
    sliderShowArrows: {
      type: "boolean",
      label: "Show Arrows (Slider)",
      default: true,
      conditionalDisplay: { field: "layout", value: "slider" },
    },
    sliderShowDots: {
      type: "boolean",
      label: "Show Dots (Slider)",
      default: true,
      conditionalDisplay: { field: "layout", value: "slider" },
    },
    mobileItems: {
      type: "number_slider",
      label: "Slides (Mobile)",
      min: 1,
      max: 6,
      step: 1,
      default: 1,
      conditionalDisplay: { field: "layout", value: "shop_by_category" },
    },
    desktopItems: {
      type: "number_slider",
      label: "Slides (Desktop)",
      min: 1,
      max: 8,
      step: 1,
      default: 4,
      conditionalDisplay: { field: "layout", value: "shop_by_category" },
    },
    mfShowArrows: {
      type: "boolean",
      label: "Show Arrows (Square Cards)",
      default: true,
      conditionalDisplay: { field: "layout", value: "mf_card" },
    },
    mfShowDots: {
      type: "boolean",
      label: "Show Dots (Square Cards)",
      default: true,
      conditionalDisplay: { field: "layout", value: "mf_card" },
    },
    sectionBg: {
      type: "color",
      label: "Section Background",
      default: "var(--color-variant-background-color)",
      conditionalDisplay: { field: "layout", value: "shop_by_category" },
    },
    chipBgColor: {
      type: "color",
      label: "Chip Background",
      default: "var(--color-primary-button-text)",
      conditionalDisplay: { field: "layout", value: "shop_by_category" },
    },
    chipTextColor: {
      type: "color",
      label: "Chip Text",
      default: "var(--color-primary-button-background)",
      conditionalDisplay: { field: "layout", value: "shop_by_category" },
    },
    arrowBgColor: {
      type: "color",
      label: "Arrow Background",
      default: "var(--color-primary-button-text)",
      conditionalDisplay: { field: "layout", value: "shop_by_category" },
    },
  },
};
