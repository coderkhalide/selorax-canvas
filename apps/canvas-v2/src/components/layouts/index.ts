import React from "react";
import {
  LayoutGrid,
  ArrowRightLeft,
  ArrowDown,
  ArrowDownRight,
  Circle,
  Rainbow,
  LayoutDashboard,
  TrendingUp,
  Hexagon,
  List,
  CheckCircle,
  ListOrdered,
  Square,
  Sparkles,
  CreditCard,
  BoxSelect,
  Images,
} from "lucide-react";

export interface LayoutVariant {
  id: string;
  name: string;
  icon: React.ReactNode;
  thumbnail?: string;
  defaultData: Record<string, any>;
  componentType: string;
}

// List Component Layouts (content same থাকবে, শুধু design change হবে)
export const LIST_LAYOUTS: LayoutVariant[] = [
  {
    id: "list-simple-disc",
    name: "Simple Bullets",
    icon: React.createElement(Circle, { className: "w-4 h-4" }),
    componentType: "list",
    defaultData: {
      layout: "simple",
      bulletStyle: "disc",
      bulletColor: "#3b82f6",
      textColor: "#1f2937",
      spacing: "normal",
    },
  },
  {
    id: "list-check-icons",
    name: "Check Icons",
    icon: React.createElement(CheckCircle, { className: "w-4 h-4" }),
    componentType: "list",
    defaultData: {
      layout: "check",
      bulletStyle: "check",
      bulletColor: "#10b981",
      textColor: "#1f2937",
      spacing: "comfortable",
    },
  },
  {
    id: "list-numbered",
    name: "Numbered List",
    icon: React.createElement(ListOrdered, { className: "w-4 h-4" }),
    componentType: "list",
    defaultData: {
      layout: "numbered",
      bulletStyle: "number",
      bulletColor: "#8b5cf6",
      textColor: "#1f2937",
      spacing: "normal",
    },
  },
  {
    id: "list-boxed-cards",
    name: "Boxed Cards",
    icon: React.createElement(Square, { className: "w-4 h-4" }),
    componentType: "list",
    defaultData: {
      layout: "boxed",
      bulletStyle: "none",
      cardBgColor: "#f3f4f6",
      textColor: "#1f2937",
      borderRadius: 8,
      spacing: "comfortable",
    },
  },
];

// Feature Grid (Boxes) Component Layouts
export const BOXES_LAYOUTS: LayoutVariant[] = [
  {
    id: "boxes-numbered",
    name: "Numbered",
    icon: React.createElement(ListOrdered, { className: "w-4 h-4" }),
    componentType: "boxes",
    defaultData: {
      layout: "numbered",
      gap: 24,
      cardBgColor: "#ffffff",
      accentColor: "#d6d3d1",
      titleColor: "#111827",
      descColor: "#6b7280",
    },
  },
  {
    id: "boxes-leaf",
    name: "Leaf Style",
    icon: React.createElement(LayoutGrid, { className: "w-4 h-4" }),
    componentType: "boxes",
    defaultData: {
      layout: "grid-leaf",
      gap: 24,
      cardBgColor: "#ffffff",
      accentColor: "#3b82f6",
      titleColor: "#111827",
      descColor: "#6b7280",
    },
  },
  {
    id: "boxes-soft-border",
    name: "Soft Border",
    icon: React.createElement(Square, { className: "w-4 h-4" }),
    componentType: "boxes",
    defaultData: {
      layout: "grid-soft",
      gap: 24,
      cardBgColor: "#ffffff",
      accentColor: "#d6d3d1",
      titleColor: "#111827",
      descColor: "#6b7280",
    },
  },
  {
    id: "boxes-quote",
    name: "Quote Center",
    icon: React.createElement(List, { className: "w-4 h-4" }),
    componentType: "boxes",
    defaultData: {
      layout: "grid-quote",
      gap: 24,
      cardBgColor: "#ffffff",
      accentColor: "#d6d3d1",
      titleColor: "#111827",
      descColor: "#6b7280",
    },
  },
  {
    id: "boxes-carousel",
    name: "Carousel",
    icon: React.createElement(LayoutGrid, { className: "w-4 h-4" }),
    componentType: "boxes",
    defaultData: {
      layout: "carousel",
      gap: 16,
      cardBgColor: "#ffffff",
      accentColor: "#3b82f6",
      titleColor: "#111827",
      descColor: "#6b7280",
    },
  },
];

export const VIDEO_CARD_LAYOUTS: LayoutVariant[] = [
  {
    id: "video-grid",
    name: "Grid",
    icon: React.createElement(LayoutGrid, { className: "w-4 h-4" }),
    componentType: "video_cards",
    defaultData: {
      layout: "grid",
      gap: 16,
    },
  },
  {
    id: "video-carousel",
    name: "Carousel",
    icon: React.createElement(LayoutGrid, { className: "w-4 h-4" }),
    componentType: "video_cards",
    defaultData: {
      layout: "carousel",
      gap: 16,
    },
  },
];

export const QUOTES_LAYOUTS: LayoutVariant[] = [
  {
    id: "quotes-grid",
    name: "Grid",
    icon: React.createElement(ListOrdered, { className: "w-4 h-4" }),
    componentType: "quotes",
    defaultData: {
      layout: "grid",
      bgColor: "var(--color-input-background)",
      textColor: "var(--color-foreground)",
      accentColor: "var(--color-border)",
      quoteMarkColor: "var(--color-primary)",
      gap: 24,
    },
  },
  {
    id: "quotes-bubble",
    name: "Bubble",
    icon: React.createElement(LayoutGrid, { className: "w-4 h-4" }),
    componentType: "quotes",
    defaultData: {
      layout: "bubble",
      bgColor: "var(--color-input-background)",
      textColor: "var(--color-foreground)",
      accentColor: "var(--color-border)",
      quoteMarkColor: "var(--color-primary)",
      gap: 24,
    },
  },
  {
    id: "quotes-bordered",
    name: "Bordered",
    icon: React.createElement(Square, { className: "w-4 h-4" }),
    componentType: "quotes",
    defaultData: {
      layout: "bordered",
      bgColor: "var(--color-input-background)",
      textColor: "var(--color-foreground)",
      accentColor: "var(--color-border)",
      quoteMarkColor: "var(--color-primary)",
      gap: 24,
    },
  },
  {
    id: "quotes-minimal",
    name: "Minimal",
    icon: React.createElement(LayoutDashboard, { className: "w-4 h-4" }),
    componentType: "quotes",
    defaultData: {
      layout: "minimal",
      bgColor: "var(--color-input-background)",
      textColor: "var(--color-foreground)",
      accentColor: "var(--color-border)",
      quoteMarkColor: "var(--color-primary)",
      gap: 24,
    },
  },
  {
    id: "quotes-carousel",
    name: "Carousel",
    icon: React.createElement(LayoutGrid, { className: "w-4 h-4" }),
    componentType: "quotes",
    defaultData: {
      layout: "carousel",
      bgColor: "var(--color-input-background)",
      textColor: "var(--color-foreground)",
      accentColor: "var(--color-border)",
      quoteMarkColor: "var(--color-primary)",
      gap: 16,
    },
  },
];

// Hero Slider Layouts
export const HERO_SLIDER_LAYOUTS: LayoutVariant[] = [
  {
    id: "hero-slider-classic",
    name: "Classic",
    icon: React.createElement(Images, { className: "w-4 h-4" }),
    componentType: "hero_slider",
    defaultData: {
      layout: "classic",
    },
  },
  {
    id: "hero-slider-organic",
    name: "Organic Grocery",
    icon: React.createElement(Images, { className: "w-4 h-4" }),
    componentType: "hero_slider",
    defaultData: {
      layout: "organic",
    },
  },
  {
    id: "hero-slider-minimal",
    name: "Minimal Overlay",
    icon: React.createElement(Images, { className: "w-4 h-4" }),
    componentType: "hero_slider",
    defaultData: {
      layout: "minimal",
    },
  },
];

// Sequence Layouts
export const SEQUENCE_LAYOUTS: LayoutVariant[] = [
  {
    id: "sequence-vertical-boxes",
    name: "Vertical Boxes",
    icon: React.createElement(TrendingUp, { className: "w-4 h-4" }),
    componentType: "sequence",
    defaultData: {
      layout: "vertical-boxes",
      pyramidColor: "#edeae4", // Light Beige
      lineColor: "#d6d3d1",
      textColor: "#4b3b32",
    },
  },
  {
    id: "sequence-vertical-left",
    name: "Vertical Left List",
    icon: React.createElement(List, { className: "w-4 h-4" }),
    componentType: "sequence",
    defaultData: {
      layout: "vertical-left",
      pyramidColor: "#edeae4",
      lineColor: "#d6d3d1",
      textColor: "#4b3b32",
    },
  },
  {
    id: "sequence-list-skewed",
    name: "List Skewed",
    icon: React.createElement(ListOrdered, { className: "w-4 h-4" }),
    componentType: "sequence",
    defaultData: {
      layout: "list-skewed",
      pyramidColor: "#edeae4",
      numberColor: "#5d5047",
      textColor: "#4b3b32",
    },
  },
  {
    id: "sequence-grid-rounded",
    name: "Grid Rounded",
    icon: React.createElement(LayoutGrid, { className: "w-4 h-4" }),
    componentType: "sequence",
    defaultData: {
      layout: "grid-rounded",
      pyramidColor: "#edeae4",
      numberColor: "#5d5047",
      textColor: "#4b3b32",
    },
  },
  {
    id: "sequence-grid-skewed",
    name: "Grid Skewed",
    icon: React.createElement(Hexagon, { className: "w-4 h-4" }),
    componentType: "sequence",
    defaultData: {
      layout: "grid-skewed",
      pyramidColor: "#edeae4",
      numberColor: "#5d5047",
      textColor: "#4b3b32",
    },
  },
];

export const STEPS_LAYOUTS: LayoutVariant[] = [
  {
    id: "steps-pyramid-left",
    name: "Pyramid Left",
    icon: React.createElement(LayoutGrid, { className: "w-4 h-4" }),
    componentType: "step",
    defaultData: {
      layout: "pyramid-left",
      bgColor: "#f8f6f2",
      stripColor: "#edeae4",
      accentColor: "#e8e2d8",
      textColor: "#4b3b32",
      borderColor: "#d9d5cd",
      gap: 8,
    },
  },
  {
    id: "steps-pyramid-right",
    name: "Pyramid Right",
    icon: React.createElement(LayoutGrid, { className: "w-4 h-4" }),
    componentType: "step",
    defaultData: {
      layout: "pyramid-right",
      bgColor: "#f8f6f2",
      stripColor: "#edeae4",
      accentColor: "#e8e2d8",
      textColor: "#4b3b32",
      borderColor: "#d9d5cd",
      gap: 8,
    },
  },
  {
    id: "steps-flat",
    name: "Flat",
    icon: React.createElement(Square, { className: "w-4 h-4" }),
    componentType: "step",
    defaultData: {
      layout: "flat",
      bgColor: "#f8f6f2",
      stripColor: "#edeae4",
      accentColor: "#e8e2d8",
      textColor: "#4b3b32",
      borderColor: "#d9d5cd",
      gap: 8,
    },
  },
];

// ✅ Helper: Transform content between different component types
export const transformContentToComponent = (
  sourceData: Record<string, any>,
  sourceType: string,
  targetType: string,
): Record<string, any> => {
  // Extract content based on source type
  let contentItems: string[] = [];

  if (sourceType === "list" || !sourceType) {
    contentItems = sourceData.list || [];
  } else if (sourceType === "circle") {
    contentItems = (sourceData.items || []).map((item: any) => item.text || "");
  } else if (sourceType === "detail_list") {
    contentItems = (sourceData.items || []).map(
      (item: any) => item.title || "",
    );
  } else if (sourceType === "sequence") {
    contentItems = (sourceData.items || []).map((item: any) => item.text || "");
  }

  // ✅ Convert to target format

  // To List
  if (targetType === "list") {
    return {
      list: contentItems,
    };
  }

  // To Circle
  if (targetType === "circle") {
    return {
      items: contentItems.map((text: string) => ({
        text: text,
      })),
    };
  }

  // To Detail List
  if (targetType === "detail_list") {
    return {
      items: contentItems.map((text: string) => ({
        title: text,
        description: "",
        icon: "Star",
        color: "#3b82f6",
        iconSize: 24,
      })),
    };
  }

  if (targetType === "quotes") {
    return {
      items: contentItems.map((text: string) => ({ text, author: "" })),
    };
  }

  // To Sequence
  if (targetType === "sequence") {
    return {
      items: contentItems.map((text: string, idx: number) => ({
        text: text,
        number: `${idx + 1}`,
        subtext: "",
      })),
    };
  }

  if (targetType === "step") {
    return {
      items: contentItems.map((text: string) => ({ text })),
    };
  }

  return {};
};

export const getAllLayoutsSuggestions = (
  currentComponentType: string,
  currentData: Record<string, any>,
): LayoutVariant[] => {
  // All possible layouts from all components
  const allLayouts: LayoutVariant[] = [
    ...LIST_LAYOUTS,
    ...BOXES_LAYOUTS,
    ...VIDEO_CARD_LAYOUTS,
    ...SEQUENCE_LAYOUTS,
    ...QUOTES_LAYOUTS,
    ...STEPS_LAYOUTS,
  ];

  // Filter out current component's basic layouts (we'll show them separately)
  // For now, return all
  return allLayouts;
};

export const getLayoutsByComponentType = (
  componentType: string,
): LayoutVariant[] => {
  if (!componentType) return [];
  if (componentType === "hero_slider") return HERO_SLIDER_LAYOUTS;
  if (componentType === "list") return LIST_LAYOUTS;
  if (componentType === "boxes") return BOXES_LAYOUTS;
  if (componentType === "video_cards") return VIDEO_CARD_LAYOUTS;
  if (componentType === "sequence") return SEQUENCE_LAYOUTS;
  if (componentType === "quotes") return QUOTES_LAYOUTS;
  if (componentType === "step") return STEPS_LAYOUTS;
  if (
    componentType === "categories" ||
    componentType === "category_carousel" ||
    componentType === "collections"
  ) {
    const CATEGORY_LAYOUTS: LayoutVariant[] = [
      {
        id: "categories-simple-list",
        name: "Simple List",
        icon: React.createElement(List, { className: "w-4 h-4" }),
        componentType,
        defaultData: { layout: "simple" },
      },
      {
        id: "categories-featured-grid",
        name: "Featured Grid",
        icon: React.createElement(LayoutGrid, { className: "w-4 h-4" }),
        componentType,
        defaultData: { layout: "featured" },
      },
      {
        id: "categories-split-layout",
        name: "Split Layout",
        icon: React.createElement(LayoutGrid, { className: "w-4 h-4" }),
        componentType,
        defaultData: { layout: "split" },
      },
      {
        id: "categories-slider",
        name: "Category Slider",
        icon: React.createElement(LayoutGrid, { className: "w-4 h-4" }),
        componentType,
        defaultData: { layout: "slider" },
      },
      {
        id: "categories-shop-by-category",
        name: "Shop by Category",
        icon: React.createElement(LayoutGrid, { className: "w-4 h-4" }),
        componentType,
        defaultData: { layout: "shop_by_category" },
      },
    ];
    return CATEGORY_LAYOUTS;
  }
  return [];
};
