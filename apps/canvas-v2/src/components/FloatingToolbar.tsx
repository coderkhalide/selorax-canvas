import React from "react";
import {
  GripVertical,
  Sparkles,
  Layout,
  Copy,
  Trash2,
  Plus,
} from "lucide-react";

interface FloatingToolbarProps {
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onMagicClick: () => void;
  onLayoutClick: () => void;
  onDuplicateClick: () => void;
  onDeleteClick: () => void;
  onAddClick?: () => void;
  elementName: string;
  isCustom?: boolean;
  variant?: "default" | "bottom-bar" | "top-bar";
  className?: string; // allow overrides
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  onDragStart,
  onDragEnd,
  onMagicClick,
  onLayoutClick,
  onDuplicateClick,
  onDeleteClick,
  onAddClick,
  elementName,
  isCustom,
  variant = "default",
  className,
}) => {
  if (variant === "bottom-bar") {
    // Bottom Bar: Just the 3 actions (+, Magic, Layout)
    return (
      <div
        className={`absolute z-50 flex items-center justify-center animate-in fade-in slide-in-from-bottom-2 duration-150 ${
          className || "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2"
        }`}
      >
        <div className="bg-white rounded-full shadow-lg border border-blue-100 flex items-center p-1 gap-1 px-2">
          {/* Add Actions */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddClick?.();
            }}
            className="text-gray-500 p-1.5 rounded-full hover:bg-blue-50 hover:text-blue-600 transition-colors"
            title="Add Element"
          >
            <Plus className="w-4 h-4" />
          </button>

          <div className="w-px h-3 bg-gray-200 mx-0.5" />

          {/* Magic / AI Action */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMagicClick();
            }}
            className="group relative flex items-center justify-center p-1.5 rounded-full hover:bg-purple-50 hover:text-purple-600 transition-colors text-gray-500"
            title="Generate with AI"
          >
            <Sparkles className="w-4 h-4" />
          </button>

          <div className="w-px h-3 bg-gray-200 mx-0.5" />

          {/* Layout Action */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLayoutClick();
            }}
            className="text-gray-500 p-1.5 rounded-full hover:bg-orange-50 hover:text-orange-600 transition-colors"
            title="Change Layout"
          >
            <Layout className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Default / Top Bar
  return (
    <div
      className={`absolute -top-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 animate-in fade-in zoom-in-95 duration-150 ${
        className || ""
      }`}
    >
      <div className="bg-white rounded-lg shadow-xl border border-gray-100 flex items-center p-1 gap-1">
        {/* Drag Handle */}
        <div
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className="text-gray-400 p-1.5 rounded-md hover:bg-gray-50 cursor-grab active:cursor-grabbing"
          title="Drag to move"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Only show these if default mode (optional, based on requirement) */}
        {variant === "default" && (
          <>
            <div className="w-px h-4 bg-gray-200 mx-0.5" />
            {/* Magic / AI Action */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMagicClick();
              }}
              className="group relative flex items-center justify-center p-1.5 rounded-md hover:bg-purple-50 hover:text-purple-600 transition-colors text-gray-600"
              title="Add card with AI"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          </>
        )}

        <div className="w-px h-4 bg-gray-200 mx-0.5" />

        {/* Standard Actions */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDuplicateClick();
          }}
          className="text-gray-400 p-1.5 rounded-md hover:bg-gray-50 hover:text-gray-700 transition-colors"
          title="Duplicate"
        >
          <Copy className="w-4 h-4" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteClick();
          }}
          className="text-gray-400 p-1.5 rounded-md hover:bg-red-50 hover:text-red-600 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Label Badge */}
      <div className="bg-white text-gray-900 text-[10px] px-2 py-1 rounded-md shadow-md border border-gray-200 font-medium tracking-wide opacity-90 backdrop-blur-sm">
        {elementName}
      </div>
    </div>
  );
};
