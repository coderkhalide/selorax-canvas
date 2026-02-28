import React, { useState } from "react";
import {
  X,
  Search,
  LayoutGrid,
  List,
  Circle,
  ArrowRightLeft,
  Images,
  Video,
  Loader2,
  FileStack,
} from "lucide-react";
import { useFunnel } from "../context/FunnelContext";
import {
  getLayoutsByComponentType,
  LayoutVariant,
  transformContentToComponent,
} from "./layouts";
import { LayoutPreviewCard } from "./LayoutPreviewCard";
import { useSavedSectionLayouts } from "../hooks/useSavedSectionLayouts";
import { SavedSectionCard } from "./SavedSectionCard";
import { regenerateElementIds, MatchedSection } from "../lib/sectionMatcher";

interface LayoutSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedElementId: string | null;
}

export const LayoutSidebar: React.FC<LayoutSidebarProps> = ({
  isOpen,
  onClose,
  selectedElementId,
}) => {
  const { selectedElement, updateElement } = useFunnel();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"pages" | "presets">("pages");

  console.log('[LayoutSidebar] Rendering', {
    isOpen,
    selectedElementId,
    selectedElementName: selectedElement?.name,
    selectedElementType: selectedElement?.type
  });

  // Fetch matching sections from saved landing pages
  const { matchingSections, isLoading: isLoadingSections, error } =
    useSavedSectionLayouts(selectedElement, isOpen);

  console.log('[LayoutSidebar] Hook result', {
    matchingSections: matchingSections.length,
    isLoading: isLoadingSections,
    error
  });

  const componentType =
    selectedElement?.customType || selectedElement?.type || "";
  const availableLayouts = getLayoutsByComponentType(componentType);
  const filteredLayouts = React.useMemo(
    () =>
      availableLayouts.filter((layout) =>
        layout.name.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [availableLayouts, searchTerm],
  );

  console.log(filteredLayouts, "filter");

  if (!isOpen || !selectedElement) return null;

  const handleLayoutSelect = (layout: LayoutVariant) => {
    if (!selectedElementId) return;

    // ✅ Check if changing to a different component type
    const targetComponentType = layout.componentType;
    const currentComponentType =
      selectedElement.customType || selectedElement.type;

    let transformedData = {};

    // ✅ If changing component type, transform the content!
    if (targetComponentType !== currentComponentType) {
      // Transform existing content to new format (with source type!)
      transformedData = transformContentToComponent(
        selectedElement.data || {},
        currentComponentType, // ✅ Source type
        targetComponentType, // ✅ Target type
      );

      // Update component type AND data
      updateElement(selectedElementId, {
        customType: targetComponentType,
        type: "custom",
        data: {
          ...transformedData,
          ...layout.defaultData,
        },
      });
    } else {
      // ✅ Same component type, just update layout style
      const updatedData = {
        ...(selectedElement.data || {}),
        ...layout.defaultData,
      };
      updateElement(selectedElementId, { data: updatedData });
    }
  };

  // Handler for selecting a section from saved landing pages
  const handleSavedSectionSelect = (section: MatchedSection) => {
    if (!selectedElementId) return;

    // Deep clone and regenerate all IDs to prevent collisions
    const clonedSection = regenerateElementIds(
      JSON.parse(JSON.stringify(section.sectionElement))
    );

    // Replace the current element with the selected section
    // Keep the original element's ID to maintain its position in the tree
    updateElement(selectedElementId, {
      ...clonedSection,
      id: selectedElementId,
    });

    onClose();
  };

  return (
    <div
      className={`fixed top-0 right-0 h-full bg-white shadow-2xl z-50 transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
      style={{ width: "500px" }}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0 z-10">
        <h2 className="text-lg font-bold text-gray-800">Change Layout</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-red-50 rounded-lg transition-all hover:scale-110 group"
          aria-label="Close layout sidebar"
          title="Close (Style Panel দেখতে পারবেন)"
        >
          <X className="w-5 h-5 text-gray-600 group-hover:text-red-600 transition-colors" />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 bg-white sticky top-[65px] z-10">
        <button
          onClick={() => setActiveTab("pages")}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            activeTab === "pages"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <FileStack className="w-4 h-4" />
          From Pages
          {matchingSections.length > 0 && (
            <span className="bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-full">
              {matchingSections.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("presets")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === "presets"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Presets
        </button>
      </div>

      {/* Search Bar - Only show for presets tab */}
      {activeTab === "presets" && (
        <div className="p-4 border-b border-gray-200 bg-white sticky top-[113px] z-10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search layouts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* Scrollable Content */}
      <div
        className="overflow-y-auto bg-gray-50"
        style={{ height: activeTab === "presets" ? "calc(100vh - 190px)" : "calc(100vh - 130px)" }}
      >
        {/* From Pages Tab Content */}
        {activeTab === "pages" && (
          <div className="p-6">
            {error ? (
              <div className="text-center py-16">
                <div className="text-red-500 mb-4">
                  <X className="w-12 h-12 mx-auto" />
                </div>
                <p className="text-red-600 font-medium mb-1">Error loading sections</p>
                <p className="text-gray-500 text-sm mb-4">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
                >
                  Retry
                </button>
              </div>
            ) : isLoadingSections ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-3" />
                <p className="text-gray-500 text-sm">Loading sections...</p>
              </div>
            ) : matchingSections.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {matchingSections.map((section) => (
                  <SavedSectionCard
                    key={section.id}
                    section={section}
                    isSelected={false}
                    onClick={() => handleSavedSectionSelect(section)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <FileStack className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-600 font-medium mb-1">
                  No matching sections found
                </p>
                <p className="text-gray-400 text-sm">
                  Looking for sections named: &quot;{selectedElement?.name}&quot;
                </p>
                <p className="text-gray-400 text-xs mt-2">
                  Save more landing pages to see their sections here
                </p>
              </div>
            )}
          </div>
        )}

        {/* Presets Tab Content */}
        {activeTab === "presets" && (
        <div className="p-6 space-y-8">


          {/* 🖼️ Hero Slider Section */}
          {filteredLayouts.filter((l) => l.componentType === "hero_slider")
            .length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Images className="w-5 h-5 text-gray-700" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Hero Slider
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {filteredLayouts
                  .filter((l) => l.componentType === "hero_slider")
                  .map((layout) => (
                    <LayoutPreviewCard
                      key={layout.id}
                      layout={layout}
                      isSelected={
                        selectedElement?.customType === layout.componentType &&
                        selectedElement.data?.layout ===
                          layout.defaultData.layout
                      }
                      onClick={() => handleLayoutSelect(layout)}
                      showLabel={true}
                      currentData={selectedElement?.data}
                      currentComponentType={componentType}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* 🗂️ Categories Section */}
          {filteredLayouts.filter(
            (l) =>
              l.componentType === "categories" ||
              l.componentType === "category_carousel" ||
              l.componentType === "collections",
          ).length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <LayoutGrid className="w-5 h-5 text-gray-700" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Categories
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {filteredLayouts
                  .filter(
                    (l) =>
                      l.componentType === "categories" ||
                      l.componentType === "category_carousel" ||
                      l.componentType === "collections",
                  )
                  .map((layout) => (
                    <LayoutPreviewCard
                      key={layout.id}
                      layout={layout}
                      isSelected={
                        selectedElement?.customType === layout.componentType &&
                        ((layout.defaultData.layout !== undefined &&
                          selectedElement.data?.layout ===
                            layout.defaultData.layout) ||
                          (layout.defaultData.variant !== undefined &&
                            selectedElement.data?.variant ===
                              layout.defaultData.variant))
                      }
                      onClick={() => handleLayoutSelect(layout)}
                      showLabel={true}
                      currentData={selectedElement?.data}
                      currentComponentType={componentType}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* 📦 Boxes Section (Custom) */}
          {filteredLayouts.filter((l) => l.componentType === "boxes").length >
            0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <LayoutGrid className="w-5 h-5 text-gray-700" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Boxes
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {filteredLayouts
                  .filter((l) => l.componentType === "boxes")
                  .map((layout) => (
                    <LayoutPreviewCard
                      key={layout.id}
                      layout={layout}
                      isSelected={
                        selectedElement?.customType === layout.componentType &&
                        selectedElement.data?.layout ===
                          layout.defaultData.layout
                      }
                      onClick={() => handleLayoutSelect(layout)}
                      showLabel={true}
                      currentData={selectedElement?.data}
                      currentComponentType={componentType}
                    />
                  ))}
              </div>
            </div>
          )}



          {/* 🎞️ Video Cards Section */}
          {filteredLayouts.filter((l) => l.componentType === "video_cards")
            .length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Video className="w-5 h-5 text-gray-700" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Videos
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {filteredLayouts
                  .filter((l) => l.componentType === "video_cards")
                  .map((layout) => (
                    <LayoutPreviewCard
                      key={layout.id}
                      layout={layout}
                      isSelected={
                        selectedElement?.customType === layout.componentType &&
                        selectedElement.data?.layout ===
                          layout.defaultData.layout
                      }
                      onClick={() => handleLayoutSelect(layout)}
                      showLabel={true}
                      currentData={selectedElement?.data}
                      currentComponentType={componentType}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* 📝 Lists Section */}
          {filteredLayouts.filter((l) => l.componentType === "list").length >
            0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <List className="w-5 h-5 text-gray-700" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Lists
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {filteredLayouts
                  .filter((l) => l.componentType === "list")
                  .map((layout) => (
                    <LayoutPreviewCard
                      key={layout.id}
                      layout={layout}
                      isSelected={
                        selectedElement?.customType === layout.componentType &&
                        selectedElement.data?.layout ===
                          layout.defaultData.layout
                      }
                      onClick={() => handleLayoutSelect(layout)}
                      showLabel={true}
                      currentData={selectedElement?.data}
                      currentComponentType={componentType}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* ⭕ Circles Section */}
          {filteredLayouts.filter((l) => l.componentType === "circle").length >
            0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Circle className="w-5 h-5 text-gray-700" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Circles
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {filteredLayouts
                  .filter((l) => l.componentType === "circle")
                  .map((layout) => (
                    <LayoutPreviewCard
                      key={layout.id}
                      layout={layout}
                      isSelected={
                        selectedElement?.customType === layout.componentType &&
                        selectedElement.data?.layout ===
                          layout.defaultData.layout
                      }
                      onClick={() => handleLayoutSelect(layout)}
                      showLabel={true}
                      currentData={selectedElement?.data}
                      currentComponentType={componentType}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Quotes Section */}
          {filteredLayouts.filter((l) => l.componentType === "quotes").length >
            0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <List className="w-5 h-5 text-gray-700" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Quotes
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {filteredLayouts
                  .filter((l) => l.componentType === "quotes")
                  .map((layout) => (
                    <LayoutPreviewCard
                      key={layout.id}
                      layout={layout}
                      isSelected={
                        selectedElement?.customType === layout.componentType &&
                        selectedElement.data?.layout ===
                          layout.defaultData.layout
                      }
                      onClick={() => handleLayoutSelect(layout)}
                      showLabel={true}
                      currentData={selectedElement?.data}
                      currentComponentType={componentType}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Steps Section */}
          {filteredLayouts.filter((l) => l.componentType === "step").length >
            0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <LayoutGrid className="w-5 h-5 text-gray-700" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Steps
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {filteredLayouts
                  .filter((l) => l.componentType === "step")
                  .map((layout) => (
                    <LayoutPreviewCard
                      key={layout.id}
                      layout={layout}
                      isSelected={
                        selectedElement?.customType === layout.componentType &&
                        selectedElement.data?.layout ===
                          layout.defaultData.layout
                      }
                      onClick={() => handleLayoutSelect(layout)}
                      showLabel={true}
                      currentData={selectedElement?.data}
                      currentComponentType={componentType}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* 🔢 Sequence Section */}
          {filteredLayouts.filter((l) => l.componentType === "sequence")
            .length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <List className="w-5 h-5 text-gray-700" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Sequence / Process
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {filteredLayouts
                  .filter((l) => l.componentType === "sequence")
                  .map((layout) => (
                    <LayoutPreviewCard
                      key={layout.id}
                      layout={layout}
                      isSelected={
                        selectedElement?.customType === layout.componentType &&
                        selectedElement.data?.layout ===
                          layout.defaultData.layout
                      }
                      onClick={() => handleLayoutSelect(layout)}
                      showLabel={true}
                      currentData={selectedElement?.data}
                      currentComponentType={componentType}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* No Results */}
          {filteredLayouts.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-2">
                <Search className="w-12 h-12 mx-auto" />
              </div>
              <p className="text-gray-500 font-medium">No layouts found</p>
              <p className="text-gray-400 text-sm mt-1">
                Try adjusting your search
              </p>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
};
