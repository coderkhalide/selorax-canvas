import React, { useMemo, useState } from "react";
import { colord } from "colord";
import {
  Settings,
  Trash2,
  Smartphone,
  Tablet,
  Bot,
  Loader2,
  Sparkles,
  Blocks,
  Wand2,
  Layout,
  Plus,
  ArrowRightLeft,
  ArrowUpDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize,
  Anchor,
  Move3d,
  Type,
  AlignJustify,
  Image as ImageIcon,
  ChevronsLeftRight,
  Minimize2,
  BoxSelect,
  Square,
  Ghost,
  Hash,
  X,
  Upload,
  MousePointer2,
} from "lucide-react";
import ImageUpload from "../shared/ImageUpload";
import { useFunnel } from "../../context/FunnelContext";
import * as geminiService from "../../services/gemini";
import * as openaiService from "../../services/openai";
import { ColorScheme } from "../../types";
import { CUSTOM_BLOCKS } from "../custom-registry";
import {
  Accordion,
  SizeInput,
  QuadInput,
  TransformControl,
  PositionControl,
  ShadowControl,
} from "./PropertyControls";
import { RichTextEditor } from "./RichTextEditor";
import { DynamicSettings } from "./DynamicInputs";
import { ColorPicker } from "../ui/ColorPicker";
import { IconPicker } from "../ui/IconPicker";
import { imageGetUrl } from "@/utils/utils";

export const StylePanel: React.FC = () => {
  const {
    selectedElement,
    updateElement,
    deleteElement,
    setSelectedId,
    deviceView,
    enableStreaming,
    schemes,
    currentSchemeId,
    apiKey,
    aiProvider,
  } = useFunnel();
  const aiService = aiProvider === "openai" ? openaiService : geminiService;
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [agentPrompt, setAgentPrompt] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showMinMaxMenu, setShowMinMaxMenu] = useState(false);
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(
    null,
  );
  const [globalColorPicker, setGlobalColorPicker] = useState<{
    isOpen: boolean;
    color: string;
    onChange: (color: string) => void;
  } | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);

  const handleUploadComplete = (newFiles: any[]) => {
    if (!selectedElement) {
      setShowUploadModal(false);
      return;
    }
    if (newFiles && newFiles.length > 0) {
      const appended = Array.isArray(newFiles) ? newFiles : [newFiles];
      const lastUrl = appended[appended.length - 1];

      if (uploadTarget === "background") {
        updateElement(selectedElement.id, {
          data: { ...(selectedElement.data || {}), backgroundImage: lastUrl },
        });
      } else if (selectedElement.type === "image") {
        updateElement(selectedElement.id, { src: lastUrl });
      } else if (Array.isArray(selectedElement.data?.images)) {
        const next = [
          ...(selectedElement.data?.images || []),
          { image: lastUrl },
        ];
        updateElement(selectedElement.id, {
          data: { ...(selectedElement.data || {}), images: next },
        });
      } else if (Array.isArray(selectedElement.data?.items)) {
        const next = [
          ...(selectedElement.data?.items || []),
          { image: lastUrl },
        ];
        updateElement(selectedElement.id, {
          data: { ...(selectedElement.data || {}), items: next },
        });
      } else if (Array.isArray(selectedElement.data?.slides)) {
        const next = [
          ...(selectedElement.data?.slides || []),
          {
            image: lastUrl,
            title: "New Slide",
            sub_title: "Description",
            has_button: true,
            button_text: "Shop Now",
            button_link: "#",
          },
        ];
        updateElement(selectedElement.id, {
          data: { ...(selectedElement.data || {}), slides: next },
        });
      }
    }
    setShowUploadModal(false);
  };

  if (!selectedElement) return null;

  const isContainer = ["section", "wrapper", "row", "col"].includes(
    selectedElement.type,
  );
  const isTablet = deviceView === "tablet";
  const isMobile = deviceView === "mobile";
  const isText = [
    "headline",
    "paragraph",
    "button",
    "input",
    "user-checkout",
  ].includes(selectedElement.type);
  const isMedia = ["image", "video"].includes(selectedElement.type);
  const isCustom = selectedElement.type === "custom";
  const resolveCssVar = (val?: string): string | undefined => {
    if (!val) return undefined;
    const s = String(val);
    let resolved = s;
    if (s.startsWith("var(")) {
      const m = s.match(/var\((--[^)]+)\)/);
      const varName = m?.[1];
      if (varName) {
        resolved = getComputedStyle(document.documentElement)
          .getPropertyValue(varName)
          .trim();

        // Fallback: try to look up in the scheme if computed style fails
        if (!resolved) {
          const schemeId = selectedElement.schemeId || currentSchemeId;
          const scheme = schemes[schemeId];
          if (scheme) {
            // Convert var name (e.g. --color-primary-button-text) to key (e.g. primary_button_text)
            const key = varName.replace(/^--color-/, "").replace(/-/g, "_");
            if (scheme.settings && (scheme.settings as any)[key]) {
              resolved = (scheme.settings as any)[key];
            }
          }
        }
      }
    }

    // Always try to return as hex if it's a valid color and not a gradient
    if (
      resolved &&
      !resolved.includes("gradient") &&
      colord(resolved).isValid()
    ) {
      return colord(resolved).toHex();
    }

    return resolved || undefined;
  };

  const presetColors = useMemo(() => {
    const scheme = schemes[currentSchemeId];
    if (!scheme) return [];
    const colors = new Set<string>();
    Object.values(scheme.settings).forEach((val) => {
      if (
        val &&
        typeof val === "string" &&
        (val.startsWith("#") || val.startsWith("rgb"))
      ) {
        colors.add(val);
      }
    });

    // Add custom colors
    if (scheme.customColors) {
      scheme.customColors.forEach((c) => {
        if (c.value) colors.add(c.value);
      });
    }

    return Array.from(colors);
  }, [schemes, currentSchemeId]);

  const getStyle = (key: keyof React.CSSProperties) => {
    if (isMobile)
      return (selectedElement.mobileStyle?.[key] ??
        selectedElement.tabletStyle?.[key] ??
        selectedElement.style?.[key]) as any;
    if (isTablet)
      return (selectedElement.tabletStyle?.[key] ??
        selectedElement.style?.[key]) as any;
    return selectedElement.style?.[key];
  };

  const setStyle = (key: keyof React.CSSProperties, value: any) => {
    const target = isMobile ? "mobileStyle" : isTablet ? "tabletStyle" : "style";
    const current = isMobile
      ? selectedElement.mobileStyle || {}
      : isTablet
        ? selectedElement.tabletStyle || {}
        : selectedElement.style;
    updateElement(selectedElement.id, {
      [target]: { ...current, [key]: value },
    });
  };

  const handleAiGeneration = async () => {
    setIsGenerating(true);
    if (enableStreaming) {
      let text = "";
      try {
        const stream = await aiService.generateCopyStream(
          "Improve this text",
          selectedElement.content,
        );
        for await (const chunk of stream) {
          text += chunk;
          updateElement(selectedElement.id, {
            content: text.replace(/^"|"$/g, ""),
          });
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      const result = await aiService.generateCopy(
        "Improve this text",
        selectedElement.content,
      );
      updateElement(selectedElement.id, {
        content: result.replace(/^"|"$/g, ""),
      });
    }
    setIsGenerating(false);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.indexOf("image") !== -1) {
        e.preventDefault();
        const blob = item.getAsFile();
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          // Extract base64 data only (remove data:image/png;base64, prefix)
          const base64Data = base64.split(",")[1];
          setSelectedImage(base64Data);
        };
        if (blob) reader.readAsDataURL(blob);
      }
    }
  };

  const handleAgentRun = async () => {
    if (!apiKey) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("show-toast", {
            detail: {
              message: "Please Provide a valid API key.",
              type: "error",
            },
          }),
        );
      }
      return;
    }
    if (!agentPrompt.trim() && !selectedImage) return;
    setIsAgentRunning(true);
    const originalWrapper = [selectedElement];

    if (enableStreaming) {
      let accumulatedJson = "";
      try {
        const stream = selectedImage
          ? await aiService.fixComponentWithImageStream(
              selectedElement,
              selectedImage,
              agentPrompt,
            )
          : await aiService.editComponentStream(selectedElement, agentPrompt);

        for await (const chunk of stream) {
          accumulatedJson += chunk;
          const partialData = aiService.smartParsePartialJson(
            accumulatedJson,
            false,
          );
          if (partialData && partialData.type) {
            const [safeData] = aiService.sanitizeAndMerge(
              [partialData],
              originalWrapper,
            );
            updateElement(selectedElement.id, {
              ...safeData,
              id: selectedElement.id,
            });
          }
        }
        const finalData = aiService.smartParsePartialJson(
          accumulatedJson,
          false,
        );
        if (finalData) {
          const [safeData] = aiService.sanitizeAndMerge(
            [finalData],
            originalWrapper,
          );
          updateElement(selectedElement.id, {
            ...safeData,
            id: selectedElement.id,
          });
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      const updated = selectedImage
        ? await aiService.fixComponentWithImage(
            selectedElement,
            selectedImage,
            agentPrompt,
          )
        : await aiService.editComponent(selectedElement, agentPrompt);
      if (updated) {
        const [safeData] = aiService.sanitizeAndMerge(
          [updated],
          originalWrapper,
        );
        updateElement(selectedElement.id, {
          ...safeData,
          id: selectedElement.id,
        });
      }
    }
    setIsAgentRunning(false);
    setAgentPrompt("");
    setSelectedImage(null);
  };

  return (
    <div className="relative">
      {globalColorPicker?.isOpen && (
        <>
          {/* Backdrop for click outside */}
          <div
            className="fixed inset-0 z-[99] bg-transparent"
            onClick={() => setGlobalColorPicker(null)}
          />
          {/* Floating Color Picker Position Container */}
          <div className="fixed top-20 right-[380px] z-[100]">
            <ColorPicker
              color={globalColorPicker.color}
              onChange={globalColorPicker.onChange}
              onClose={() => setGlobalColorPicker(null)}
              presetColors={presetColors}
            />
          </div>
        </>
      )}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
          <Settings className="w-4 h-4" /> {selectedElement.type}
        </h3>
        <button
          onClick={() => deleteElement(selectedElement.id)}
          className="p-1.5 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {isTablet && (
        <div className="mx-4 mt-4 bg-purple-50 border border-purple-200 rounded p-3 flex items-center gap-3 text-purple-800 text-xs">
          <Tablet className="w-4 h-4" />
          <div>
            <div className="font-bold">Tablet Override Mode</div>
          </div>
        </div>
      )}
      {isMobile && (
        <div className="mx-4 mt-4 bg-blue-50 border border-blue-200 rounded p-3 flex items-center gap-3 text-blue-800 text-xs">
          <Smartphone className="w-4 h-4" />
          <div>
            <div className="font-bold">Mobile Override Mode</div>
          </div>
        </div>
      )}

      <div className="p-4 pb-0">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-purple-800 text-xs font-bold mb-2">
            <Bot className="w-4 h-4" /> AI AGENT
          </div>
          {selectedImage && (
            <div className="relative mb-2 w-16 h-16 bg-gray-200 rounded-lg overflow-hidden border border-purple-200 group">
              <img
                src={`data:image/png;base64,${selectedImage}`}
                className="w-full h-full object-cover"
                alt="Pasted reference"
              />
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <textarea
            value={agentPrompt}
            onChange={(e) => setAgentPrompt(e.target.value)}
            onPaste={handlePaste}
            placeholder={
              selectedImage
                ? "Describe how to use the image..."
                : `Ask AI to edit this ${selectedElement.type}... (Paste image supported)`
            }
            className="w-full bg-white border border-gray-200 rounded p-2 text-xs text-gray-900 placeholder-gray-400 outline-none focus:border-purple-500 resize-none h-16 mb-2"
          />
          <button
            onClick={handleAgentRun}
            disabled={isAgentRunning || (!agentPrompt.trim() && !selectedImage)}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white py-1.5 rounded text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAgentRunning ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}{" "}
            {isAgentRunning ? "Updating..." : "Generate Changes"}
          </button>
        </div>
      </div>

      {/* Section Theme Selector */}
      {selectedElement.type === "section" && (
        <div className="p-4 pb-3 border-b border-gray-200">
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-indigo-800 text-xs font-bold mb-3">
              <Settings className="w-4 h-4" />
              SECTION THEME
            </div>
            <div className="space-y-2">
              <label className="text-xs text-gray-600">
                Choose a theme for this section
              </label>
              <select
                value={selectedElement.schemeId || currentSchemeId}
                onChange={(e) => {
                  const value = e.target.value;
                  // If selecting the global theme, remove the schemeId
                  if (value === currentSchemeId) {
                    updateElement(selectedElement.id, { schemeId: undefined });
                  } else {
                    updateElement(selectedElement.id, { schemeId: value });
                  }
                }}
                className="w-full bg-white border border-gray-200 rounded p-2 text-sm text-gray-900 outline-none focus:border-indigo-500"
              >
                <option value={currentSchemeId}>
                  Global Theme ({schemes[currentSchemeId]?.name})
                </option>
                {Object.values(schemes)
                  .filter((s: ColorScheme) => s.id !== currentSchemeId)
                  .map((scheme: ColorScheme) => (
                    <option key={scheme.id} value={scheme.id}>
                      {scheme.name}
                    </option>
                  ))}
              </select>
              {selectedElement.schemeId && (
                <div className="flex items-center gap-2 text-xs text-indigo-800 bg-indigo-100 rounded px-2 py-1.5">
                  <Sparkles className="w-3 h-3" />
                  <span>
                    Using custom theme:{" "}
                    {schemes[selectedElement.schemeId]?.name}
                  </span>
                  <button
                    onClick={() =>
                      updateElement(selectedElement.id, { schemeId: undefined })
                    }
                    className="ml-auto text-red-400 hover:text-red-300"
                    title="Reset to global theme"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Change Layout Button for Sections - opens saved section layouts from other pages */}
          <div className="mt-3">
            <button
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("openLayoutSidebar", {
                    detail: { elementId: selectedElement.id },
                  }),
                );
              }}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm"
            >
              <Layout className="w-4 h-4" />
              Change Layout
            </button>
          </div>
        </div>
      )}

      {isCustom &&
        selectedElement.customType &&
        CUSTOM_BLOCKS[selectedElement.customType] && (
          <>
            <div className="px-4 pb-3 mt-3">
              <button
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("openLayoutSidebar", {
                      detail: { elementId: selectedElement.id },
                    }),
                  );
                }}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm"
              >
                <Layout className="w-4 h-4" />
                Change Layout
              </button>
            </div>

            <Accordion
              title="Settings"
              icon={<Blocks className="w-3 h-3" />}
              defaultOpen={true}
            >
              <DynamicSettings
                data={{ ...(selectedElement.data || {}), _device: deviceView }}
                schema={CUSTOM_BLOCKS[selectedElement.customType].settings}
                onChange={(key, val) =>
                  updateElement(selectedElement.id, {
                    data: { ...selectedElement.data, [key]: val },
                  })
                }
              />
            </Accordion>
          </>
        )}

      {!isCustom && (
        <div className="p-4 border-b border-gray-200">
          {selectedElement.type === "icon" && (
            <div className="space-y-3 mb-4">
              <div className="space-y-1">
                <label className="text-xs text-gray-600">Icon</label>
                <IconPicker
                  value={selectedElement.content || "Star"}
                  onChange={(iconName) =>
                    updateElement(selectedElement.id, {
                      content: iconName,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-600">Icon Color</label>
                <div className="flex gap-2 items-center">
                  <div className="relative">
                    <div
                      className="h-8 w-8 rounded border border-gray-200 shadow-sm cursor-pointer hover:border-gray-400 transition-colors"
                      style={{
                        background: selectedElement.style?.color?.includes(
                          "gradient",
                        )
                          ? selectedElement.style?.color
                          : selectedElement.style?.color || "#000000",
                      }}
                      onClick={() =>
                        setGlobalColorPicker({
                          isOpen: true,
                          color:
                            resolveCssVar(
                              typeof selectedElement.style?.color === "string"
                                ? (selectedElement.style?.color as string)
                                : undefined,
                            ) || "#000000",
                          onChange: (newColor) =>
                            updateElement(selectedElement.id, {
                              style: {
                                ...selectedElement.style,
                                color: newColor,
                              },
                            }),
                        })
                      }
                    />
                  </div>
                  <input
                    type="text"
                    value={(() => {
                      const colorVal = selectedElement.style?.color || "";
                      if (colorVal.includes("linear-gradient")) return "Linear";
                      if (colorVal.includes("radial-gradient")) return "Radial";
                      if (colorVal.includes("conic-gradient")) return "Conic";
                      return colorVal;
                    })()}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Don't allow editing gradient type labels
                      if (
                        val === "Linear" ||
                        val === "Radial" ||
                        val === "Conic"
                      )
                        return;
                      updateElement(selectedElement.id, {
                        style: {
                          ...selectedElement.style,
                          color: val,
                        },
                      });
                    }}
                    readOnly={selectedElement.style?.color?.includes(
                      "gradient",
                    )}
                    className="flex-1 bg-white border border-gray-200 rounded px-2 py-2 text-sm text-gray-900 min-w-0"
                    placeholder="#000000"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-600">Icon Size</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="range"
                    min="12"
                    max="120"
                    value={selectedElement.data?.size || 32}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        data: {
                          ...selectedElement.data,
                          size: parseInt(e.target.value),
                        },
                      })
                    }
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <input
                    type="number"
                    min="12"
                    max="120"
                    value={selectedElement.data?.size || 32}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        data: {
                          ...selectedElement.data,
                          size: parseInt(e.target.value),
                        },
                      })
                    }
                    className="w-16 bg-white border border-gray-200 rounded p-2 text-sm text-gray-900 text-center"
                  />
                  <span className="text-xs text-gray-500">px</span>
                </div>
              </div>
            </div>
          )}
          {isText && (
            <div className="space-y-2">
              <label className="text-xs text-gray-600">Content</label>
              <RichTextEditor
                content={selectedElement.content || ""}
                onChange={(html) => {
                  updateElement(selectedElement.id, { content: html });
                }}
                style={
                  {
                    "--task-checkbox-color":
                      selectedElement.style?.["--task-checkbox-color"],
                  } as any
                }
              />
              <button
                onClick={handleAiGeneration}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white py-1.5 px-3 rounded text-xs font-medium"
              >
                <Wand2 className="w-3 h-3" />{" "}
                {isGenerating ? "Thinking..." : "AI Magic Write"}
              </button>

              {selectedElement.content?.includes('data-type="taskItem"') && (
                <div className="flex items-center justify-between p-2 border border-gray-200 rounded bg-gray-50">
                  <span className="text-xs text-gray-600">Checkbox Color</span>
                  <div
                    className="w-6 h-6 rounded border border-gray-200 cursor-pointer shadow-sm hover:border-gray-400 transition-colors"
                    style={{
                      backgroundColor:
                        (selectedElement.style?.[
                          "--task-checkbox-color"
                        ] as string) || "#16a34a",
                    }}
                    onClick={() =>
                      setGlobalColorPicker({
                        isOpen: true,
                        color:
                          (selectedElement.style?.[
                            "--task-checkbox-color"
                          ] as string) || "#16a34a",
                        onChange: (color) =>
                          updateElement(selectedElement.id, {
                            style: {
                              ...selectedElement.style,
                              "--task-checkbox-color": color,
                            } as any,
                          }),
                      })
                    }
                    title="Change checkbox color"
                  />
                </div>
              )}
              {selectedElement.type === "user-checkout" && (
                <div className="pt-4 border-t border-gray-200 mt-4">
                  <label className="text-xs text-gray-600 mb-2 block">
                    Checkout Role
                  </label>
                  <select
                    value={selectedElement.data?.role || ""}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        data: {
                          ...selectedElement.data,
                          role: e.target.value,
                        },
                      })
                    }
                    className="w-full bg-white border border-gray-200 rounded px-2 py-2 text-xs text-gray-900 focus:outline-none"
                  >
                    <option value="">Default</option>
                    <option value="legacy">Legacy</option>
                    <option value="multiple">Multiple</option>
                  </select>
                </div>
              )}
              {["button"].includes(selectedElement.type) && (
                <div className="space-y-2 p-3 bg-gray-50 rounded border border-gray-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600 font-medium">
                      Icon
                    </label>
                    <button
                      onClick={() => {
                        const bd = selectedElement.data || {};
                        const currentlyHasIcon = !!(
                          bd.showIconBefore || bd.showIconAfter
                        );
                        const currentPos = bd.showIconAfter
                          ? "after"
                          : "before";
                        const currentIcon =
                          bd.iconBefore || bd.iconAfter || "ArrowRight";

                        updateElement(selectedElement.id, {
                          data: {
                            ...bd,
                            showIconBefore: !currentlyHasIcon
                              ? currentPos === "before"
                              : false,
                            showIconAfter: !currentlyHasIcon
                              ? currentPos === "after"
                              : false,
                            iconBefore: currentIcon,
                            iconAfter: currentIcon,
                          },
                        });
                      }}
                      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                        selectedElement.data?.showIconBefore ||
                        selectedElement.data?.showIconAfter
                          ? "bg-blue-600"
                          : "bg-gray-200"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          selectedElement.data?.showIconBefore ||
                          selectedElement.data?.showIconAfter
                            ? "translate-x-2.5"
                            : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {(selectedElement.data?.showIconBefore ||
                    selectedElement.data?.showIconAfter) && (
                    <>
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-gray-600">
                          Position
                        </label>
                        <div className="flex bg-white rounded border border-gray-200 p-0.5">
                          <button
                            onClick={() => {
                              const bd = selectedElement.data || {};
                              const currentIcon =
                                bd.iconBefore || bd.iconAfter || "ArrowRight";
                              updateElement(selectedElement.id, {
                                data: {
                                  ...bd,
                                  showIconBefore: true,
                                  showIconAfter: false,
                                  iconBefore: currentIcon,
                                  iconAfter: currentIcon,
                                },
                              });
                            }}
                            className={`px-3 py-1 text-xs rounded-sm transition-colors ${
                              selectedElement.data?.showIconBefore
                                ? "bg-blue-50 text-blue-600 font-medium"
                                : "text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            Left
                          </button>
                          <button
                            onClick={() => {
                              const bd = selectedElement.data || {};
                              const currentIcon =
                                bd.iconBefore || bd.iconAfter || "ArrowRight";
                              updateElement(selectedElement.id, {
                                data: {
                                  ...bd,
                                  showIconBefore: false,
                                  showIconAfter: true,
                                  iconBefore: currentIcon,
                                  iconAfter: currentIcon,
                                },
                              });
                            }}
                            className={`px-3 py-1 text-xs rounded-sm transition-colors ${
                              selectedElement.data?.showIconAfter
                                ? "bg-blue-50 text-blue-600 font-medium"
                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            Right
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="w-full">
                          <IconPicker
                            value={
                              selectedElement.data?.iconBefore ||
                              selectedElement.data?.iconAfter ||
                              "ArrowRight"
                            }
                            onChange={(iconName) => {
                              const bd = selectedElement.data || {};
                              updateElement(selectedElement.id, {
                                data: {
                                  ...bd,
                                  iconBefore: iconName,
                                  iconAfter: iconName,
                                },
                              });
                            }}
                            hideName={true}
                          />
                        </div>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600">Icon Size</label>
                    <div className="flex items-center gap-2 w-64">
                      <input
                        type="range"
                        min="12"
                        max="64"
                        value={selectedElement.data?.iconSize ?? 18}
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            data: {
                              ...selectedElement.data,
                              iconSize: parseInt(e.target.value),
                            },
                          })
                        }
                        className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <input
                        type="number"
                        min="8"
                        max="64"
                        value={selectedElement.data?.iconSize ?? 18}
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            data: {
                              ...selectedElement.data,
                              iconSize: parseInt(e.target.value),
                            },
                          })
                        }
                        className="w-16 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-900 text-center"
                      />
                      <span className="text-xs text-gray-500">px</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600">Icon Gap</label>
                    <div className="flex items-center gap-2 w-64">
                      <input
                        type="range"
                        min="0"
                        max="32"
                        value={selectedElement.data?.iconGap ?? 8}
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            data: {
                              ...selectedElement.data,
                              iconGap: parseInt(e.target.value),
                            },
                          })
                        }
                        className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <input
                        type="number"
                        min="0"
                        max="32"
                        value={selectedElement.data?.iconGap ?? 8}
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            data: {
                              ...selectedElement.data,
                              iconGap: parseInt(e.target.value),
                            },
                          })
                        }
                        className="w-16 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-900 text-center"
                      />
                      <span className="text-xs text-gray-500">px</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600">Icon Color</label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 h-[30px] bg-white border border-gray-200 rounded px-2">
                        <div className="relative">
                          <div
                            className="w-5 h-5 rounded border border-gray-200 shadow-sm cursor-pointer hover:border-gray-400 transition-colors"
                            style={{
                              background: (() => {
                                const iconCol =
                                  selectedElement.data?.iconColor ||
                                  selectedElement.style?.color ||
                                  "#000000";
                                if (String(iconCol).includes("gradient"))
                                  return iconCol;
                                return (
                                  resolveCssVar(String(iconCol)) || "#000000"
                                );
                              })(),
                            }}
                            onClick={() =>
                              setActiveColorPicker(
                                activeColorPicker === "button-icon-color"
                                  ? null
                                  : "button-icon-color",
                              )
                            }
                          />
                          {activeColorPicker === "button-icon-color" && (
                            <ColorPicker
                              color={
                                resolveCssVar(
                                  String(
                                    selectedElement.data?.iconColor ||
                                      selectedElement.style?.color ||
                                      "#000000",
                                  ),
                                ) || "#000000"
                              }
                              onChange={(newColor) =>
                                updateElement(selectedElement.id, {
                                  data: {
                                    ...selectedElement.data,
                                    iconColor: newColor,
                                  },
                                })
                              }
                              onClose={() => setActiveColorPicker(null)}
                              presetColors={presetColors}
                            />
                          )}
                        </div>
                        <span className="text-xs text-gray-500 font-mono">
                          {(() => {
                            const s =
                              String(
                                selectedElement.data?.iconColor ||
                                  selectedElement.style?.color ||
                                  "",
                              ) || "";
                            if (s.includes("linear-gradient")) return "Linear";
                            if (s.includes("radial-gradient")) return "Radial";
                            if (s.includes("conic-gradient")) return "Conic";

                            const resolved = resolveCssVar(s);
                            if (resolved && /^#[0-9a-f]{3,8}$/i.test(resolved))
                              return resolved.toUpperCase();
                            return resolved || s;
                          })()}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          updateElement(selectedElement.id, {
                            data: { ...selectedElement.data, iconColor: "" },
                          })
                        }
                        title="Clear Icon Color"
                        className="text-xs text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600">
                      Button BG Color
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 h-[30px] bg-white border border-gray-200 rounded px-2">
                        <div className="relative">
                          <div
                            className="w-5 h-5 rounded border border-gray-200 shadow-sm cursor-pointer hover:border-gray-400 transition-colors"
                            style={{
                              background: (() => {
                                const bgCol =
                                  getStyle("backgroundColor") || "#000000";
                                if (String(bgCol).includes("gradient"))
                                  return bgCol;
                                return (
                                  resolveCssVar(String(bgCol)) || "#000000"
                                );
                              })(),
                            }}
                            onClick={() =>
                              setActiveColorPicker(
                                activeColorPicker === "button-bg-color"
                                  ? null
                                  : "button-bg-color",
                              )
                            }
                          />
                          {activeColorPicker === "button-bg-color" && (
                            <ColorPicker
                              color={
                                resolveCssVar(
                                  String(
                                    getStyle("backgroundColor") || "#000000",
                                  ),
                                ) || "#000000"
                              }
                              onChange={(newColor) =>
                                setStyle("backgroundColor", newColor)
                              }
                              onClose={() => setActiveColorPicker(null)}
                              presetColors={presetColors}
                            />
                          )}
                        </div>
                        <span className="text-xs text-gray-500 font-mono">
                          {(() => {
                            const s = String(getStyle("backgroundColor") || "");
                            if (s.includes("linear-gradient")) return "Linear";
                            if (s.includes("radial-gradient")) return "Radial";
                            if (s.includes("conic-gradient")) return "Conic";

                            const resolved = resolveCssVar(s);
                            if (resolved && /^#[0-9a-f]{3,8}$/i.test(resolved))
                              return resolved.toUpperCase();
                            return resolved || s;
                          })()}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          setStyle("backgroundColor", "transparent")
                        }
                        title="Clear Button Color"
                        className="text-xs text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200 mt-4">
                    <label className="text-xs text-gray-600 mb-2 block">
                      Click Action
                    </label>
                    <select
                      value={selectedElement.data?.onClick || ""}
                      onChange={(e) =>
                        updateElement(selectedElement.id, {
                          data: {
                            ...selectedElement.data,
                            onClick: e.target.value,
                          },
                        })
                      }
                      className="w-full bg-white border border-gray-200 rounded px-2 py-2 text-xs text-gray-900 focus:outline-none mb-3"
                    >
                      <option value="">Select Action</option>
                      <option value="scroll_to_checkout">
                        Scroll to Checkout
                      </option>
                      <option value="url_redirect">Redirect to URL</option>
                      <option value="custom_function">Custom Function</option>
                    </select>

                    {selectedElement.data?.onClick === "url_redirect" && (
                      <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                        <label className="text-xs text-gray-500">
                          Destination URL
                        </label>
                        <input
                          type="text"
                          value={selectedElement.data?.redirectUrl || ""}
                          onChange={(e) =>
                            updateElement(selectedElement.id, {
                              data: {
                                ...selectedElement.data,
                                redirectUrl: e.target.value,
                              },
                            })
                          }
                          className="w-full bg-white border border-gray-200 rounded px-2 py-2 text-xs text-gray-900"
                          placeholder="https://example.com"
                        />
                      </div>
                    )}

                    {selectedElement.data?.onClick === "custom_function" && (
                      <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                        <label className="text-xs text-gray-500">
                          Function Name
                        </label>
                        <input
                          type="text"
                          value={selectedElement.data?.customFunction || ""}
                          onChange={(e) =>
                            updateElement(selectedElement.id, {
                              data: {
                                ...selectedElement.data,
                                customFunction: e.target.value,
                              },
                            })
                          }
                          className="w-full bg-white border border-gray-200 rounded px-2 py-2 text-xs text-gray-900"
                          placeholder="e.g. handleMyClick"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {selectedElement.type === "input" && (
            <div className="space-y-2">
              <label className="text-xs text-gray-500">Placeholder</label>
              <input
                type="text"
                className="w-full bg-white border border-gray-200 rounded p-2 text-sm text-gray-900"
                value={selectedElement.placeholder || ""}
                onChange={(e) =>
                  updateElement(selectedElement.id, {
                    placeholder: e.target.value,
                  })
                }
              />
            </div>
          )}
          {selectedElement.type === "image" && (
            <div className="space-y-2">
              <label className="text-xs text-gray-500">Image URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="w-full bg-white border border-gray-200 rounded p-2 text-sm text-gray-900"
                  value={imageGetUrl(selectedElement.src) || ""}
                  onChange={(e) =>
                    updateElement(selectedElement.id, {
                      src: imageGetUrl(e.target.value),
                    })
                  }
                />
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="p-2 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 flex-shrink-0"
                  title="Upload Image"
                >
                  <Upload className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
          )}
          {Array.isArray(selectedElement.data?.images) && (
            <div className="space-y-2">
              <label className="text-xs text-gray-500">
                Image Carousel Slides (Upload)
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 text-xs"
                >
                  Upload & Add Slide
                </button>
              </div>
            </div>
          )}
          {Array.isArray(selectedElement.data?.items) && (
            <div className="space-y-2">
              <label className="text-xs text-gray-500">
                Gallery Items (Upload)
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 text-xs"
                >
                  Upload Images
                </button>
              </div>
            </div>
          )}
          {Array.isArray(selectedElement.data?.slides) && (
            <div className="space-y-2">
              <label className="text-xs text-gray-500">
                Hero Slider Slides (Upload)
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 text-xs"
                >
                  Upload & Add Slide
                </button>
              </div>
            </div>
          )}

          {selectedElement.type === "video" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-gray-500">Video URL</label>
                <input
                  type="text"
                  className="w-full bg-white border border-gray-200 rounded p-2 text-sm text-gray-900"
                  placeholder="https://youtube.com/..."
                  value={selectedElement.data?.videoUrl || ""}
                  onChange={(e) =>
                    updateElement(selectedElement.id, {
                      data: {
                        ...selectedElement.data,
                        videoUrl: e.target.value,
                      },
                    })
                  }
                />
                <p className="text-[10px] text-gray-500">
                  Supports YouTube, Vimeo, and direct links.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-500">Show Controls</label>
                <button
                  onClick={() =>
                    updateElement(selectedElement.id, {
                      data: {
                        ...selectedElement.data,
                        showControls: !(
                          selectedElement.data?.showControls !== false
                        ),
                      },
                    })
                  }
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    selectedElement.data?.showControls !== false
                      ? "bg-blue-600"
                      : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                      selectedElement.data?.showControls !== false
                        ? "translate-x-5"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isContainer && (
        <Accordion
          title="Layout"
          icon={<Layout className="w-3 h-3" />}
          defaultOpen={true}
        >
          {selectedElement.type === "row" && (
            <button
              onClick={() => {
                const newId = `col-${Date.now()}`;
                updateElement(selectedElement.id, {
                  children: [
                    ...(selectedElement.children || []),
                    {
                      id: newId,
                      type: "col",
                      name: "Col",
                      style: {
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                        minHeight: "50px",
                      },
                      children: [],
                    },
                  ],
                });
                setSelectedId(newId);
              }}
              className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 py-1.5 px-3 rounded text-xs mb-4 hover:bg-gray-50"
            >
              <Plus className="w-3 h-3" /> Add Column
            </button>
          )}
          <div className="mb-4">
            <label className="text-xs text-gray-500 block mb-1">Display</label>
            <div className="grid grid-cols-3 gap-2">
              {["block", "flex", "grid"].map((d) => (
                <button
                  key={d}
                  onClick={() => setStyle("display", d)}
                  className={`text-xs py-1.5 px-2 rounded capitalize border transition-colors ${
                    getStyle("display") === d
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-gray-200 text-gray-500 hover:border-gray-400"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          {getStyle("display") === "flex" && (
            <div className="space-y-4 p-3 bg-gray-50 rounded border border-gray-200">
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-500">Direction</label>
                <div className="flex bg-white rounded border border-gray-200 p-0.5">
                  <button
                    onClick={() => setStyle("flexDirection", "row")}
                    className={`p-1.5 rounded ${
                      getStyle("flexDirection") !== "column"
                        ? "bg-gray-200 text-gray-900"
                        : "text-gray-500"
                    }`}
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setStyle("flexDirection", "column")}
                    className={`p-1.5 rounded ${
                      getStyle("flexDirection") === "column"
                        ? "bg-gray-200 text-gray-900"
                        : "text-gray-500"
                    }`}
                  >
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Justify
                </label>
                <select
                  value={(getStyle("justifyContent") as string) || "flex-start"}
                  onChange={(e) => setStyle("justifyContent", e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-900 focus:outline-none"
                >
                  <option value="flex-start">Start</option>
                  <option value="center">Center</option>
                  <option value="flex-end">End</option>
                  <option value="space-between">Space Between</option>
                  <option value="space-around">Space Around</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-500">Align</label>
                <div className="flex bg-white rounded border border-gray-200 p-0.5">
                  <button
                    onClick={() => setStyle("alignItems", "flex-start")}
                    className={`p-1.5 rounded ${
                      getStyle("alignItems") === "flex-start"
                        ? "bg-gray-200 text-gray-900"
                        : "text-gray-500"
                    }`}
                  >
                    <AlignLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setStyle("alignItems", "center")}
                    className={`p-1.5 rounded ${
                      getStyle("alignItems") === "center"
                        ? "bg-gray-200 text-gray-900"
                        : "text-gray-500"
                    }`}
                  >
                    <AlignCenter className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setStyle("alignItems", "flex-end")}
                    className={`p-1.5 rounded ${
                      getStyle("alignItems") === "flex-end"
                        ? "bg-gray-200 text-gray-900"
                        : "text-gray-500"
                    }`}
                  >
                    <AlignRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setStyle("alignItems", "stretch")}
                    className={`p-1.5 rounded ${
                      getStyle("alignItems") === "stretch" ||
                      !getStyle("alignItems")
                        ? "bg-gray-200 text-gray-900"
                        : "text-gray-500"
                    }`}
                  >
                    <Maximize className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-500">Wrap</label>
                <div className="flex bg-white rounded border border-gray-200 text-xs overflow-hidden">
                  <button
                    onClick={() => setStyle("flexWrap", "wrap")}
                    className={`px-3 py-1 ${
                      getStyle("flexWrap") === "wrap"
                        ? "bg-blue-600 text-white"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setStyle("flexWrap", "nowrap")}
                    className={`px-3 py-1 ${
                      getStyle("flexWrap") !== "wrap"
                        ? "bg-gray-200 text-gray-900"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-gray-600">Gap</label>
                  <span className="text-xs text-gray-500">
                    {getStyle("gap") || "0px"}
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={
                      parseInt(
                        String(getStyle("gap") || "0").replace("px", ""),
                      ) || 0
                    }
                    onChange={(e) => setStyle("gap", `${e.target.value}px`)}
                    className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <input
                    type="text"
                    value={getStyle("gap") || ""}
                    onChange={(e) => setStyle("gap", e.target.value)}
                    className="w-16 bg-white border border-gray-200 rounded px-1 py-0.5 text-xs text-right text-gray-900"
                    placeholder="0px"
                  />
                </div>
              </div>
            </div>
          )}

          {selectedElement.type === "col" && (
            <div className="space-y-3 p-3 mt-3 bg-gray-50 rounded border border-gray-200">
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-600">
                  Card Layout (Container)
                </label>
                <div className="flex bg-white rounded border border-gray-200 p-0.5">
                  {(["grid", "carousel"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() =>
                        updateElement(selectedElement.id, {
                          data: {
                            ...selectedElement.data,
                            containerLayout: mode,
                          },
                        })
                      }
                      className={`px-3 py-1 rounded text-xs capitalize ${
                        (selectedElement.data?.containerLayout || "grid") ===
                        mode
                          ? "bg-gray-200 text-gray-900"
                          : "text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-600">Mobile Layout</label>
                <div className="flex bg-white rounded border border-gray-200 p-0.5">
                  {(["grid", "carousel"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() =>
                        updateElement(selectedElement.id, {
                          data: {
                            ...selectedElement.data,
                            mobileContainerLayout: mode,
                          },
                        })
                      }
                      className={`px-3 py-1 rounded text-xs capitalize ${
                        (selectedElement.data?.mobileContainerLayout ||
                          selectedElement.data?.containerLayout ||
                          "grid") === mode
                          ? "bg-gray-200 text-gray-900"
                          : "text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {(selectedElement.data?.containerLayout === "carousel" ||
                selectedElement.data?.mobileContainerLayout === "carousel") && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600">
                      Slides (Desktop)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={1}
                        max={6}
                        value={selectedElement.data?.slidesPerViewDesktop || 3}
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            data: {
                              ...selectedElement.data,
                              slidesPerViewDesktop: parseInt(e.target.value),
                            },
                          })
                        }
                        className="h-1 bg-gray-200 rounded appearance-none w-32"
                      />
                      <input
                        type="number"
                        min={1}
                        max={6}
                        value={selectedElement.data?.slidesPerViewDesktop || 3}
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            data: {
                              ...selectedElement.data,
                              slidesPerViewDesktop: parseInt(e.target.value),
                            },
                          })
                        }
                        className="w-12 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-right text-gray-900"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600">
                      Slides (Mobile)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={1}
                        max={3}
                        value={selectedElement.data?.slidesPerViewMobile || 1}
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            data: {
                              ...selectedElement.data,
                              slidesPerViewMobile: parseInt(e.target.value),
                            },
                          })
                        }
                        className="h-1 bg-gray-200 rounded appearance-none w-32"
                      />
                      <input
                        type="number"
                        min={1}
                        max={3}
                        value={selectedElement.data?.slidesPerViewMobile || 1}
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            data: {
                              ...selectedElement.data,
                              slidesPerViewMobile: parseInt(e.target.value),
                            },
                          })
                        }
                        className="w-12 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-right text-gray-900"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600">Autoplay</label>
                    <button
                      onClick={() =>
                        updateElement(selectedElement.id, {
                          data: {
                            ...selectedElement.data,
                            enableAutoplay:
                              !selectedElement.data?.enableAutoplay,
                          },
                        })
                      }
                      role="switch"
                      aria-checked={!!selectedElement.data?.enableAutoplay}
                      className={`w-8 h-4 rounded-full transition-colors duration-200 ease-in-out relative ${
                        selectedElement.data?.enableAutoplay
                          ? "bg-blue-600"
                          : "bg-gray-200"
                      }`}
                    >
                      <div
                        className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-200 ease-in-out"
                        style={{
                          transform: selectedElement.data?.enableAutoplay
                            ? "translateX(1rem)"
                            : "translateX(0)",
                        }}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-500">
                      Autoplay Speed (ms)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={1000}
                        max={8000}
                        step={500}
                        value={selectedElement.data?.autoplayInterval || 3000}
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            data: {
                              ...selectedElement.data,
                              autoplayInterval: parseInt(e.target.value),
                            },
                          })
                        }
                        className="h-1 bg-gray-700 rounded appearance-none w-32"
                      />
                      <input
                        type="number"
                        min={1000}
                        max={8000}
                        step={100}
                        value={selectedElement.data?.autoplayInterval || 3000}
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            data: {
                              ...selectedElement.data,
                              autoplayInterval: parseInt(e.target.value),
                            },
                          })
                        }
                        className="w-16 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-right text-gray-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-500">
                    Grid Columns (Desktop)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={1}
                      max={6}
                      value={selectedElement.data?.gridColumnsDesktop || 3}
                      onChange={(e) =>
                        updateElement(selectedElement.id, {
                          data: {
                            ...selectedElement.data,
                            gridColumnsDesktop: parseInt(e.target.value),
                          },
                        })
                      }
                      className="h-1 bg-gray-700 rounded appearance-none w-32"
                    />
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={selectedElement.data?.gridColumnsDesktop || 3}
                      onChange={(e) =>
                        updateElement(selectedElement.id, {
                          data: {
                            ...selectedElement.data,
                            gridColumnsDesktop: parseInt(e.target.value),
                          },
                        })
                      }
                      className="w-12 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-right text-gray-900"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-500">
                    Grid Columns (Mobile)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={1}
                      max={3}
                      value={selectedElement.data?.gridColumnsMobile || 1}
                      onChange={(e) =>
                        updateElement(selectedElement.id, {
                          data: {
                            ...selectedElement.data,
                            gridColumnsMobile: parseInt(e.target.value),
                          },
                        })
                      }
                      className="h-1 bg-gray-700 rounded appearance-none w-32"
                    />
                    <input
                      type="number"
                      min={1}
                      max={3}
                      value={selectedElement.data?.gridColumnsMobile || 1}
                      onChange={(e) =>
                        updateElement(selectedElement.id, {
                          data: {
                            ...selectedElement.data,
                            gridColumnsMobile: parseInt(e.target.value),
                          },
                        })
                      }
                      className="w-12 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-right text-gray-900"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedElement.type === "row" && (
            <div className="space-y-3 p-3 mt-3 bg-gray-50 rounded border border-gray-200">
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-500">
                  Row Layout (Children)
                </label>
                <div className="flex bg-white rounded border border-gray-200 p-0.5">
                  {(["grid", "carousel"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() =>
                        updateElement(selectedElement.id, {
                          data: {
                            ...selectedElement.data,
                            rowContainerLayout: mode,
                          },
                        })
                      }
                      className={`px-3 py-1 rounded text-xs capitalize ${
                        (selectedElement.data?.rowContainerLayout || "grid") ===
                        mode
                          ? "bg-gray-100 text-gray-900"
                          : "text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-500">Mobile Layout</label>
                <div className="flex bg-white rounded border border-gray-200 p-0.5">
                  {(["grid", "carousel"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() =>
                        updateElement(selectedElement.id, {
                          data: {
                            ...selectedElement.data,
                            mobileRowContainerLayout: mode,
                          },
                        })
                      }
                      className={`px-3 py-1 rounded text-xs capitalize ${
                        (selectedElement.data?.mobileRowContainerLayout ||
                          selectedElement.data?.rowContainerLayout ||
                          "grid") === mode
                          ? "bg-gray-100 text-gray-900"
                          : "text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {(selectedElement.data?.rowContainerLayout === "carousel" ||
                selectedElement.data?.mobileRowContainerLayout ===
                  "carousel") && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-500">
                      Slides (Desktop)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={1}
                        max={6}
                        value={
                          selectedElement.data?.rowSlidesPerViewDesktop || 3
                        }
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            data: {
                              ...selectedElement.data,
                              rowSlidesPerViewDesktop: parseInt(e.target.value),
                            },
                          })
                        }
                        className="h-1 bg-gray-700 rounded appearance-none w-32"
                      />
                      <input
                        type="number"
                        min={1}
                        max={6}
                        value={
                          selectedElement.data?.rowSlidesPerViewDesktop || 3
                        }
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            data: {
                              ...selectedElement.data,
                              rowSlidesPerViewDesktop: parseInt(e.target.value),
                            },
                          })
                        }
                        className="w-12 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-right text-gray-900"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-500">
                      Slides (Mobile)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={1}
                        max={3}
                        value={
                          selectedElement.data?.rowSlidesPerViewMobile || 1
                        }
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            data: {
                              ...selectedElement.data,
                              rowSlidesPerViewMobile: parseInt(e.target.value),
                            },
                          })
                        }
                        className="h-1 bg-gray-700 rounded appearance-none w-32"
                      />
                      <input
                        type="number"
                        min={1}
                        max={3}
                        value={
                          selectedElement.data?.rowSlidesPerViewMobile || 1
                        }
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            data: {
                              ...selectedElement.data,
                              rowSlidesPerViewMobile: parseInt(e.target.value),
                            },
                          })
                        }
                        className="w-12 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-right text-gray-900"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-500">Autoplay</label>
                    <button
                      onClick={() =>
                        updateElement(selectedElement.id, {
                          data: {
                            ...selectedElement.data,
                            enableAutoplay:
                              !selectedElement.data?.enableAutoplay,
                          },
                        })
                      }
                      role="switch"
                      aria-checked={!!selectedElement.data?.enableAutoplay}
                      className={`w-8 h-4 rounded-full transition-colors duration-200 ease-in-out relative ${
                        selectedElement.data?.enableAutoplay
                          ? "bg-blue-600"
                          : "bg-gray-700"
                      }`}
                    >
                      <div
                        className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-200 ease-in-out"
                        style={{
                          transform: selectedElement.data?.enableAutoplay
                            ? "translateX(1rem)"
                            : "translateX(0)",
                        }}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-500">
                      Autoplay Speed (ms)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={1000}
                        max={8000}
                        step={500}
                        value={selectedElement.data?.autoplayInterval || 3000}
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            data: {
                              ...selectedElement.data,
                              autoplayInterval: parseInt(e.target.value),
                            },
                          })
                        }
                        className="h-1 bg-gray-700 rounded appearance-none w-32"
                      />
                      <input
                        type="number"
                        min={1000}
                        max={8000}
                        step={100}
                        value={selectedElement.data?.autoplayInterval || 3000}
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            data: {
                              ...selectedElement.data,
                              autoplayInterval: parseInt(e.target.value),
                            },
                          })
                        }
                        className="w-16 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-right text-gray-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-600">
                    Grid Columns (Desktop)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={1}
                      max={6}
                      value={selectedElement.data?.rowGridColumnsDesktop || 3}
                      onChange={(e) =>
                        updateElement(selectedElement.id, {
                          data: {
                            ...selectedElement.data,
                            rowGridColumnsDesktop: parseInt(e.target.value),
                          },
                        })
                      }
                      className="h-1 bg-gray-200 rounded appearance-none w-32"
                    />
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={selectedElement.data?.rowGridColumnsDesktop || 3}
                      onChange={(e) =>
                        updateElement(selectedElement.id, {
                          data: {
                            ...selectedElement.data,
                            rowGridColumnsDesktop: parseInt(e.target.value),
                          },
                        })
                      }
                      className="w-12 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-right text-gray-900"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-600">
                    Grid Columns (Mobile)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={1}
                      max={3}
                      value={selectedElement.data?.rowGridColumnsMobile || 1}
                      onChange={(e) =>
                        updateElement(selectedElement.id, {
                          data: {
                            ...selectedElement.data,
                            rowGridColumnsMobile: parseInt(e.target.value),
                          },
                        })
                      }
                      className="h-1 bg-gray-200 rounded appearance-none w-32"
                    />
                    <input
                      type="number"
                      min={1}
                      max={3}
                      value={selectedElement.data?.rowGridColumnsMobile || 1}
                      onChange={(e) =>
                        updateElement(selectedElement.id, {
                          data: {
                            ...selectedElement.data,
                            rowGridColumnsMobile: parseInt(e.target.value),
                          },
                        })
                      }
                      className="w-12 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-right text-gray-900"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </Accordion>
      )}

      <Accordion title="Position" icon={<Anchor className="w-3 h-3" />}>
        <PositionControl
          style={
            isMobile
              ? selectedElement.mobileStyle || {}
              : isTablet
                ? selectedElement.tabletStyle || {}
                : selectedElement.style
          }
          onChange={setStyle}
        />
      </Accordion>
      <Accordion title="Transforms" icon={<Move3d className="w-3 h-3" />}>
        <TransformControl
          style={
            isMobile
              ? selectedElement.mobileStyle || {}
              : isTablet
                ? selectedElement.tabletStyle || {}
                : selectedElement.style
          }
          onChange={setStyle}
        />
      </Accordion>

      {isText && (
        <Accordion
          title="Typography"
          icon={<Type className="w-3 h-3" />}
          defaultOpen={true}
          onRemove={() => {
            setStyle("fontFamily", undefined);
            setStyle("fontSize", undefined);
            setStyle("fontWeight", undefined);
            setStyle("lineHeight", undefined);
            setStyle("letterSpacing", undefined);
            setStyle("color", undefined);
          }}
        >
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-600">Font Family</label>
              <select
                value={(getStyle("fontFamily") as string) || "Inter"}
                onChange={(e) => setStyle("fontFamily", e.target.value)}
                className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-900"
              >
                <option value="Inter">Inter</option>
                <option value="'Roboto', sans-serif">Roboto</option>
                <option value="'Open Sans', sans-serif">Open Sans</option>
                <option value="'Lato', sans-serif">Lato</option>
                <option value="'Montserrat', sans-serif">Montserrat</option>
                <option value="'Source Sans 3', sans-serif">
                  Source Sans 3
                </option>
                <option value="'Ubuntu', sans-serif">Ubuntu</option>
                <option value="'Quicksand', sans-serif">Quicksand</option>
                <option value="'Work Sans', sans-serif">Work Sans</option>
                <option value="'Playfair Display', serif">
                  Playfair Display
                </option>
                <option value="'Merriweather', serif">Merriweather</option>
                <option value="'Lora', serif">Lora</option>
                <option value="'PT Serif', serif">PT Serif</option>
                <option value="'Libre Baskerville', serif">
                  Libre Baskerville
                </option>
                <option value="'Nunito', sans-serif">Nunito</option>
                <option value="'Raleway', sans-serif">Raleway</option>
                <option value="'Poppins', sans-serif">Poppins</option>
                <option value="'Oswald', sans-serif">Oswald</option>
                <option value="'Pacifico', cursive">Pacifico</option>
                <option value="'Dancing Script', cursive">
                  Dancing Script
                </option>
                <option value="'Roboto Mono', monospace">Roboto Mono</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="'Times New Roman', serif">
                  Times New Roman
                </option>
                <option value="Georgia, serif">Georgia</option>
                <option value="Verdana, sans-serif">Verdana</option>
                <option value="'Courier New', monospace">Courier New</option>
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-gray-500">Weight</label>
                <select
                  value={(getStyle("fontWeight") as string) || "400"}
                  onChange={(e) => setStyle("fontWeight", e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-900"
                >
                  <option value="400">Normal</option>
                  <option value="500">Medium</option>
                  <option value="600">Semibold</option>
                  <option value="700">Bold</option>
                </select>
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-gray-600">Color</label>
                <div className="flex items-center gap-2 h-[30px] bg-white border border-gray-200 rounded px-2">
                  <div className="relative">
                    <div
                      className="w-5 h-5 rounded border border-[#27272a] shadow-sm cursor-pointer hover:border-gray-500 transition-colors"
                      style={{
                        background: (
                          getStyle("backgroundImage") as string
                        )?.includes("gradient")
                          ? (getStyle("backgroundImage") as string)
                          : (getStyle("color") as string) || "#000000",
                      }}
                      onClick={() =>
                        setGlobalColorPicker({
                          isOpen: true,
                          color:
                            resolveCssVar(
                              (getStyle("backgroundImage") as string)?.includes(
                                "gradient",
                              )
                                ? (getStyle("backgroundImage") as string)
                                : typeof getStyle("color") === "string"
                                  ? (getStyle("color") as string)
                                  : undefined,
                            ) || "#000000",
                          onChange: (newColor) => {
                            const target = isMobile ? "mobileStyle" : isTablet ? "tabletStyle" : "style";
                            const currentStyle = isMobile
                              ? selectedElement.mobileStyle || {}
                              : isTablet
                                ? selectedElement.tabletStyle || {}
                                : selectedElement.style || {};

                            if (newColor.includes("gradient")) {
                              updateElement(selectedElement.id, {
                                [target]: {
                                  ...currentStyle,
                                  backgroundImage: newColor,
                                  backgroundClip: "text",
                                  WebkitBackgroundClip: "text",
                                  color: "transparent",
                                  WebkitTextFillColor: "transparent",
                                },
                              });
                            } else {
                              // If switching back to solid, we must remove gradient props
                              const {
                                backgroundImage,
                                backgroundClip,
                                WebkitBackgroundClip,
                                WebkitTextFillColor,
                                ...rest
                              } = currentStyle as any;

                              updateElement(selectedElement.id, {
                                [target]: {
                                  ...rest,
                                  color: newColor,
                                },
                              });
                            }
                          },
                        })
                      }
                    />
                  </div>
                  <span className="text-xs text-gray-500 font-mono">
                    {(() => {
                      const bg = getStyle("backgroundImage") as string;
                      if (bg?.includes("linear-gradient")) return "Linear";
                      if (bg?.includes("radial-gradient")) return "Radial";
                      if (bg?.includes("conic-gradient")) return "Conic";

                      const v = getStyle("color");
                      if (!v || v === "transparent") return "";
                      const s = String(v);
                      const resolved = resolveCssVar(s);

                      try {
                        return colord(resolved || s)
                          .toHex()
                          .toUpperCase();
                      } catch (e) {
                        if (resolved && /^#/.test(resolved))
                          return resolved.toUpperCase();
                        return resolved || s;
                      }
                    })()}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <label className="text-xs text-gray-500">Size</label>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={parseFloat(String(getStyle("fontSize") || "16"))}
                  onChange={(e) => {
                    const currentUnit =
                      String(getStyle("fontSize") || "16px").replace(
                        /[0-9.]/g,
                        "",
                      ) || "px";
                    setStyle("fontSize", `${e.target.value}${currentUnit}`);
                  }}
                  className="flex-1 bg-white border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-900"
                  placeholder="16"
                />
                <select
                  value={
                    String(getStyle("fontSize") || "16px").replace(
                      /[0-9.]/g,
                      "",
                    ) || "px"
                  }
                  onChange={(e) => {
                    const currentVal = parseFloat(
                      String(getStyle("fontSize") || "16"),
                    );
                    setStyle("fontSize", `${currentVal}${e.target.value}`);
                  }}
                  className="bg-white border border-gray-200 rounded px-1 text-xs text-gray-900"
                >
                  <option value="px">px</option>
                  <option value="rem">rem</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Align</label>
              <div className="flex bg-white rounded border border-gray-200 p-0.5">
                {["left", "center", "right", "justify"].map((align) => (
                  <button
                    key={align}
                    onClick={() => setStyle("textAlign", align)}
                    className={`flex-1 py-1 rounded flex items-center justify-center ${
                      getStyle("textAlign") === align
                        ? "bg-gray-200 text-gray-900"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    {align === "left" && <AlignLeft className="w-3 h-3" />}
                    {align === "center" && <AlignCenter className="w-3 h-3" />}
                    {align === "right" && <AlignRight className="w-3 h-3" />}
                    {align === "justify" && (
                      <AlignJustify className="w-3 h-3" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Accordion>
      )}

      {isMedia && (
        <Accordion title="Media" icon={<ImageIcon className="w-3 h-3" />}>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Object Fit</label>
              <div className="grid grid-cols-3 gap-2">
                {["fill", "contain", "cover"].map((fit) => (
                  <button
                    key={fit}
                    onClick={() => setStyle("objectFit", fit)}
                    className={`text-xs py-1.5 border rounded capitalize ${
                      getStyle("objectFit") === fit
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-gray-200 text-gray-500"
                    }`}
                  >
                    {fit}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Opacity</label>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(Number(getStyle("opacity") ?? 1) * 100)}
                onChange={(e) =>
                  setStyle("opacity", Number(e.target.value) / 100)
                }
                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </Accordion>
      )}

      <Accordion title="Size" icon={<Maximize className="w-3 h-3" />}>
        <SizeInput
          label="Width"
          value={getStyle("width")}
          onChange={(v) => setStyle("width", v)}
          onDelete={
            getStyle("width") ? () => setStyle("width", undefined) : undefined
          }
        />
        <SizeInput
          label="Height"
          value={getStyle("height")}
          onChange={(v) => setStyle("height", v)}
          onDelete={
            getStyle("height") ? () => setStyle("height", undefined) : undefined
          }
        />
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-500 w-20">Grow</label>
          <div className="flex-1 bg-white border border-gray-200 rounded flex p-0.5">
            <button
              onClick={() =>
                setStyle("flexGrow", getStyle("flexGrow") === 1 ? 0 : 1)
              }
              className={`flex-1 py-1 rounded flex items-center justify-center ${
                getStyle("flexGrow") == 1
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 hover:text-white"
              }`}
            >
              <ChevronsLeftRight className="w-3 h-3" />
            </button>
            <div className="w-px bg-gray-200 mx-0.5"></div>
            <button
              onClick={() =>
                setStyle("flexShrink", getStyle("flexShrink") === 0 ? 1 : 0)
              }
              className={`flex-1 py-1 rounded flex items-center justify-center ${
                getStyle("flexShrink") !== 0
                  ? "bg-gray-200 text-gray-500"
                  : "text-blue-400 bg-blue-900/20"
              }`}
            >
              <Minimize2 className="w-3 h-3" />
            </button>
          </div>
        </div>
        {getStyle("minWidth") !== undefined && (
          <SizeInput
            label="Min W"
            value={getStyle("minWidth")}
            onChange={(v) => setStyle("minWidth", v)}
            onDelete={() => setStyle("minWidth", undefined)}
          />
        )}
        {getStyle("maxWidth") !== undefined && (
          <SizeInput
            label="Max W"
            value={getStyle("maxWidth")}
            onChange={(v) => setStyle("maxWidth", v)}
            onDelete={() => setStyle("maxWidth", undefined)}
          />
        )}
        {getStyle("minHeight") !== undefined && (
          <SizeInput
            label="Min H"
            value={getStyle("minHeight")}
            onChange={(v) => setStyle("minHeight", v)}
            onDelete={() => setStyle("minHeight", undefined)}
          />
        )}
        {getStyle("maxHeight") !== undefined && (
          <SizeInput
            label="Max H"
            value={getStyle("maxHeight")}
            onChange={(v) => setStyle("maxHeight", v)}
            onDelete={() => setStyle("maxHeight", undefined)}
          />
        )}
        {showMinMaxMenu && (
          <div className="bg-white border border-gray-200 rounded p-2 grid grid-cols-2 gap-2 mb-2 shadow-lg">
            {["minWidth", "maxWidth", "minHeight", "maxHeight"].map((prop) => (
              <button
                key={prop}
                onClick={() => {
                  setStyle(prop as any, "100px");
                  setShowMinMaxMenu(false);
                }}
                className="text-xs text-left px-2 py-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900"
              >
                + {prop.replace(/([A-Z])/g, " $1").trim()}
              </button>
            ))}
          </div>
        )}
        {!showMinMaxMenu && (
          <button
            onClick={() => setShowMinMaxMenu(true)}
            className="text-xs text-blue-600 hover:underline ml-auto block"
          >
            + Min/Max
          </button>
        )}
      </Accordion>

      <Accordion title="Spacing" icon={<BoxSelect className="w-3 h-3" />}>
        <QuadInput
          label="Padding"
          value={getStyle("padding")}
          onChange={(v) => setStyle("padding", v)}
        />
        <QuadInput
          label="Margin"
          value={getStyle("margin")}
          onChange={(v) => setStyle("margin", v)}
        />
      </Accordion>

      <Accordion
        title="Border & Radius"
        icon={<Square className="w-3 h-3" />}
        onRemove={() => {
          setStyle("border", undefined);
          setStyle("borderRadius", undefined);
          setStyle("borderWidth", undefined);
          setStyle("borderStyle", undefined);
          setStyle("borderColor", undefined);
        }}
      >
        <QuadInput
          label="Radius"
          value={getStyle("borderRadius")}
          onChange={(v) => setStyle("borderRadius", v)}
          labels={["TL", "TR", "BR", "BL"]}
        />
        <div className="space-y-2 mt-3 pt-3 border-t border-gray-800/50">
          <div className="flex justify-between items-center">
            <label className="text-xs text-gray-500">Border</label>
            <div className="flex gap-2 items-center">
              <div className="relative">
                <div
                  className="w-5 h-5 rounded border border-[#27272a] shadow-sm cursor-pointer hover:border-gray-500 transition-colors"
                  style={{
                    background:
                      (getStyle("borderColor") as string) || "#000000",
                  }}
                  onClick={() =>
                    setGlobalColorPicker({
                      isOpen: true,
                      color:
                        typeof getStyle("borderColor") === "string" &&
                        ((getStyle("borderColor") as string).startsWith("#") ||
                          (getStyle("borderColor") as string).startsWith("rgb"))
                          ? (getStyle("borderColor") as string)
                          : "#000000",
                      onChange: (newColor) => setStyle("borderColor", newColor),
                    })
                  }
                />
              </div>
              <select
                value={(getStyle("borderStyle") as string) || "none"}
                onChange={(e) => setStyle("borderStyle", e.target.value)}
                className="bg-white border border-gray-200 text-xs rounded px-1 py-0.5 text-gray-900"
              >
                <option value="none">None</option>
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
              </select>
            </div>
          </div>
          {getStyle("borderStyle") && getStyle("borderStyle") !== "none" && (
            <QuadInput
              label="Width"
              value={getStyle("borderWidth")}
              onChange={(v) => setStyle("borderWidth", v)}
            />
          )}
        </div>
      </Accordion>

      <Accordion title="Effects" icon={<Wand2 className="w-3 h-3" />}>
        <div className="space-y-4">
          {/* Background Image Control */}
          <div className="space-y-3 pb-3 border-b border-gray-200">
            <label className="text-xs text-gray-600 font-semibold">
              Background Image
            </label>
            {selectedElement.data?.backgroundImage ? (
              <div className="space-y-2">
                <div className="relative group rounded-md overflow-hidden border border-gray-200 h-24 bg-gray-50">
                  <img
                    src={imageGetUrl(selectedElement.data.backgroundImage)}
                    className="w-full h-full object-cover"
                    alt="Background"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => {
                        setUploadTarget("background");
                        setShowUploadModal(true);
                      }}
                      className="p-1.5 bg-white rounded-md text-gray-700 hover:text-blue-600"
                      title="Change Image"
                    >
                      <Upload className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => {
                        updateElement(selectedElement.id, {
                          data: {
                            ...(selectedElement.data || {}),
                            backgroundImage: undefined,
                          },
                        });
                      }}
                      className="p-1.5 bg-white rounded-md text-gray-700 hover:text-red-600"
                      title="Remove Image"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Overlay Control */}
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-500">Overlay</label>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded border border-gray-200 shadow-sm cursor-pointer"
                      style={{
                        background:
                          selectedElement.data?.backgroundOverlay ||
                          "transparent",
                      }}
                      onClick={() =>
                        setGlobalColorPicker({
                          isOpen: true,
                          color:
                            selectedElement.data?.backgroundOverlay ||
                            "rgba(0,0,0,0.5)",
                          onChange: (c) =>
                            updateElement(selectedElement.id, {
                              data: {
                                ...(selectedElement.data || {}),
                                backgroundOverlay: c,
                              },
                            }),
                        })
                      }
                    />
                    {selectedElement.data?.backgroundOverlay && (
                      <button
                        onClick={() =>
                          updateElement(selectedElement.id, {
                            data: {
                              ...(selectedElement.data || {}),
                              backgroundOverlay: undefined,
                            },
                          })
                        }
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Size & Position Control */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase">
                      Size
                    </label>
                    <select
                      value={selectedElement.data?.backgroundSize || "cover"}
                      onChange={(e) =>
                        updateElement(selectedElement.id, {
                          data: {
                            ...(selectedElement.data || {}),
                            backgroundSize: e.target.value,
                          },
                        })
                      }
                      className="w-full text-xs border border-gray-200 rounded px-1 py-1"
                    >
                      <option value="cover">Cover</option>
                      <option value="contain">Contain</option>
                      <option value="auto">Auto</option>
                      <option value="100% 100%">Stretch</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase">
                      Position
                    </label>
                    <select
                      value={
                        selectedElement.data?.backgroundPosition || "center"
                      }
                      onChange={(e) =>
                        updateElement(selectedElement.id, {
                          data: {
                            ...(selectedElement.data || {}),
                            backgroundPosition: e.target.value,
                          },
                        })
                      }
                      className="w-full text-xs border border-gray-200 rounded px-1 py-1"
                    >
                      <option value="center">Center</option>
                      <option value="top">Top</option>
                      <option value="bottom">Bottom</option>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setUploadTarget("background");
                  setShowUploadModal(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-gray-300 rounded-md text-xs text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
              >
                <Upload className="w-3 h-3" />
                Upload Image
              </button>
            )}
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-600">Bg Color</label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 h-[30px] bg-white border border-gray-200 rounded px-2">
                <div className="relative">
                  <div
                    className="w-5 h-5 rounded border border-gray-200 shadow-sm cursor-pointer hover:border-gray-400 transition-colors"
                    style={{
                      background:
                        (getStyle("backgroundColor") as string) || "#ffffff",
                    }}
                    onClick={() =>
                      setGlobalColorPicker({
                        isOpen: true,
                        color:
                          typeof getStyle("backgroundColor") === "string" &&
                          ((getStyle("backgroundColor") as string).startsWith(
                            "#",
                          ) ||
                            (getStyle("backgroundColor") as string).startsWith(
                              "rgb",
                            ))
                            ? (getStyle("backgroundColor") as string)
                            : "#ffffff",
                        onChange: (newColor) =>
                          setStyle("backgroundColor", newColor),
                      })
                    }
                  />
                </div>
                <span className="text-xs text-gray-600 font-mono">
                  {(() => {
                    const v = getStyle("backgroundColor");
                    if (!v) return "";
                    const s = String(v);
                    const resolved = resolveCssVar(s);
                    try {
                      return colord(resolved || s)
                        .toHex()
                        .toUpperCase();
                    } catch (e) {
                      if (resolved && /^#/.test(resolved))
                        return resolved.toUpperCase();
                      return resolved || s;
                    }
                  })()}
                </span>
              </div>
              <button
                onClick={() => setStyle("backgroundColor", "")}
                title="Clear BG"
                className="text-xs text-red-500 hover:text-red-600"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="pt-2 border-t border-gray-200">
            <ShadowControl
              value={getStyle("boxShadow")}
              onChange={(v) => setStyle("boxShadow", v)}
              onOpenColorPicker={(color, onChange) =>
                setGlobalColorPicker({ isOpen: true, color, onChange })
              }
            />
          </div>
        </div>
      </Accordion>

      <Accordion
        title="Hover Effects"
        icon={<MousePointer2 className="w-3 h-3" />}
      >
        <div className="space-y-4">
          {/* Hover Text Color */}
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-600">Text Color</label>
            <div className="flex items-center gap-2">
              <div className="relative">
                <div
                  className="w-5 h-5 rounded border border-gray-200 shadow-sm cursor-pointer hover:border-gray-400 transition-colors"
                  style={{
                    background:
                      selectedElement.data?.hoverStyle?.color || "transparent",
                  }}
                  onClick={() =>
                    setGlobalColorPicker({
                      isOpen: true,
                      color:
                        selectedElement.data?.hoverStyle?.color || "#000000",
                      onChange: (newColor) =>
                        updateElement(selectedElement.id, {
                          data: {
                            ...selectedElement.data,
                            hoverStyle: {
                              ...(selectedElement.data?.hoverStyle || {}),
                              color: newColor,
                            },
                          },
                        }),
                    })
                  }
                />
              </div>
              {selectedElement.data?.hoverStyle?.color && (
                <button
                  onClick={() =>
                    updateElement(selectedElement.id, {
                      data: {
                        ...selectedElement.data,
                        hoverStyle: {
                          ...(selectedElement.data?.hoverStyle || {}),
                          color: undefined,
                        },
                      },
                    })
                  }
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Hover Background Color */}
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-600">Background</label>
            <div className="flex items-center gap-2">
              <div className="relative">
                <div
                  className="w-5 h-5 rounded border border-gray-200 shadow-sm cursor-pointer hover:border-gray-400 transition-colors"
                  style={{
                    background:
                      selectedElement.data?.hoverStyle?.backgroundColor ||
                      "transparent",
                  }}
                  onClick={() =>
                    setGlobalColorPicker({
                      isOpen: true,
                      color:
                        selectedElement.data?.hoverStyle?.backgroundColor ||
                        "#ffffff",
                      onChange: (newColor) =>
                        updateElement(selectedElement.id, {
                          data: {
                            ...selectedElement.data,
                            hoverStyle: {
                              ...(selectedElement.data?.hoverStyle || {}),
                              backgroundColor: newColor,
                            },
                          },
                        }),
                    })
                  }
                />
              </div>
              {selectedElement.data?.hoverStyle?.backgroundColor && (
                <button
                  onClick={() =>
                    updateElement(selectedElement.id, {
                      data: {
                        ...selectedElement.data,
                        hoverStyle: {
                          ...(selectedElement.data?.hoverStyle || {}),
                          backgroundColor: undefined,
                        },
                      },
                    })
                  }
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Hover Border Color */}
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-600">Border Color</label>
            <div className="flex items-center gap-2">
              <div className="relative">
                <div
                  className="w-5 h-5 rounded border border-gray-200 shadow-sm cursor-pointer hover:border-gray-400 transition-colors"
                  style={{
                    background:
                      selectedElement.data?.hoverStyle?.borderColor ||
                      "transparent",
                  }}
                  onClick={() =>
                    setGlobalColorPicker({
                      isOpen: true,
                      color:
                        selectedElement.data?.hoverStyle?.borderColor ||
                        "#000000",
                      onChange: (newColor) =>
                        updateElement(selectedElement.id, {
                          data: {
                            ...selectedElement.data,
                            hoverStyle: {
                              ...(selectedElement.data?.hoverStyle || {}),
                              borderColor: newColor,
                            },
                          },
                        }),
                    })
                  }
                />
              </div>
              {selectedElement.data?.hoverStyle?.borderColor && (
                <button
                  onClick={() =>
                    updateElement(selectedElement.id, {
                      data: {
                        ...selectedElement.data,
                        hoverStyle: {
                          ...(selectedElement.data?.hoverStyle || {}),
                          borderColor: undefined,
                        },
                      },
                    })
                  }
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Transition Duration */}
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-600">Transition</label>
            <select
              value={selectedElement.data?.hoverStyle?.transition || "0.3s"}
              onChange={(e) =>
                updateElement(selectedElement.id, {
                  data: {
                    ...selectedElement.data,
                    hoverStyle: {
                      ...(selectedElement.data?.hoverStyle || {}),
                      transition: e.target.value,
                    },
                  },
                })
              }
              className="w-24 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-900"
            >
              <option value="none">None</option>
              <option value="0.1s">0.1s</option>
              <option value="0.2s">0.2s</option>
              <option value="0.3s">0.3s</option>
              <option value="0.5s">0.5s</option>
              <option value="1s">1s</option>
            </select>
          </div>
        </div>
      </Accordion>

      <div className="space-y-2 p-4 border-t border-gray-200">
        <div className="text-xs font-bold text-gray-500 flex items-center gap-2">
          <Hash className="w-3 h-3" /> ADVANCED
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            Custom CSS Class
          </label>
          <input
            type="text"
            value={selectedElement.className || ""}
            onChange={(e) =>
              updateElement(selectedElement.id, { className: e.target.value })
            }
            className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-sm font-mono text-blue-600"
            placeholder="my-custom-class"
          />
        </div>
      </div>
      {showUploadModal && (
        // @ts-ignore
        <ImageUpload
          setUploadedImage={handleUploadComplete}
          setUploadModal={setShowUploadModal}
          images={[]}
          oneSelect={true}
        />
      )}
    </div>
  );
};
