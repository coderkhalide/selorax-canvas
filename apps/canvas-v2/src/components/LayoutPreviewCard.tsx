import React from "react";
import { Check } from "lucide-react";
import { LayoutVariant, transformContentToComponent } from "./layouts";
import { CUSTOM_BLOCKS } from "./custom-registry";
import { ScaledPreview } from "./layouts/PreviewRenderers";
import { FunnelElement } from "../types";

interface LayoutPreviewCardProps {
  layout: LayoutVariant;
  isSelected: boolean;
  onClick: () => void;
  preview?: React.ReactNode;
  showLabel?: boolean;
  currentData?: Record<string, any>;
  currentComponentType?: string;
}

const LayoutPreviewCardInner: React.FC<LayoutPreviewCardProps> = ({
  layout,
  isSelected,
  onClick,
  preview,
  showLabel = true,
  currentData = {},
  currentComponentType = "",
}) => {
  const renderPreview = () => {
    if (preview) return preview;

    // Check if we have a custom component definition for this layout
    const CustomDef = layout.componentType
      ? CUSTOM_BLOCKS[layout.componentType]
      : null;

    if (CustomDef) {
      let previewData = { ...currentData, ...layout.defaultData };

      if (
        currentComponentType &&
        currentComponentType !== layout.componentType
      ) {
        const transformedContent = transformContentToComponent(
          currentData,
          currentComponentType,
          layout.componentType
        );

        // Merge transformed content with layout defaults
        previewData = {
          ...transformedContent,
          ...layout.defaultData,
        };
      }

      const mockElement: FunnelElement = {
        id: "preview",
        type: "custom",
        customType: layout.componentType,
        data: previewData,
        style: {},
        name: layout.name,
      } as any;

      return (
        <ScaledPreview scale={0.3}>
          <CustomDef.component element={mockElement} isPreview={true} />
        </ScaledPreview>
      );
    }

    if (layout.thumbnail) {
      return (
        <img
          src={layout.thumbnail}
          alt={layout.name}
          className="w-full h-full object-contain"
        />
      );
    }

    return <div className="text-gray-400">{layout.icon}</div>;
  };

  return (
    <button
      onClick={onClick}
      className={`relative  rounded-lg border-2 transition-all duration-200 hover:shadow-lg ${
        isSelected
          ? "border-blue-500 ring-2 ring-blue-500/30"
          : "border-gray-200 hover:border-blue-300"
      }`}
    >
      <div className="h-40 rounded-md  flex items-center justify-center overflow-hidden relative isolate">
        {renderPreview()}
      </div>
      {/* {showLabel && (
        <div className="text-sm font-medium text-gray-700 text-left">
          {layout.name}
        </div>
      )} */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center z-10">
          <Check className="w-4 h-4 text-white" />
        </div>
      )}
    </button>
  );
};

export const LayoutPreviewCard = React.memo(LayoutPreviewCardInner);
