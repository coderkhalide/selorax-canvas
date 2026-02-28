import React, { CSSProperties } from "react";

export type ElementType =
  | "section"
  | "wrapper"
  | "row"
  | "col"
  | "headline"
  | "paragraph"
  | "button"
  | "image"
  | "video"
  | "input"
  | "user-checkout"
  | "icon"
  | "custom"
  | "skeleton";

export interface FunnelElement {
  id: string;
  type: ElementType;
  name: string;
  content?: string; // For text or icon name
  src?: string; // For images/videos
  placeholder?: string; // For inputs
  style: CSSProperties;
  tabletStyle?: CSSProperties; // Tablet overrides (768-1024px)
  mobileStyle?: CSSProperties; // Mobile overrides (<768px)
  className?: string; // Custom CSS class
  children?: FunnelElement[]; // For containers like sections

  // Custom Component Props
  customType?: string; // Key in the registry
  data?: Record<string, any>; // Dynamic data based on schema

  // Section-specific theme
  schemeId?: string; // Override theme for this section
}

export interface ThemeSettings {
  background: string;
  foreground_heading: string;
  foreground: string;
  primary: string;
  primary_hover: string;
  border: string;
  shadow: string;

  // Primary Button
  primary_button_background: string;
  primary_button_text: string;
  primary_button_border: string;
  primary_button_hover_background: string;
  primary_button_hover_text: string;
  primary_button_hover_border: string;

  // Secondary Button
  secondary_button_background: string;
  secondary_button_text: string;
  secondary_button_border: string;
  secondary_button_hover_background: string;
  secondary_button_hover_text: string;
  secondary_button_hover_border: string;

  // Inputs
  input_background: string;
  input_text_color: string;
  input_border_color: string;
  input_hover_background: string;

  // Variants
  variant_background_color: string;
  variant_text_color: string;
  variant_border_color: string;
  variant_hover_background_color: string;
  variant_hover_text_color: string;
  variant_hover_border_color: string;

  // Selected Variants
  selected_variant_background_color: string;
  selected_variant_text_color: string;
  selected_variant_border_color: string;
  selected_variant_hover_background_color: string;
  selected_variant_hover_text_color: string;
  selected_variant_hover_border_color: string;
}

export interface ColorScheme {
  id: string;
  name: string;
  settings: ThemeSettings;
  customColors?: { name: string; value: string }[];
}

export interface ProjectData {
  theme_bulder_version?: number;
  version: number;
  elements: FunnelElement[];
  globalCss: string;
  theme: {
    currentSchemeId: string;
    schemes: Record<string, ColorScheme>;
  };
}

export type ViewMode = "editor" | "preview" | "analytics";

export interface FunnelState {
  elements: FunnelElement[];
  selectedId: string | null;
  history: FunnelElement[][];
  historyIndex: number;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  description: string;
  snapshot: {
    elements: FunnelElement[];
    globalCss: string;
    theme?: {
      currentSchemeId: string;
      schemes: Record<string, ColorScheme>;
    };
  };
}

export interface HistoryState {
  entries: HistoryEntry[];
  currentIndex: number;
}

export type DropPosition = "before" | "after" | "inside";

// Custom Component Schema Types
export type SettingType =
  | "text"
  | "textarea"
  | "select"
  | "number_slider"
  | "color"
  | "icon"
  | "icon_group"
  | "boolean"
  | "array"
  | "array_object"
  | "code";

export interface SettingSchema {
  type: SettingType;
  label: string;
  description?: string;
  default?: any;
  required?: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[]; // For select
  min?: number; // For slider
  max?: number;
  step?: number;
  itemType?: SettingType; // For simple arrays
  itemSchema?: Record<string, SettingSchema>; // For array_object
  defaultItem?: any;
  conditionalDisplay?: { field: string; value: any };
  hiddenName?: boolean; // For icon type: Hide the icon name text
}

export interface CustomComponentDef {
  name: string;
  icon: React.ReactNode;
  category: string;
  component: React.FC<{
    element: FunnelElement;
    onUpdate?: (id: string, updates: Partial<FunnelElement>) => void;
    isPreview?: boolean;
    deviceView?: "desktop" | "tablet" | "mobile";
  }>;
  settings: Record<string, SettingSchema>;
  defaultData: Record<string, any>;
  // Optional variants for the component
  variants?: Array<{
    name: string;
    icon: React.ReactNode;
    defaultData: Record<string, any>;
  }>;
}

// Drag and Drop Validation Rules
export const DND_RULES: Record<string, ElementType[]> = {
  root: ["section", "skeleton"],
  section: [
    "wrapper",
    "row",
    "headline",
    "paragraph",
    "button",
    "image",
    "video",
    "input",
    "icon",
    "custom",
    "skeleton",
    "user-checkout",
  ],
  row: ["col", "skeleton"],
  col: [
    "wrapper",
    "row",
    "headline",
    "paragraph",
    "button",
    "image",
    "video",
    "input",
    "icon",
    "custom",
    "skeleton",
    "user-checkout",
  ],
  wrapper: [
    "wrapper",
    "row",
    "headline",
    "paragraph",
    "button",
    "image",
    "video",
    "input",
    "icon",
    "custom",
    "user-checkout",
  ],
  headline: [],
  paragraph: [],
  button: [],
  image: [],
  video: [],
  input: [],
  icon: [],
  custom: [],
  "user-checkout": [],
};

export const INITIAL_ELEMENTS: FunnelElement[] = [];
