import React from "react";
import * as Icons from "lucide-react";

const GalleryComponent = ({ element, onUpdate, isPreview, deviceView }) => {
  const isMobile =
    deviceView === "mobile" ||
    (typeof window !== "undefined" && window.innerWidth < 768);

  const {
    items = [],
    gap = 16,
    borderRadius = 16,
    hoverEffect = "zoom",
  } = element.data || {};

  // Helper to get span classes based on size
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

  return (
    <div
      style={{
        ...element.style,
        display: "grid",
        gridTemplateColumns: isMobile
          ? "1fr"
          : "repeat(auto-fit, minmax(250px, 1fr))", // Responsive grid
        gridAutoRows: "250px", // Base row height
        gridAutoFlow: "dense", // Pack items densely
        gap: `${gap}px`,
      }}
      className="w-full"
    >
      {items.map((item, index) => {
        const spanStyle = getSpanStyle(item.size);

        return (
          <div
            key={index}
            className={`relative group/bento overflow-hidden ${
              hoverEffect === "zoom" ? "cursor-pointer" : ""
            }`}
            style={{
              ...spanStyle,
              borderRadius: `${borderRadius}px`,
              backgroundColor: "#f3f4f6",
            }}
          >
            {/* Image */}
            <img
              src={item.image}
              alt={item.title || `Gallery Item ${index}`}
              className={`w-full h-full object-cover transition-transform duration-700 ${
                hoverEffect === "zoom" ? "group-hover/bento:scale-110" : ""
              }`}
            />
          </div>
        );
      })}
    </div>
  );
};

export const CustomGalleryDef = {
  name: "Bento Gallery",
  icon: <Icons.LayoutGrid className="w-4 h-4" />,
  category: "Content",
  component: GalleryComponent,
  defaultData: {
    gap: 16,
    borderRadius: 16,
    hoverEffect: "zoom",
    items: [
      {
        image: "https://picsum.photos/600/600?1",
        size: "normal",
      },
      {
        image: "https://picsum.photos/600/800?2",
        size: "tall",
      },
      {
        image: "https://picsum.photos/800/600?3",
        size: "wide",
      },
      {
        image: "https://picsum.photos/600/800?4",
        size: "tall",
      },
      {
        image: "https://picsum.photos/600/600?5",
        size: "normal",
      },
    ],
  },
  settings: {
    items: {
      type: "array_object",
      label: "Gallery Items",
      itemSchema: {
        image: {
          type: "text",
          label: "Image URL",
          default: "https://picsum.photos/600/600",
        },
        size: {
          type: "select",
          label: "Size",
          options: [
            { label: "Normal (1x1)", value: "normal" },
            { label: "Tall (1x2)", value: "tall" },
            { label: "Wide (2x1)", value: "wide" },
            { label: "Big (2x2)", value: "big" },
          ],
          default: "normal",
        },
      },
      defaultItem: {
        image: "https://picsum.photos/600/600",
        size: "normal",
      },
    },
    gap: {
      type: "number_slider",
      label: "Gap",
      min: 0,
      max: 40,
      default: 16,
    },
    borderRadius: {
      type: "number_slider",
      label: "Border Radius",
      min: 0,
      max: 40,
      default: 16,
    },
    hoverEffect: {
      type: "select",
      label: "Hover Effect",
      options: [
        { label: "Zoom", value: "zoom" },
        { label: "None", value: "none" },
      ],
      default: "zoom",
    },
  },
};
