import React from "react";
import { Images } from "lucide-react";
import { imageGetUrl } from "./rendererUtils";

const ImageCarouselComponent = ({
  element,
  onUpdate,
  isPreview,
  deviceView = "desktop",
}) => {
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
    borderRadius = 12,
  } = element.data || {};

  const effectiveHeight = isMobile
    ? mobileHeight || "400px"
    : isTablet
      ? tabletHeight || "450px"
      : height || "500px";

  const effectiveImageWidth = isMobile
    ? Math.min(imageWidth, 280)
    : isTablet
      ? Math.min(imageWidth, 320)
      : imageWidth;

  const animationDuration = `${scrollSpeed}s`;

  const duplicatedImages = [...images, ...images, ...images, ...images];

  const uniqueId = element.id || "carousel";

  const singleSetWidth = images.length * (effectiveImageWidth + image_gap);

  return (
    <div
      style={{ ...element.style, overflow: "hidden" }}
      className={`w-full ${element.className || ""}`}
    >
      <style>{`
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
          animation: ${
            enableAutoplay
              ? `marquee-${uniqueId} ${animationDuration} linear infinite`
              : "none"
          };
          will-change: transform;
        }
        .marquee-track-${uniqueId}:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className="relative w-full" style={{ height: effectiveHeight }}>
        {images.length > 0 ? (
          <div
            className={`marquee-track-${uniqueId}`}
            style={{ gap: `${image_gap}px` }}
          >
            {duplicatedImages.map((img, idx) => (
              <div
                key={idx}
                className="flex-shrink-0"
                style={{
                  width: `${effectiveImageWidth}px`,
                  height: effectiveHeight,
                }}
              >
                <img
                  src={imageGetUrl(img?.image)}
                  alt={`Slide ${(idx % images.length) + 1}`}
                  className="w-full h-full bg-gray-100"
                  style={{
                    objectFit: image_fit || "cover",
                    borderRadius: `${borderRadius}px`,
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div
            className="w-full bg-gray-100 flex items-center justify-center"
            style={{ height: effectiveHeight }}
          >
            <img
              src={imageGetUrl(undefined)}
              alt="Placeholder"
              className="w-64 h-64 object-contain opacity-70"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export const ImageCarouselDef = {
  name: "Image Carousel",
  icon: <Images className="w-4 h-4" />,
  category: "Dynamic",
  component: ImageCarouselComponent,
  defaultData: {
    images: [
      { image: "https://picsum.photos/500/500?1" },
      { image: "https://picsum.photos/500/500?2" },
      { image: "https://picsum.photos/500/500?3" },
      { image: "https://picsum.photos/500/500?4" },
      { image: "https://picsum.photos/500/500?5" },
    ],
    image_fit: "cover",
    image_gap: 16,
    enableAutoplay: true,
    scrollSpeed: 30,
    height: "500px",
    tabletHeight: "450px",
    mobileHeight: "400px",
    imageWidth: 350,
    borderRadius: 12,
  },
  settings: {
    images: {
      type: "array_object",
      label: "Slides",
      itemSchema: {
        image: {
          type: "text",
          label: "Image URL",
          default: "https://picsum.photos/500/500",
        },
      },
      defaultItem: { image: "https://picsum.photos/500/500" },
    },
    height: {
      type: "text",
      label: "Desktop Height",
      default: "500px",
    },
    tabletHeight: {
      type: "text",
      label: "Tablet Height",
      default: "450px",
    },
    mobileHeight: {
      type: "text",
      label: "Mobile Height (px, vh)",
      default: "400px",
    },
    image_fit: {
      type: "select",
      label: "Image Fit",
      options: [
        { label: "Cover", value: "cover" },
        { label: "Contain", value: "contain" },
        { label: "Fill", value: "fill" },
      ],
      default: "cover",
    },
    imageWidth: {
      type: "number_slider",
      label: "Image Width (px)",
      min: 150,
      max: 600,
      default: 350,
      step: 10,
    },
    borderRadius: {
      type: "number_slider",
      label: "Border Radius (px)",
      min: 0,
      max: 50,
      default: 12,
    },
    image_gap: {
      type: "number_slider",
      label: "Gap (px)",
      min: 0,
      max: 50,
      default: 16,
    },
    enableAutoplay: {
      type: "boolean",
      label: "Enable Autoplay",
      default: true,
    },
    scrollSpeed: {
      type: "number_slider",
      label: "Scroll Speed (seconds)",
      min: 5,
      max: 100,
      default: 30,
      step: 1,
    },
  },
};
