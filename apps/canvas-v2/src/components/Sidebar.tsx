import React, { useState } from "react";
import {
  Type,
  Image,
  Square,
  Layout,
  Video,
  MousePointerClick,
  AlignLeft,
  Box,
  Columns,
  Grid,
  CreditCard,
  Star,
  Blocks,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Package,
} from "lucide-react";
import { ElementType } from "../types";
import { CUSTOM_BLOCKS } from "./custom-registry";
import { useFunnel } from "../context/FunnelContext";
import { ProductSelector } from "./ProductSelector";
import { LandingPageSelector } from "./LandingPageSelector";
import { ComponentBrowser } from "./ComponentBrowser";

const DraggableItem: React.FC<{
  type: ElementType;
  label: string;
  icon: React.ReactNode;
  variant?: string;
  variantData?: Record<string, any>;
}> = ({ type, label, icon, variant, variantData }) => {
  const { setDraggingType } = useFunnel();

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("elementType", type);
    if (variant) {
      e.dataTransfer.setData("layoutPreset", variant);
    }
    if (variantData) {
      e.dataTransfer.setData("variantData", JSON.stringify(variantData));
    }

    setDraggingType(type);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={() => setDraggingType(null)}
      className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg cursor-grab hover:bg-gray-200 transition-colors border border-gray-200 hover:border-blue-500 group"
    >
      <div className="text-gray-400 group-hover:text-blue-400">{icon}</div>
      <span className="text-sm font-medium text-gray-900">{label}</span>
    </div>
  );
};

const VariantSelector: React.FC<{
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  isSelected?: boolean;
  variantData?: any;
}> = ({ label, icon, onSelect, isSelected, variantData }) => {
  const lineColor = variantData?.lineColor;
  const dotColor = variantData?.dotColor;

  return (
    <button
      onClick={onSelect}
      className={`flex items-center gap-3 p-2.5 rounded-md transition-all duration-200 border text-left w-full ${
        isSelected
          ? "bg-blue-50 border-blue-500 text-blue-900 shadow-lg ring-2 ring-blue-500/30"
          : "bg-gray-100 border-gray-200 hover:bg-gray-200 hover:border-gray-300 text-gray-700"
      }`}
    >
      {/* Icon with variant color */}
      <div
        className="flex-shrink-0 transition-all duration-200"
        style={{ color: dotColor || lineColor || "#9ca3af" }}
      >
        {icon}
      </div>

      {/* Label */}
      <span
        className={`text-sm font-medium flex-1 ${
          isSelected ? "font-semibold" : ""
        }`}
      >
        {label}
      </span>

      {/* Color indicator dots */}
      <div className="flex gap-1">
        {lineColor && (
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 transition-all duration-200 ${
              isSelected ? "scale-125" : ""
            }`}
            style={{ backgroundColor: lineColor }}
          />
        )}
        {dotColor && dotColor !== lineColor && (
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 transition-all duration-200 ${
              isSelected ? "scale-125" : ""
            }`}
            style={{ backgroundColor: dotColor }}
          />
        )}
      </div>

      {/* Selected checkmark */}
      {isSelected && (
        <svg
          className="w-4 h-4 text-blue-400 flex-shrink-0"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M5 13l4 4L19 7"></path>
        </svg>
      )}
    </button>
  );
};

const ComponentWithVariants: React.FC<{
  componentKey: string;
  def: any;
}> = ({ componentKey, def }) => {
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    setDraggingType,
    addElement,
    selectedElement,
    selectedId,
    updateElement,
  } = useFunnel();

  if (!def.variants || def.variants.length === 0) {
    // No variants, just show as regular draggable
    return (
      <DraggableItem
        type="custom"
        variant={componentKey}
        label={def.name}
        icon={def.icon}
      />
    );
  }

  // Sync selected variant index with canvas selected element
  React.useEffect(() => {
    if (selectedElement && selectedElement.customType === componentKey) {
      // Find which variant matches the current element's layout
      const currentLayout = selectedElement.data?.layout;
      if (currentLayout && def.variants) {
        const matchingIndex = def.variants.findIndex(
          (v: any) => v.defaultData?.layout === currentLayout,
        );
        if (matchingIndex !== -1 && matchingIndex !== selectedVariantIndex) {
          setSelectedVariantIndex(matchingIndex);
        }
      }
    }
  }, [selectedElement, componentKey, def.variants, selectedVariantIndex]);

  const selectedVariant = def.variants[selectedVariantIndex];

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("elementType", "custom");
    e.dataTransfer.setData("layoutPreset", componentKey);
    e.dataTransfer.setData(
      "variantData",
      JSON.stringify(selectedVariant.defaultData),
    );
    setDraggingType("custom");
  };

  const handleVariantSelect = (index: number) => {
    setSelectedVariantIndex(index);

    const variant = def.variants[index];

    // Check if there's a selected element of this component type
    if (
      selectedElement &&
      selectedElement.customType === componentKey &&
      selectedId
    ) {
      // Update the existing selected element's data with new variant
      updateElement(selectedId, {
        data: { ...selectedElement.data, ...variant.defaultData },
      });
    } else {
      // No element selected, add new one to canvas
      addElement("custom", "root", "inside", componentKey, variant.defaultData);
    }
  };

  return (
    <div className="space-y-1">
      {/* Main draggable component */}
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={() => setDraggingType(null)}
        className="flex items-center gap-2 p-2.5 bg-gray-100 rounded-lg cursor-grab hover:bg-gray-200 transition-colors border border-gray-200 hover:border-blue-500 group"
      >
        {/* Show selected variant icon with color */}
        <div
          className="flex-shrink-0 transition-colors group-hover:text-blue-400"
          style={{
            color:
              selectedVariant?.defaultData?.dotColor ||
              selectedVariant?.defaultData?.lineColor ||
              "#9ca3af",
          }}
        >
          {selectedVariant?.icon || def.icon}
        </div>

        <span className="text-sm font-medium text-gray-900 flex-1">
          {def.name}
        </span>
      </div>
    </div>
  );
};

interface SidebarProps {
  tenantId?: string;
}

type SidebarTab = "elements" | "components";

export const Sidebar: React.FC<SidebarProps> = ({ tenantId }) => {
  const { isDevMode, isDevAuthenticated } = useFunnel();
  const [activeTab, setActiveTab] = useState<SidebarTab>("elements");

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab("elements")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${
            activeTab === "elements"
              ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/40"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          <Layout className="w-3.5 h-3.5" />
          Elements
        </button>
        <button
          onClick={() => setActiveTab("components")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${
            activeTab === "components"
              ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/40"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          Components
        </button>
      </div>

      {/* Elements tab */}
      {activeTab === "elements" && (
        <div className="p-4 flex flex-col gap-3 overflow-y-auto flex-1">
          <ProductSelector />
          {isDevMode && isDevAuthenticated && <LandingPageSelector />}
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Layout
          </div>
          <DraggableItem
            type="section"
            label="Section"
            icon={<Square className="w-4 h-4" />}
          />
          <DraggableItem
            type="wrapper"
            label="Wrapper (Box)"
            icon={<Box className="w-4 h-4" />}
          />

          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 mt-4">
            Grid & Flex
          </div>

          <DraggableItem
            type="row"
            label="2 Columns"
            variant="2-col"
            icon={<Columns className="w-4 h-4" />}
          />
          <DraggableItem
            type="row"
            label="3 Columns"
            variant="3-col"
            icon={<Grid className="w-4 h-4" />}
          />

          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 mt-4">
            Basic
          </div>
          <DraggableItem
            type="headline"
            label="Headline"
            icon={<Type className="w-4 h-4 font-bold" />}
          />
          <DraggableItem
            type="paragraph"
            label="Paragraph"
            icon={<AlignLeft className="w-4 h-4" />}
          />
          <DraggableItem
            type="button"
            label="Button"
            icon={<MousePointerClick className="w-4 h-4" />}
          />
          <DraggableItem
            type="icon"
            label="Icon"
            icon={<Star className="w-4 h-4" />}
          />

          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 mt-4">
            Media & Forms
          </div>
          <DraggableItem
            type="image"
            label="Image"
            icon={<Image className="w-4 h-4" />}
          />
          <DraggableItem
            type="video"
            label="Video"
            icon={<Video className="w-4 h-4" />}
          />
          <DraggableItem
            type="input"
            label="Input Field"
            icon={<Type className="w-4 h-4" />}
          />

          <DraggableItem
            type="user-checkout"
            label="Checkout Form"
            icon={<CreditCard className="w-4 h-4" />}
          />

          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 mt-4 flex items-center gap-2">
            <Blocks className="w-3 h-3" /> Custom Components
          </div>
          {(() => {
            const unique = Object.entries(CUSTOM_BLOCKS).reduce(
              (acc: Array<{ key: string; def: any }>, [key, def]) => {
                if (!acc.find((e) => e.def.name === def.name))
                  acc.push({ key, def });
                return acc;
              },
              [],
            );
            return unique.map(({ key, def }) => (
              <ComponentWithVariants key={key} componentKey={key} def={def} />
            ));
          })()}
        </div>
      )}

      {/* Components tab — ESM registry from CDN */}
      {activeTab === "components" && (
        <div className="flex-1 overflow-y-auto py-3">
          <ComponentBrowser tenantId={tenantId ?? "store_001"} />
        </div>
      )}

      <div className="p-4 border-t border-gray-200 text-xs text-gray-500 text-center">
        Drag elements to the canvas
      </div>
    </div>
  );
};
