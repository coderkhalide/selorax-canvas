"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  FunnelElement,
  ElementType,
  DropPosition,
  INITIAL_ELEMENTS,
  ProjectData,
  DND_RULES,
  ViewMode,
  HistoryEntry,
  ColorScheme,
  ThemeSettings,
} from "../types";
import { colord } from "colord";
import { CUSTOM_BLOCKS } from "../components/custom-registry";
import { useHistory } from "../hooks/useHistory";
import { setRuntimeApiKey } from "../services/runtimeApiKey";

interface FunnelContextType {
  elements: FunnelElement[];
  setElements: React.Dispatch<React.SetStateAction<FunnelElement[]>>;
  mergeRemoteNode: (nodeId: string, operation: "upsert" | "delete", element?: FunnelElement) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  selectedElement: FunnelElement | null;

  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  deviceView: "desktop" | "tablet" | "mobile";
  setDeviceView: (view: "desktop" | "tablet" | "mobile") => void;

  draggingType: ElementType | null;
  setDraggingType: (type: ElementType | null) => void;

  globalCss: string;
  setGlobalCss: (css: string) => void;

  // Template tracking
  currentTemplateId: string | null;
  setCurrentTemplateId: (id: string | null) => void;
  currentTemplateName: string | null;
  setCurrentTemplateName: (name: string | null) => void;

  enableStreaming: boolean;
  setEnableStreaming: (enable: boolean) => void;

  apiKey: string;
  setApiKey: (key: string) => void;

  aiProvider: "openai" | "gemini";
  setAiProvider: (provider: "openai" | "gemini") => void;
  openaiApiKey: string;
  geminiApiKey: string;

  products: any | null;
  setProducts: (products: any | null) => void;
  selectedProduct: any | null;
  setSelectedProduct: (product: any | null) => void;
  isProductLoading: boolean;
  setIsProductLoading: (loading: boolean) => void;

  // URL/Session Params
  storeId: string | null;
  setStoreId: (id: string | null) => void;
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  domain: string | null;
  setDomain: (domain: string | null) => void;
  slug: string | null;
  setSlug: (slug: string | null) => void;

  // Developer Mode
  isDevMode: boolean;
  setIsDevMode: (mode: boolean) => void;
  isDevAuthenticated: boolean;
  setIsDevAuthenticated: (auth: boolean) => void;
  authenticateDeveloper: () => void;

  // Theme
  currentSchemeId: string;
  schemes: Record<string, ColorScheme>;
  setScheme: (id: string) => void;
  updateScheme: (id: string, updates: Partial<ColorScheme>) => void;
  addScheme: (scheme: ColorScheme, setActive?: boolean) => void;

  // History
  canUndo: boolean;
  canRedo: boolean;
  historyLength: number;
  currentHistoryIndex: number;
  historyEntries: HistoryEntry[];
  storageUsage: number;
  storageSize: string;
  undo: () => void;
  redo: () => void;
  goToHistory: (index: number) => void;
  clearHistory: () => void;

  // Actions
  updateElement: (id: string, updates: Partial<FunnelElement>) => void;
  deleteElement: (id: string) => void;
  duplicateElement: (id: string) => void;
  moveElement: (
    sourceId: string,
    targetId: string,
    position: DropPosition,
  ) => void;
  addElement: (
    type: ElementType,
    targetId: string,
    position: DropPosition,
    variant?: string,
    variantData?: Record<string, any>,
  ) => void;
  addSectionWithComponent: (
    targetSectionId: string,
    componentType: string,
    componentData: any,
  ) => void;
  handleDrop: (
    e: React.DragEvent,
    targetId: string,
    position: DropPosition,
  ) => void;
}

const DEFAULT_SCHEMES: Record<string, ColorScheme> = {
  "scheme-1": {
    id: "scheme-1",
    name: "Classic Light",
    settings: {
      background: "#ffffff",
      foreground_heading: "#000000",
      foreground: "#000000cf",
      primary: "#000000cf",
      primary_hover: "#000000",
      border: "#0000000f",
      shadow: "#000000",
      primary_button_background: "#000000",
      primary_button_text: "#ffffff",
      primary_button_border: "#000000",
      primary_button_hover_background: "#333333",
      primary_button_hover_text: "#ffffff",
      primary_button_hover_border: "#000000",
      secondary_button_background: "rgba(0,0,0,0)",
      secondary_button_text: "#000000",
      secondary_button_border: "#000000",
      secondary_button_hover_background: "#fafafa",
      secondary_button_hover_text: "#333333",
      secondary_button_hover_border: "#333333",
      input_background: "#ffffffc7",
      input_text_color: "#333333",
      input_border_color: "#dfdfdf",
      input_hover_background: "#00000003",
      variant_background_color: "#ffffff",
      variant_text_color: "#000000",
      variant_border_color: "#00000021",
      variant_hover_background_color: "#f5f5f5",
      variant_hover_text_color: "#000000",
      variant_hover_border_color: "#e6e6e6",
      selected_variant_background_color: "#000000",
      selected_variant_text_color: "#ffffff",
      selected_variant_border_color: "#000000",
      selected_variant_hover_background_color: "#1a1a1a",
      selected_variant_hover_text_color: "#ffffff",
      selected_variant_hover_border_color: "#1a1a1a",
    },
  },
  "scheme-2": {
    id: "scheme-2",
    name: "Light Gray",
    settings: {
      background: "#f5f5f5",
      foreground_heading: "#000000",
      foreground: "#333333",
      primary: "#262626",
      primary_hover: "#000000",
      border: "#e5e5e5",
      shadow: "#000000",
      primary_button_background: "#171717",
      primary_button_text: "#ffffff",
      primary_button_border: "#171717",
      primary_button_hover_background: "#262626",
      primary_button_hover_text: "#ffffff",
      primary_button_hover_border: "#262626",
      secondary_button_background: "transparent",
      secondary_button_text: "#171717",
      secondary_button_border: "#d4d4d4",
      secondary_button_hover_background: "#e5e5e5",
      secondary_button_hover_text: "#000000",
      secondary_button_hover_border: "#a3a3a3",
      input_background: "#ffffff",
      input_text_color: "#171717",
      input_border_color: "#d4d4d4",
      input_hover_background: "#fafafa",
      variant_background_color: "#ffffff",
      variant_text_color: "#171717",
      variant_border_color: "#e5e5e5",
      variant_hover_background_color: "#f5f5f5",
      variant_hover_text_color: "#000000",
      variant_hover_border_color: "#d4d4d4",
      selected_variant_background_color: "#171717",
      selected_variant_text_color: "#ffffff",
      selected_variant_border_color: "#171717",
      selected_variant_hover_background_color: "#262626",
      selected_variant_hover_text_color: "#ffffff",
      selected_variant_hover_border_color: "#262626",
    },
  },
  "scheme-3": {
    id: "scheme-3",
    name: "Dark Modern",
    settings: {
      background: "#0f172a",
      foreground_heading: "#f8fafc",
      foreground: "#cbd5e1",
      primary: "#3b82f6",
      primary_hover: "#60a5fa",
      border: "#1e293b",
      shadow: "#000000",
      primary_button_background: "#3b82f6",
      primary_button_text: "#ffffff",
      primary_button_border: "#3b82f6",
      primary_button_hover_background: "#2563eb",
      primary_button_hover_text: "#ffffff",
      primary_button_hover_border: "#2563eb",
      secondary_button_background: "transparent",
      secondary_button_text: "#e2e8f0",
      secondary_button_border: "#334155",
      secondary_button_hover_background: "#1e293b",
      secondary_button_hover_text: "#f8fafc",
      secondary_button_hover_border: "#475569",
      input_background: "#1e293b",
      input_text_color: "#f1f5f9",
      input_border_color: "#334155",
      input_hover_background: "#334155",
      variant_background_color: "#1e293b",
      variant_text_color: "#e2e8f0",
      variant_border_color: "#334155",
      variant_hover_background_color: "#334155",
      variant_hover_text_color: "#f8fafc",
      variant_hover_border_color: "#475569",
      selected_variant_background_color: "#3b82f6",
      selected_variant_text_color: "#ffffff",
      selected_variant_border_color: "#3b82f6",
      selected_variant_hover_background_color: "#2563eb",
      selected_variant_hover_text_color: "#ffffff",
      selected_variant_hover_border_color: "#2563eb",
    },
  },
  "scheme-4": {
    id: "scheme-4",
    name: "Ocean Breeze",
    settings: {
      background: "#f0f9ff",
      foreground_heading: "#0c4a6e",
      foreground: "#334155",
      primary: "#0ea5e9",
      primary_hover: "#0284c7",
      border: "#bae6fd",
      shadow: "#0c4a6e",
      primary_button_background: "#0ea5e9",
      primary_button_text: "#ffffff",
      primary_button_border: "#0ea5e9",
      primary_button_hover_background: "#0284c7",
      primary_button_hover_text: "#ffffff",
      primary_button_hover_border: "#0284c7",
      secondary_button_background: "transparent",
      secondary_button_text: "#0c4a6e",
      secondary_button_border: "#7dd3fc",
      secondary_button_hover_background: "#e0f2fe",
      secondary_button_hover_text: "#075985",
      secondary_button_hover_border: "#38bdf8",
      input_background: "#ffffff",
      input_text_color: "#0c4a6e",
      input_border_color: "#7dd3fc",
      input_hover_background: "#e0f2fe",
      variant_background_color: "#ffffff",
      variant_text_color: "#0c4a6e",
      variant_border_color: "#bae6fd",
      variant_hover_background_color: "#e0f2fe",
      variant_hover_text_color: "#075985",
      variant_hover_border_color: "#7dd3fc",
      selected_variant_background_color: "#0ea5e9",
      selected_variant_text_color: "#ffffff",
      selected_variant_border_color: "#0ea5e9",
      selected_variant_hover_background_color: "#0284c7",
      selected_variant_hover_text_color: "#ffffff",
      selected_variant_hover_border_color: "#0284c7",
    },
  },
  "scheme-5": {
    id: "scheme-5",
    name: "Sunset Glow",
    settings: {
      background: "#fff7ed",
      foreground_heading: "#7c2d12",
      foreground: "#431407",
      primary: "#ea580c",
      primary_hover: "#c2410c",
      border: "#fed7aa",
      shadow: "#7c2d12",
      primary_button_background: "#ea580c",
      primary_button_text: "#ffffff",
      primary_button_border: "#ea580c",
      primary_button_hover_background: "#c2410c",
      primary_button_hover_text: "#ffffff",
      primary_button_hover_border: "#c2410c",
      secondary_button_background: "transparent",
      secondary_button_text: "#9a3412",
      secondary_button_border: "#fdba74",
      secondary_button_hover_background: "#ffedd5",
      secondary_button_hover_text: "#7c2d12",
      secondary_button_hover_border: "#fb923c",
      input_background: "#ffffff",
      input_text_color: "#7c2d12",
      input_border_color: "#fdba74",
      input_hover_background: "#ffedd5",
      variant_background_color: "#ffffff",
      variant_text_color: "#7c2d12",
      variant_border_color: "#fed7aa",
      variant_hover_background_color: "#ffedd5",
      variant_hover_text_color: "#431407",
      variant_hover_border_color: "#fdba74",
      selected_variant_background_color: "#ea580c",
      selected_variant_text_color: "#ffffff",
      selected_variant_border_color: "#ea580c",
      selected_variant_hover_background_color: "#c2410c",
      selected_variant_hover_text_color: "#ffffff",
      selected_variant_hover_border_color: "#c2410c",
    },
  },
  "scheme-6": {
    id: "scheme-6",
    name: "Forest",
    settings: {
      background: "#f0fdf4",
      foreground_heading: "#14532d",
      foreground: "#1a2e05",
      primary: "#16a34a",
      primary_hover: "#15803d",
      border: "#bbf7d0",
      shadow: "#14532d",
      primary_button_background: "#16a34a",
      primary_button_text: "#ffffff",
      primary_button_border: "#16a34a",
      primary_button_hover_background: "#15803d",
      primary_button_hover_text: "#ffffff",
      primary_button_hover_border: "#15803d",
      secondary_button_background: "transparent",
      secondary_button_text: "#166534",
      secondary_button_border: "#86efac",
      secondary_button_hover_background: "#dcfce7",
      secondary_button_hover_text: "#14532d",
      secondary_button_hover_border: "#4ade80",
      input_background: "#ffffff",
      input_text_color: "#14532d",
      input_border_color: "#86efac",
      input_hover_background: "#dcfce7",
      variant_background_color: "#ffffff",
      variant_text_color: "#14532d",
      variant_border_color: "#bbf7d0",
      variant_hover_background_color: "#dcfce7",
      variant_hover_text_color: "#14532d",
      variant_hover_border_color: "#86efac",
      selected_variant_background_color: "#16a34a",
      selected_variant_text_color: "#ffffff",
      selected_variant_border_color: "#16a34a",
      selected_variant_hover_background_color: "#15803d",
      selected_variant_hover_text_color: "#ffffff",
      selected_variant_hover_border_color: "#15803d",
    },
  },
};

// ─── Remote merge helpers ──────────────────────────────────────────────────

function removeElementById(elements: FunnelElement[], id: string): FunnelElement[] {
  return elements
    .filter((el) => el.id !== id)
    .map((el) =>
      el.children
        ? { ...el, children: removeElementById(el.children, id) }
        : el
    );
}

function findElementById(elements: FunnelElement[], id: string): FunnelElement | null {
  for (const el of elements) {
    if (el.id === id) return el;
    if (el.children) {
      const found = findElementById(el.children, id);
      if (found) return found;
    }
  }
  return null;
}

function updateElementById(
  elements: FunnelElement[],
  id: string,
  updated: Partial<FunnelElement>
): FunnelElement[] {
  return elements.map((el) => {
    if (el.id === id) return { ...el, ...updated };
    if (el.children) {
      return { ...el, children: updateElementById(el.children, id, updated) };
    }
    return el;
  });
}

// ──────────────────────────────────────────────────────────────────────────────

const FunnelContext = createContext<FunnelContextType | undefined>(undefined);

export const useFunnel = () => {
  const context = useContext(FunnelContext);
  if (!context)
    throw new Error("useFunnel must be used within a FunnelProvider");
  return context;
};

export const FunnelProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [elements, setElements] = useState<FunnelElement[]>(INITIAL_ELEMENTS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("editor");
  const [deviceView, setDeviceView] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [draggingType, setDraggingType] = useState<ElementType | null>(null);
  const [globalCss, setGlobalCss] = useState<string>("");

  // Template tracking
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(
    null,
  );
  const [currentTemplateName, setCurrentTemplateName] = useState<string | null>(
    null,
  );

  const [enableStreaming, setEnableStreaming] = useState<boolean>(true);
  const [aiProvider, setAiProviderState] = useState<"openai" | "gemini">(
    "gemini",
  );

  const [openaiApiKey, setOpenaiApiKey] = useState<string>("");
  const [geminiApiKey, setGeminiApiKey] = useState<string>("");
  const [products, setProducts] = useState<any | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isProductLoading, setIsProductLoading] = useState(false);

  // URL/Session Params
  const [storeId, setStoreId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [domain, setDomain] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);

  // Developer Mode
  const [isDevMode, setIsDevMode] = useState(false);
  const [isDevAuthenticated, setIsDevAuthenticated] = useState(false);

  const authenticateDeveloper = useCallback(() => {
    setIsDevAuthenticated(true);
    setIsDevMode(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("dev_authenticated", "true");
    }
  }, []);

  // Initialize Developer Mode from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedAuth = localStorage.getItem("dev_authenticated");
      if (storedAuth === "true") {
        setIsDevAuthenticated(true);
        // Optional: Auto-enable dev mode if authenticated?
        // For now, let's keep it consistent with the user's flow:
        // If they were authenticated, they probably want dev mode available.
        // But the toggle state itself might be separate.
        // Let's check if there's a stored preference for the toggle too, or just default to true if auth exists.
        setIsDevMode(true);
      }
    }
  }, []);

  const setAiProvider = useCallback(
    (provider: "openai" | "gemini") => {
      console.log("SWITCHING AI PROVIDER", { from: aiProvider, to: provider });
      setAiProviderState(provider);
      // Sync the stored API key for the new provider to the runtime module
      const keyForNewProvider =
        provider === "openai" ? openaiApiKey : geminiApiKey;
      if (keyForNewProvider) {
        setRuntimeApiKey(keyForNewProvider, provider);
      }
    },
    [aiProvider, openaiApiKey, geminiApiKey],
  );

  const setApiKey = useCallback(
    (key: string) => {
      if (aiProvider === "openai") {
        setOpenaiApiKey(key);
      } else {
        setGeminiApiKey(key);
      }
      setRuntimeApiKey(key, aiProvider);
    },
    [aiProvider],
  );

  const apiKey = aiProvider === "openai" ? openaiApiKey : geminiApiKey;

  // Theme State
  const [currentSchemeId, setSchemeIdState] = useState<string>("scheme-1");
  const [schemes, setSchemes] =
    useState<Record<string, ColorScheme>>(DEFAULT_SCHEMES);

  // History management
  const history = useHistory({
    elements,
    globalCss,
    theme: { currentSchemeId, schemes },
  });
  const updateDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const isRestoringRef = useRef(false);

  // Apply CSS Variables when theme changes
  useEffect(() => {
    const scheme = schemes[currentSchemeId];
    if (!scheme) return;

    const root = document.documentElement;
    Object.entries(scheme.settings).forEach(([key, value]) => {
      // standard keys like "background" -> "--color-background"
      // keys with underscores like "primary_button_text" -> "--color-primary-button-text"
      const cssVarName = `--color-${key.replace(/_/g, "-")}`;
      root.style.setProperty(cssVarName, value as string);
    });
  }, [currentSchemeId, schemes]);

  const setScheme = useCallback(
    (id: string) => {
      if (schemes[id]) {
        setSchemeIdState(id);
        if (!isRestoringRef.current) {
          history.pushHistory(
            {
              elements,
              globalCss,
              theme: { currentSchemeId: id, schemes },
            },
            `Changed theme to ${schemes[id].name}`,
          );
        }
      }
    },
    [schemes, elements, globalCss, history],
  );

  const updateScheme = useCallback(
    (id: string, updates: Partial<ColorScheme>) => {
      setSchemes((prev) => {
        const next = { ...prev, [id]: { ...prev[id], ...updates } };

        if (!isRestoringRef.current) {
          // Debounce this if needed, but for now direct push
          history.pushHistory(
            {
              elements,
              globalCss,
              theme: { currentSchemeId, schemes: next },
            },
            "Updated theme settings",
          );
        }
        return next;
      });
    },
    [elements, globalCss, currentSchemeId, history],
  );

  const addScheme = useCallback(
    (scheme: ColorScheme, setActive: boolean = true) => {
      setSchemes((prev) => {
        const next = { ...prev, [scheme.id]: scheme };
        if (!isRestoringRef.current) {
          history.pushHistory(
            {
              elements,
              globalCss,
              theme: {
                currentSchemeId: setActive ? scheme.id : currentSchemeId,
                schemes: next,
              },
            },
            `Added theme scheme ${scheme.name}`,
          );
        }
        if (setActive) setSchemeIdState(scheme.id);
        return next;
      });
    },
    [elements, globalCss, currentSchemeId, history],
  );

  // --- HELPERS ---
  const findElement = useCallback(
    (id: string, list: FunnelElement[]): FunnelElement | null => {
      for (const el of list) {
        if (el.id === id) return el;
        if (el.children) {
          const found = findElement(id, el.children);
          if (found) return found;
        }
      }
      return null;
    },
    [],
  );

  const selectedElement = selectedId ? findElement(selectedId, elements) : null;

  // --- ACTIONS ---

  const updateElement = useCallback(
    (id: string, updates: Partial<FunnelElement>) => {
      setElements((prev) => {
        const deepClone = JSON.parse(JSON.stringify(prev));
        const updateRecursive = (list: FunnelElement[]): boolean => {
          for (let i = 0; i < list.length; i++) {
            if (list[i].id === id) {
              const existing = list[i];
              const merged = { ...existing, ...updates } as FunnelElement;
              if (updates.data) {
                merged.data = {
                  ...(existing.data || {}),
                  ...(updates.data || {}),
                } as any;
              }
              list[i] = merged;
              return true;
            }
            if (list[i].children && updateRecursive(list[i].children!))
              return true;
          }
          return false;
        };
        updateRecursive(deepClone);

        // Debounced history update for element changes
        if (!isRestoringRef.current) {
          if (updateDebounceRef.current)
            clearTimeout(updateDebounceRef.current);
          updateDebounceRef.current = setTimeout(() => {
            history.pushHistory(
              {
                elements: deepClone,
                globalCss,
                theme: { currentSchemeId, schemes },
              },
              `Updated element`,
            );
          }, 500);
        }

        return deepClone;
      });
    },
    [history, globalCss, currentSchemeId, schemes],
  );

  const deleteElement = useCallback(
    (id: string) => {
      setElements((prev) => {
        const deepClone = JSON.parse(JSON.stringify(prev));
        const deleteRecursive = (list: FunnelElement[]): FunnelElement[] => {
          return list.filter((el) => {
            if (el.id === id) return false;
            if (el.children) el.children = deleteRecursive(el.children);
            return true;
          });
        };

        // Immediate history for structural changes
        if (!isRestoringRef.current) {
          history.pushHistory(
            {
              elements: deepClone,
              globalCss,
              theme: { currentSchemeId, schemes },
            },
            "Deleted element",
          );
        }

        return deleteRecursive(deepClone);
      });
      if (selectedId === id) setSelectedId(null);
    },
    [selectedId, history, globalCss],
  );

  const duplicateElement = useCallback(
    (id: string) => {
      setElements((prev) => {
        const deepClone = JSON.parse(JSON.stringify(prev));
        const regenerateIds = (el: FunnelElement): FunnelElement => {
          const newId = `el-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`;
          const newEl = { ...el, id: newId };
          if (newEl.children)
            newEl.children = newEl.children.map(regenerateIds);
          return newEl;
        };
        const getSmartName = (originalName: string): string => {
          const match = originalName.match(/^(.*?)(\d+)$/);
          if (match) return `${match[1]}${parseInt(match[2], 10) + 1}`;
          return `${originalName} (Copy)`;
        };
        const insertDuplicate = (list: FunnelElement[]): boolean => {
          const index = list.findIndex((el) => el.id === id);
          if (index !== -1) {
            const original = list[index];
            const duplicate = regenerateIds(
              JSON.parse(JSON.stringify(original)),
            );
            duplicate.name = getSmartName(original.name);
            list.splice(index + 1, 0, duplicate);
            return true;
          }
          for (const el of list) {
            if (el.children && insertDuplicate(el.children)) return true;
          }
          return false;
        };
        insertDuplicate(deepClone);

        // Immediate history for structural changes
        if (!isRestoringRef.current) {
          history.pushHistory(
            {
              elements: deepClone,
              globalCss,
              theme: { currentSchemeId, schemes },
            },
            "Duplicated element",
          );
        }

        return deepClone;
      });
    },
    [history, globalCss],
  );

  const moveElement = useCallback(
    (sourceId: string, targetId: string, position: DropPosition) => {
      if (sourceId === targetId) return;

      setElements((prev) => {
        const deepClone = JSON.parse(JSON.stringify(prev));

        let sourceEl: FunnelElement | null = null;
        const removeSource = (list: FunnelElement[]): FunnelElement[] => {
          const filtered = [];
          for (const el of list) {
            if (el.id === sourceId) {
              sourceEl = el;
              continue;
            }
            if (el.children) el.children = removeSource(el.children);
            filtered.push(el);
          }
          return filtered;
        };

        const tempRoot = removeSource(deepClone);
        if (!sourceEl) return prev;

        let targetParentType = "root";
        if (targetId !== "root") {
          const findTargetParent = (
            list: FunnelElement[],
            p: FunnelElement | null = null,
          ): FunnelElement | null => {
            for (const el of list) {
              if (el.id === targetId) return p;
              if (el.children) {
                const res = findTargetParent(el.children, el);
                if (res !== undefined) return res;
              }
            }
            return undefined;
          };
          const targetEl = findElement(targetId, tempRoot);
          if (targetEl && position === "inside") {
            targetParentType = targetEl.type;
          } else {
            const res = findTargetParent(tempRoot);
            if (res) targetParentType = res.type;
          }
        }

        if (
          (sourceEl as FunnelElement).type === "col" &&
          targetParentType !== "row"
        ) {
          (sourceEl as FunnelElement).type = "wrapper";
          (sourceEl as FunnelElement).name = "Wrapper (ex-Col)";
          (sourceEl as FunnelElement).style.flex = undefined;
        } else if (
          (sourceEl as FunnelElement).type === "wrapper" &&
          targetParentType === "row"
        ) {
          (sourceEl as FunnelElement).type = "col";
          (sourceEl as FunnelElement).name = "Column";
          (sourceEl as FunnelElement).style = {
            ...(sourceEl as FunnelElement).style,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: "50px",
          };
        }

        const allowedChildren = DND_RULES[targetParentType] || [];
        if (!allowedChildren.includes((sourceEl as FunnelElement).type)) {
          return prev;
        }

        const insertAtTarget = (list: FunnelElement[]): boolean => {
          const index = list.findIndex((el) => el.id === targetId);
          if (index !== -1) {
            if (position === "before") list.splice(index, 0, sourceEl!);
            else if (position === "after") list.splice(index + 1, 0, sourceEl!);
            else if (position === "inside") {
              const target = list[index];
              if (!target.children) target.children = [];
              target.children.push(sourceEl!);
            }
            return true;
          }
          for (const el of list) {
            if (el.id === targetId && position === "inside") {
              if (!el.children) el.children = [];
              el.children.push(sourceEl!);
              return true;
            }
            if (el.children && insertAtTarget(el.children)) return true;
          }
          return false;
        };

        if (targetId === "root") tempRoot.push(sourceEl!);
        else insertAtTarget(tempRoot);

        // Immediate history for structural changes
        if (!isRestoringRef.current) {
          history.pushHistory(
            {
              elements: tempRoot,
              globalCss,
              theme: { currentSchemeId, schemes },
            },
            "Moved element",
          );
        }

        return tempRoot;
      });
    },
    [findElement, history, globalCss],
  );

  const addElement = useCallback(
    (
      type: ElementType,
      targetId: string,
      position: DropPosition,
      variant?: string,
      variantData?: Record<string, any>,
    ) => {
      setElements((prev) => {
        const deepClone = JSON.parse(JSON.stringify(prev));

        const findInClone = (
          id: string,
          list: FunnelElement[],
        ): FunnelElement | null => {
          for (const el of list) {
            if (el.id === id) return el;
            if (el.children) {
              const f = findInClone(id, el.children);
              if (f) return f;
            }
          }
          return null;
        };
        const findParentInClone = (
          id: string,
          list: FunnelElement[],
          p: FunnelElement | null = null,
        ): FunnelElement | null => {
          for (const el of list) {
            if (el.id === id) return p;
            if (el.children) {
              const f = findParentInClone(id, el.children, el);
              if (f) return f;
            }
          }
          return null;
        };

        let targetType = "root";
        if (targetId !== "root") {
          const targetEl = findInClone(targetId, deepClone);
          if (targetEl) {
            if (position === "inside") targetType = targetEl.type;
            else {
              const p = findParentInClone(targetId, deepClone);
              targetType = p ? p.type : "root";
            }
          }
        }

        const allowed = DND_RULES[targetType] || [];
        let autoWrapSection = false;
        if (!allowed.includes(type)) {
          if (targetType === "root" && type !== "section") {
            const sectionAllowed = DND_RULES["section"] || [];
            if (sectionAllowed.includes(type)) {
              autoWrapSection = true;
            } else {
              return prev;
            }
          } else {
            const isColToWrapper = type === "col" && targetType !== "row";
            const isWrapperToCol = type === "wrapper" && targetType === "row";
            if (!isColToWrapper && !isWrapperToCol) return prev;
          }
        }

        const generateId = () =>
          `el-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const createNewElement = (
          t: ElementType,
          v?: string,
        ): FunnelElement => {
          const base: FunnelElement = {
            id: generateId(),
            type: t,
            name: t.charAt(0).toUpperCase() + t.slice(1),
            style: { width: "100%" },
            children: ["section", "wrapper", "row", "col"].includes(t)
              ? []
              : undefined,
          };
          if (t === "headline") {
            base.content = "New Headline";
            base.style = {
              fontSize: "2rem",
              fontWeight: "bold",
              color: "var(--color-foreground-heading)",
            };
          }
          if (t === "paragraph") {
            base.content = "Lorem ipsum dolor sit amet.";
            base.style = { ...base.style, color: "var(--color-foreground)" };
          }
          if (t === "icon") {
            base.content = "Star";
            base.style = { ...base.style, color: "var(--color-primary)" };
            base.data = { size: 32 };
          }
          if (t === "button") {
            base.content = "Click Me";
            base.style = {
              padding: "10px 20px",
              backgroundColor: "var(--color-primary-button-background)",
              color: "var(--color-primary-button-text)",
              border: `1px solid var(--color-primary-button-border)`,
              borderRadius: "4px",
            };
          }

          if (t === "video") {
            base.name = "Video";
            base.style = {
              width: "100%",
              height: "auto",
              aspectRatio: "16/9",
            };
            base.data = {
              videoUrl: "",
              showControls: true,
            };
          }
          if (t === "image") {
            base.name = "Image";
            base.src = ""; // Initialize with empty src
            base.content = ""; // Alt text
            base.style = {
              width: "100%",
              height: "auto",
              maxWidth: "100%",
              objectFit: "cover" as const,
              display: "block",
            };
            base.data = {
              alt: "Image",
              loading: "lazy",
            };
          }
          if (t === "user-checkout") {
            base.content = "User Checkout Form";
            base.style = {
              width: "100%",
              padding: "20px",
              backgroundColor: "transparent",
              color: "var(--color-primary)",
              fontWeight: "bold",
              fontSize: "1rem",
              textAlign: "center",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            };
            base.data = {
              value: "user-checkout",
              role: "",
            };
          }
          if (t === "section")
            base.style = {
              padding: "3rem 1rem",
              minHeight: "150px",
              backgroundColor: "var(--color-background)",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            };
          if (t === "wrapper")
            base.style = {
              padding: "1rem",
            };
          if (t === "row") {
            base.style = {
              display: "flex",
              width: "100%",
              gap: "1rem",
            };
            if (v === "2-col") {
              base.name = "2 Cols";
              base.children = [
                createNewElement("col"),
                createNewElement("col"),
              ];
            }
            if (v === "3-col") {
              base.name = "3 Cols";
              base.children = [
                createNewElement("col"),
                createNewElement("col"),
                createNewElement("col"),
              ];
            }
          }
          if (t === "col")
            base.style = {
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              minHeight: "50px",
            };

          if (t === "custom" && v) {
            const def = CUSTOM_BLOCKS[v];
            if (def) {
              base.name = def.name;
              base.customType = v;
              // Start with default data from the component definition
              base.data = JSON.parse(JSON.stringify(def.defaultData));

              // If variantData is provided, merge it with the default data
              // This allows variant-specific overrides while keeping other defaults
              if (variantData) {
                base.data = { ...base.data, ...variantData };
              }

              base.style = { width: "100%", padding: "10px" };
            }
          }

          if (t === "col" && targetType !== "row") {
            base.type = "wrapper";
            base.name = "Wrapper";
          } else if (t === "wrapper" && targetType === "row") {
            base.type = "col";
            base.name = "Column";
            base.style = {
              ...base.style,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: "50px",
            };
          }

          return base;
        };

        let newElement = createNewElement(type, variant);

        if (autoWrapSection) {
          const section = createNewElement("section");
          section.children = [newElement];
          newElement = section;
        }

        if (targetId === "root") {
          deepClone.push(newElement);

          // Immediate history for structural changes
          if (!isRestoringRef.current) {
            history.pushHistory(
              {
                elements: deepClone,
                globalCss,
                theme: { currentSchemeId, schemes },
              },
              "Added element",
            );
          }

          return deepClone;
        }
        const insertRecursive = (list: FunnelElement[]): boolean => {
          const index = list.findIndex((el) => el.id === targetId);
          if (index !== -1 && position !== "inside") {
            list.splice(
              position === "before" ? index : index + 1,
              0,
              newElement,
            );
            return true;
          }
          for (const el of list) {
            if (el.id === targetId && position === "inside") {
              if (!el.children) el.children = [];
              el.children.push(newElement);
              return true;
            }
            if (el.children && insertRecursive(el.children)) return true;
          }
          return false;
        };
        insertRecursive(deepClone);

        // Immediate history for structural changes
        if (!isRestoringRef.current) {
          history.pushHistory(
            {
              elements: deepClone,
              globalCss,
              theme: { currentSchemeId, schemes },
            },
            "Added element",
          );
        }

        // Auto-select first column when adding 2/3 Columns row
        if (
          type === "row" &&
          (variant === "2-col" || variant === "3-col") &&
          newElement.children &&
          newElement.children[0]
        ) {
          setSelectedId(newElement.children[0].id);
        }
        return deepClone;
      });
    },
    [history, globalCss],
  );

  const addSectionWithComponent = useCallback(
    (targetSectionId: string, componentType: string, componentData: any) => {
      setElements((prev) => {
        const deepClone = JSON.parse(JSON.stringify(prev));

        const generateId = () =>
          `el-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Create new Section
        const newSection: FunnelElement = {
          id: generateId(),
          type: "section",
          name: "Section",
          style: {
            padding: "3rem 1rem",
            minHeight: "150px",
            backgroundColor: "var(--color-background)",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          },
          children: [],
        };

        // Create new Component
        const newComponent: FunnelElement = {
          id: generateId(),
          type: "custom",
          name: "Custom Component",
          style: { width: "100%" },
          customType: componentType,
          data: componentData,
        };

        newSection.children = [newComponent];

        // Find target section index in root elements (assuming sections are at root)
        const idx = deepClone.findIndex(
          (el: FunnelElement) => el.id === targetSectionId,
        );
        if (idx !== -1) {
          deepClone.splice(idx + 1, 0, newSection);
        } else {
          deepClone.push(newSection);
        }

        if (!isRestoringRef.current) {
          history.pushHistory(
            {
              elements: deepClone,
              globalCss,
              theme: { currentSchemeId, schemes },
            },
            "Added section with component",
          );
        }

        return deepClone;
      });
    },
    [history, globalCss, currentSchemeId, schemes],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string, position: DropPosition) => {
      const dragId = e.dataTransfer.getData("dragId");
      setDraggingType(null);
      if (dragId) {
        moveElement(dragId, targetId, position);
        return;
      }

      const type = e.dataTransfer.getData("elementType") as ElementType;
      const preset = e.dataTransfer.getData("layoutPreset");
      const variantDataStr = e.dataTransfer.getData("variantData");

      // Parse variant data if it exists
      let variantData = null;
      if (variantDataStr) {
        try {
          variantData = JSON.parse(variantDataStr);
        } catch (e) {
          console.error("Failed to parse variantData:", e);
        }
      }

      if (type) addElement(type, targetId, position, preset, variantData);
    },
    [moveElement, addElement],
  );

  // History actions that restore state
  const handleUndo = useCallback(() => {
    const snapshot = history.undo();
    if (snapshot) {
      isRestoringRef.current = true;
      setElements(snapshot.elements);
      setGlobalCss(snapshot.globalCss);
      if (snapshot.theme) {
        setSchemeIdState(snapshot.theme.currentSchemeId);
        setSchemes(snapshot.theme.schemes);
      }
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 0);
    }
  }, [history]);

  const handleRedo = useCallback(() => {
    const snapshot = history.redo();
    if (snapshot) {
      isRestoringRef.current = true;
      setElements(snapshot.elements);
      setGlobalCss(snapshot.globalCss);
      if (snapshot.theme) {
        setSchemeIdState(snapshot.theme.currentSchemeId);
        setSchemes(snapshot.theme.schemes);
      }
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 0);
    }
  }, [history]);

  const handleGoToHistory = useCallback(
    (index: number) => {
      const snapshot = history.goToHistory(index);
      if (snapshot) {
        isRestoringRef.current = true;
        setElements(snapshot.elements);
        setGlobalCss(snapshot.globalCss);
        if (snapshot.theme) {
          setSchemeIdState(snapshot.theme.currentSchemeId);
          setSchemes(snapshot.theme.schemes);
        }
        setTimeout(() => {
          isRestoringRef.current = false;
        }, 0);
      }
    },
    [history],
  );

  // Remote merge: apply STDB changes from AI / other users without triggering history
  const mergeRemoteNode = useCallback(
    (nodeId: string, operation: "upsert" | "delete", element?: FunnelElement) => {
      if (operation === "delete") {
        setElements((prev) => removeElementById(prev, nodeId));
        return;
      }
      if (operation === "upsert" && element) {
        setElements((prev) => {
          const exists = findElementById(prev, nodeId);
          if (exists) {
            return updateElementById(prev, nodeId, element);
          }
          // New remote element — append to root (tree re-sorts on next full load)
          return [...prev, element];
        });
      }
    },
    []
  );

  return (
    <FunnelContext.Provider
      value={{
        elements,
        setElements,
        mergeRemoteNode,
        selectedId,
        setSelectedId,
        selectedElement,
        viewMode,
        setViewMode,
        deviceView,
        setDeviceView,
        draggingType,
        setDraggingType,
        globalCss,
        setGlobalCss,
        currentTemplateId,
        setCurrentTemplateId,
        currentTemplateName,
        setCurrentTemplateName,
        enableStreaming,
        setEnableStreaming,
        apiKey,
        setApiKey,
        aiProvider,
        setAiProvider,
        openaiApiKey,
        geminiApiKey,
        products,
        setProducts,
        selectedProduct,
        setSelectedProduct,
        isProductLoading,
        setIsProductLoading,
        // URL/Session Params
        storeId,
        setStoreId,
        accessToken,
        setAccessToken,
        domain,
        setDomain,
        slug,
        setSlug,
        // Developer Mode
        isDevMode,
        setIsDevMode,
        isDevAuthenticated,
        setIsDevAuthenticated,
        authenticateDeveloper,
        // Theme
        currentSchemeId,
        schemes,
        setScheme,
        updateScheme,
        addScheme,
        canUndo: history.canUndo,
        canRedo: history.canRedo,
        historyLength: history.historyLength,
        currentHistoryIndex: history.currentHistoryIndex,
        historyEntries: history.historyEntries,
        storageUsage: history.storageUsage,
        storageSize: history.storageSize,
        undo: handleUndo,
        redo: handleRedo,
        goToHistory: handleGoToHistory,
        clearHistory: history.clearHistory,
        updateElement,
        deleteElement,
        duplicateElement,
        moveElement,
        addElement,
        addSectionWithComponent,
        handleDrop,
      }}
    >
      {children}
    </FunnelContext.Provider>
  );
};
