import React, { useState } from "react";
import { X, Search, Blocks, Clock } from "lucide-react";
import { CUSTOM_BLOCKS } from "./custom-registry";
import { CustomComponentDef } from "../types";
import { useFunnel } from "../context/FunnelContext";

interface AddComponentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetElementId?: string | null;
  mode?: "default" | "create_section";
}

interface ComponentVariant {
  key: string;
  name: string;
  icon: React.ReactNode;
  category: string;
  data: any;
  componentKey: string;
}

export const AddComponentModal: React.FC<AddComponentModalProps> = ({
  isOpen,
  onClose,
  targetElementId,
  mode = "default",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const { addElement, addSectionWithComponent } = useFunnel();

  if (!isOpen) return null;

  // Expand components to include all variants
  const expandedComponents: ComponentVariant[] = [];

  Object.entries(CUSTOM_BLOCKS).forEach(([key, def]) => {
    // Check if component has variants array
    if (def.variants && def.variants.length > 0) {
      def.variants.forEach((variant, idx) => {
        expandedComponents.push({
          key: `${key}-variant-${idx}`,
          name: `${def.name}: ${variant.name}`,
          icon: variant.icon || def.icon,
          category: def.category || "Other",
          data: variant.defaultData,
          componentKey: key,
        });
      });
    }
    // Check if it's Boxes component with cardStyle settings
    else if (key === "boxes" && def.settings?.cardStyle?.options) {
      const styleOptions = def.settings.cardStyle.options;
      styleOptions.forEach((option: any) => {
        expandedComponents.push({
          key: `boxes-${option.value}`,
          name: `Boxes: ${option.label}`,
          icon: def.icon,
          category: def.category || "Other",
          data: {
            ...def.defaultData,
            cardStyle: option.value,
            layout: "grid-2",
          },
          componentKey: key,
        });
      });
    }
    // Regular component without special variants
    else {
      expandedComponents.push({
        key: key,
        name: def.name,
        icon: def.icon,
        category: def.category || "Other",
        data: def.defaultData,
        componentKey: key,
      });
    }
  });

  // Group by category
  const groupedComponents = expandedComponents.reduce(
    (acc, variant) => {
      const category = variant.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      // Check for duplicates by name
      if (!acc[category].find((item) => item.name === variant.name)) {
        acc[category].push(variant);
      }
      return acc;
    },
    {} as Record<string, ComponentVariant[]>,
  );

  // Filter based on search
  const filterComponents = (components: ComponentVariant[]) => {
    if (!searchQuery.trim()) return components;
    return components.filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  };

  const handleComponentSelect = (variant: ComponentVariant) => {
    const targetId = targetElementId || "root";
    if (mode === "create_section") {
      addSectionWithComponent(targetId, variant.componentKey, variant.data);
    } else {
      addElement(
        "custom",
        targetId,
        "inside",
        variant.componentKey,
        variant.data,
      );
    }
    onClose();
  };

  // Recently used (you can track this with localStorage later)
  const recentlyUsed: ComponentVariant[] = expandedComponents.slice(0, 5);

  // Category display order
  const categoryOrder = ["Content", "Dynamic", "Conversion", "Other"];
  const sortedCategories = Object.keys(groupedComponents).sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a);
    const bIndex = categoryOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  // Render component preview card
  const renderComponentCard = (variant: ComponentVariant) => {
    return (
      <button
        key={variant.key}
        onClick={() => handleComponentSelect(variant)}
        className="group relative flex flex-col items-center bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-blue-500 hover:shadow-lg transition-all duration-200 cursor-pointer"
      >
        {/* Preview Area - Simplified visual representation */}
        <div className="w-full aspect-[4/3] bg-gray-50 p-3 flex items-center justify-center relative overflow-hidden border-b border-gray-100">
          {/* Visual preview based on component type */}
          {variant.componentKey === "boxes" && (
            <div className="w-full h-full flex flex-col gap-1.5">
              {/* Show 2 small preview boxes */}
              <div className="flex gap-1.5 flex-1">
                <div className="flex-1 bg-white border border-gray-300 rounded p-1.5 flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-blue-100 flex-shrink-0"></div>
                  <div className="flex-1 space-y-0.5">
                    <div className="h-1 bg-gray-300 rounded w-full"></div>
                    <div className="h-1 bg-gray-200 rounded w-3/4"></div>
                  </div>
                </div>
                <div className="flex-1 bg-white border border-gray-300 rounded p-1.5 flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-blue-100 flex-shrink-0"></div>
                  <div className="flex-1 space-y-0.5">
                    <div className="h-1 bg-gray-300 rounded w-full"></div>
                    <div className="h-1 bg-gray-200 rounded w-3/4"></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {variant.componentKey === "list" && (
            <div className="w-full h-full flex flex-col gap-1.5 p-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"></div>
                  <div className="h-1 bg-gray-300 rounded flex-1"></div>
                </div>
              ))}
            </div>
          )}
          {variant.componentKey === "detail_list" && (
            <div className="w-full h-full flex flex-col gap-2 p-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded bg-blue-100 flex-shrink-0"></div>
                  <div className="flex-1 space-y-1">
                    <div className="h-1 bg-gray-300 rounded w-2/3"></div>
                    <div className="h-0.5 bg-gray-200 rounded w-full"></div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {variant.componentKey === "carousel" && (
            <div className="w-full h-full flex gap-1 p-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex-1 bg-gray-300 rounded"></div>
              ))}
            </div>
          )}
          {variant.componentKey === "countdown" && (
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <div className="w-6 h-6 bg-blue-500 rounded text-white text-[8px] flex items-center justify-center font-bold">
                    {i * 8}
                  </div>
                  <div className="h-0.5 bg-gray-300 rounded w-6"></div>
                </div>
              ))}
            </div>
          )}
          {variant.componentKey === "quotes" && (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-3">
              <div className="w-4 h-4 text-gray-300">"</div>
              <div className="space-y-1 w-full">
                <div className="h-0.5 bg-gray-300 rounded w-full"></div>
                <div className="h-0.5 bg-gray-200 rounded w-4/5 mx-auto"></div>
              </div>
              <div className="h-0.5 bg-gray-400 rounded w-8 mt-1"></div>
            </div>
          )}
          {variant.componentKey === "sequence" && (
            <div className="w-full h-full flex items-center justify-center gap-1">
              {[1, 2, 3].map((i) => (
                <React.Fragment key={i}>
                  <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-[8px] flex items-center justify-center font-bold">
                    {i}
                  </div>
                  {i < 3 && <div className="w-2 h-px bg-blue-300"></div>}
                </React.Fragment>
              ))}
            </div>
          )}
          {variant.componentKey === "step" && (
            <div className="w-full h-full flex flex-col gap-1 p-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-blue-500 text-white text-[8px] flex items-center justify-center font-bold">
                    {i}
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <div className="h-1 bg-gray-300 rounded w-3/4"></div>
                    <div className="h-0.5 bg-gray-200 rounded w-full"></div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {variant.componentKey === "video_cards" && (
            <div className="w-full h-full flex gap-1.5 p-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex-1 flex flex-col gap-1">
                  <div className="flex-1 bg-gray-200 rounded flex items-center justify-center">
                    <div className="w-3 h-3 border-2 border-white border-l-transparent rounded-full"></div>
                  </div>
                  <div className="h-1 bg-gray-300 rounded"></div>
                </div>
              ))}
            </div>
          )}

          {/* Icon overlay */}
          <div className="absolute top-2 left-2 p-1 bg-white/90 rounded shadow-sm backdrop-blur-sm">
            <div className="text-blue-600 opacity-70 group-hover:opacity-100 transition-opacity">
              {variant.icon}
            </div>
          </div>
        </div>

        {/* Label */}
        <div className="w-full p-2.5 text-center">
          <span className="text-xs font-medium text-gray-700 group-hover:text-blue-600 transition-colors line-clamp-2">
            {variant.name}
          </span>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/5 transition-colors pointer-events-none rounded-lg"></div>
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Blocks className="w-5 h-5 text-blue-600" />
              Add card template
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Choose a component to add to your page
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Component List */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Recently used */}
          {!searchQuery && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock className="w-3 h-3" />
                Recently used
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {recentlyUsed.map((variant) => renderComponentCard(variant))}
              </div>
            </div>
          )}

          {/* Categories */}
          {sortedCategories.map((category) => {
            const components = filterComponents(groupedComponents[category]);
            if (components.length === 0) return null;

            return (
              <div key={category} className="mb-6 last:mb-0">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {category}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {components.map((variant) => renderComponentCard(variant))}
                </div>
              </div>
            );
          })}

          {/* No results */}
          {sortedCategories.every(
            (category) =>
              filterComponents(groupedComponents[category]).length === 0,
          ) && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Blocks className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">No components found</p>
              <p className="text-sm">Try a different search term</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
