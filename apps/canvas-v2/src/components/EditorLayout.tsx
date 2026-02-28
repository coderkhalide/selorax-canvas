import React, { useRef, useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Canvas } from "./Canvas";
import { PropertiesPanel } from "./PropertiesPanel";
import { Zap, X, Wand2, Image as ImageIcon } from "lucide-react";
import { useFunnel } from "../context/FunnelContext";
import { AIGenerationPanel } from "./AIGenerationPanel";
import { AIPromptBar } from "./AIPromptBar";

interface EditorLayoutProps {
  showAiPrompt: boolean;
  setShowAiPrompt: (show: boolean) => void;
  aiPrompt: string;
  setAiPrompt: (prompt: string) => void;
  isAnalyzing: boolean;
  followAiScroll: boolean;
  handleAiOptimization: () => void;
  selectedImage?: string | null;
  setSelectedImage?: (image: string | null) => void;
  generateSpecificComponent?: (
    targetId: string,
    prompt: string,
    style?: string,
    image?: string | null
  ) => Promise<void>;
  tenantId?: string;
  pageId?: string;
}

export const EditorLayout: React.FC<EditorLayoutProps> = ({
  showAiPrompt,
  setShowAiPrompt,
  aiPrompt,
  setAiPrompt,
  isAnalyzing,
  followAiScroll,
  handleAiOptimization,
  selectedImage,
  setSelectedImage,
  generateSpecificComponent,
  tenantId,
  pageId,
}) => {
  /* Destructure addElement to support direct template insertion */
  const {
    viewMode,
    enableStreaming,
    setEnableStreaming,
    addElement,
  } = useFunnel();

  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && setSelectedImage) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Strip prefix for API but keep full string for preview if needed
        // For API we need pure base64.
        // Let's store pure base64 in state for simplicity with the API hook.
        const base64 = result.split(",")[1];
        setSelectedImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob && setSelectedImage) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const result = event.target?.result as string;
            if (result) {
              const base64 = result.split(",")[1];
              setSelectedImage(base64);
            }
          };
          reader.readAsDataURL(blob);
          e.preventDefault();
        }
      }
    }
  };

  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [activeAiElementId, setActiveAiElementId] = useState<string | null>(
    null
  );

  useEffect(() => {
    const handleOpenAiPanel = (e: CustomEvent) => {
      setActiveAiElementId(e.detail.elementId);
      setAiPanelOpen(true);
    };
    window.addEventListener("openAiPanel", handleOpenAiPanel as EventListener);
    return () =>
      window.removeEventListener(
        "openAiPanel",
        handleOpenAiPanel as EventListener
      );
  }, []);

  return (
    <div className="flex-1 flex overflow-hidden">
      {viewMode === "editor" && (
        <div className="hidden md:block h-full transition-all duration-300">
          <Sidebar tenantId={tenantId} />
        </div>
      )}
      <main
        className="flex-1 relative bg-gray-100 flex flex-col items-center justify-start overflow-hidden transition-all"
      >
        {/* AI Prompt Bar — always visible above canvas */}
        <div className="w-full flex-shrink-0">
          <AIPromptBar pageId={pageId} tenantId={tenantId} />
        </div>
        {viewMode === "editor" && (
          <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
            {showAiPrompt && (
              <div className="bg-white p-3 rounded-lg shadow-xl border border-purple-100 w-64 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-purple-700">
                    Optimization Goal
                  </span>
                  <button
                    onClick={() => setShowAiPrompt(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                {selectedImage && (
                  <div className="mb-2 relative group w-16 h-16">
                    <img
                      src={`data:image/png;base64,${selectedImage}`}
                      alt="Reference"
                      className="w-full h-full object-cover rounded border border-gray-200"
                    />
                    <button
                      onClick={() => setSelectedImage?.(null)}
                      className="absolute top-1 right-1 bg-white text-gray-900 shadow-sm border border-gray-200 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <textarea
                  className="w-full text-xs p-2 border rounded mb-2 bg-gray-50 text-gray-800 focus:outline-none focus:border-purple-500"
                  rows={3}
                  placeholder={
                    selectedImage
                      ? "Describe how to use this image..."
                      : "Paste image here or describe goal..."
                  }
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onPaste={handlePaste}
                />

                <div className="flex gap-2">
                  <input
                    type="file"
                    ref={imageInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="flex-shrink-0 bg-gray-100 text-gray-600 p-2 rounded hover:bg-gray-200"
                    title="Upload Reference Image"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleAiOptimization}
                    disabled={isAnalyzing}
                    className="flex-1 bg-purple-600 text-white text-xs py-1.5 rounded hover:bg-purple-700 font-medium disabled:opacity-50"
                  >
                    {isAnalyzing ? "Thinking..." : "Run Optimizer"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <Canvas isAnalyzing={isAnalyzing} followAiScroll={followAiScroll} />
        <AIGenerationPanel
          isOpen={aiPanelOpen}
          onClose={() => setAiPanelOpen(false)}
          selectedImage={selectedImage}
          setSelectedImage={setSelectedImage}
          onSubmit={(prompt, style, image) => {
            if (!prompt.trim() && style !== "magic") {
              if (activeAiElementId) {
                addElement("custom", activeAiElementId, "inside", style);
              }
            } else {
              if (activeAiElementId && generateSpecificComponent) {
                generateSpecificComponent(
                  activeAiElementId,
                  prompt,
                  style === "magic" ? undefined : style,
                  image
                );
              } else {
                const contextPrompt =
                  style !== "magic" ? `${prompt} (Style: ${style})` : prompt;
                setAiPrompt(contextPrompt);
                handleAiOptimization();
              }
            }
            setAiPanelOpen(false);
          }}
        />
      </main>
      {viewMode === "editor" && (
        <div className="hidden lg:block">
          <PropertiesPanel />
        </div>
      )}
    </div>
  );
};
