import React, { useState, useEffect, useRef } from "react";
import { MousePointerClick } from "lucide-react";
import { useFunnel } from "../context/FunnelContext";
import { LayersPanel } from "./LayersPanel";
import { StylePanel } from "./properties/StylePanel";
import { ThemePanel } from "./properties/ThemePanel";

export const PropertiesPanel: React.FC = () => {
  const { selectedElement } = useFunnel();
  const [activeTab, setActiveTab] = useState<"style" | "layers" | "theme">(
    "style"
  );
  const layersContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedElement && activeTab === "layers") {
      document
        .getElementById(`layer-${selectedElement.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedElement, activeTab]);

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab("style")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === "style"
              ? "text-blue-500 border-b-2 border-blue-500"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Properties
        </button>
        <button
          onClick={() => setActiveTab("theme")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === "theme"
              ? "text-blue-500 border-b-2 border-blue-500"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Themes
        </button>
        <button
          onClick={() => setActiveTab("layers")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === "layers"
              ? "text-blue-500 border-b-2 border-blue-500"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Layers
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" ref={layersContainerRef}>
        {activeTab === "style" &&
          (selectedElement ? (
            <StylePanel />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-2">
              <MousePointerClick className="w-8 h-8 opacity-50" />
              <p className="text-sm">Select an element to edit</p>
            </div>
          ))}

        {activeTab === "theme" && <ThemePanel />}

        {activeTab === "layers" && <LayersPanel />}
      </div>
    </div>
  );
};
