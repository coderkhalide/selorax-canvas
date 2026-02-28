import { useState } from "react";
import { useFunnel } from "../context/FunnelContext";
import * as geminiService from "../services/gemini";
import * as openaiService from "../services/openai";
import { FunnelElement } from "../types";
import { generateSchemeFromBaseColor } from "../utils/themeGenerator";

export const useAiOptimizer = () => {
  const {
    elements,
    setElements,
    enableStreaming,
    addScheme,
    apiKey,
    aiProvider,
  } = useFunnel();
  const aiService = aiProvider === "openai" ? openaiService : geminiService;
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [followAiScroll, setFollowAiScroll] = useState(true);

  const showMissingKeyToast = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("show-toast", {
        detail: {
          message: "Please Provide a valid API key.",
          type: "error",
        },
      })
    );
  };

  const generateSpecificComponent = async (
    targetId: string,
    prompt: string,
    style?: string,
    image?: string | null,
    followScroll: boolean = true
  ) => {
    if (!apiKey) {
      showMissingKeyToast();
      return;
    }
    setFollowAiScroll(!!followScroll);
    setIsAnalyzing(true);
    setShowAiPrompt(false);
    const skeletonId = `skeleton-${Date.now()}`;

    // 1. Add Skeleton
    setElements((prev) => {
      const clone = JSON.parse(JSON.stringify(prev));
      const addSkeletonRecursive = (list: FunnelElement[]): boolean => {
        for (const el of list) {
          if (el.id === targetId) {
            if (!el.children) el.children = [];
            el.children.push({
              id: skeletonId,
              type: "skeleton",
              name: "Generating...",
              style: { width: "100%", height: "150px" },
            } as any);
            return true;
          }
          if (el.children && addSkeletonRecursive(el.children)) return true;
        }
        return false;
      };
      addSkeletonRecursive(clone);
      return clone;
    });

    try {
      const styleHint =
        style && style !== "magic" ? `Style: ${style}` : undefined;
      const userPrompt = styleHint ? `${prompt} (${styleHint})` : prompt;
      const rawCmp = image
        ? await aiService.generateComponentFromImage(image, userPrompt)
        : await aiService.generateComponent(prompt, styleHint);
      const newCmp = rawCmp && typeof rawCmp === "object" && "component" in rawCmp
        ? (rawCmp as any).component
        : rawCmp;

      // 3. Replace Skeleton
      setElements((prev) => {
        const clone = JSON.parse(JSON.stringify(prev));
        // We need to find the parent of the skeleton to replace it correctly
        const replaceSkeletonRecursive = (list: FunnelElement[]): boolean => {
          const idx = list.findIndex((e) => e.id === skeletonId);
          if (idx !== -1) {
            if (newCmp && newCmp.type) {
              list[idx] = {
                ...newCmp,
                id: `el-${Date.now()}-${Math.random()
                  .toString(36)
                  .substr(2, 9)}`,
              };
            } else {
              // Generation failed or returned invalid data, remove skeleton
              list.splice(idx, 1);
            }
            return true;
          }
          for (const el of list) {
            if (el.children && replaceSkeletonRecursive(el.children))
              return true;
          }
          return false;
        };
        replaceSkeletonRecursive(clone);
        return clone;
      });
    } catch (e) {
      console.error("AI component generation error:", e);
      // Show error toast to user
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("show-toast", {
            detail: {
              message: `AI Error: ${e instanceof Error ? e.message : "Component generation failed"}`,
              type: "error",
            },
          })
        );
        // Ensure activity indicator stops
        window.dispatchEvent(new CustomEvent("mcp-scan-complete"));
      }
      // Remove skeleton on error
      setElements((prev) => {
        const clone = JSON.parse(JSON.stringify(prev));
        const removeSkeletonRecursive = (list: FunnelElement[]): boolean => {
          const idx = list.findIndex((e) => e.id === skeletonId);
          if (idx !== -1) {
            list.splice(idx, 1);
            return true;
          }
          for (const el of list) {
            if (el.children && removeSkeletonRecursive(el.children))
              return true;
          }
          return false;
        };
        removeSkeletonRecursive(clone);
        return clone;
      });
    } finally {
      setIsAnalyzing(false);
      setFollowAiScroll(true);
      if (image) setSelectedImage(null);
      setAiPrompt("");
    }
  };

  const handleAiOptimization = async () => {
    if (!apiKey) {
      showMissingKeyToast();
      return;
    }
    setIsAnalyzing(true);
    setFollowAiScroll(true);
    setShowAiPrompt(false);
    const originalElements = [...elements]; // Snapshot for ID preservation
    console.log("RUNNING AI OPTIMIZATION", {
      aiProvider,
      service: aiService === openaiService ? "openai" : "gemini",
    });

    try {
      const lower = (aiPrompt || "").toLowerCase();
      const hexMatch = (aiPrompt || "").match(/#([0-9a-fA-F]{3,8})\b/);
      const rgbMatch = !hexMatch
        ? (aiPrompt || "").match(/rgba?\([^)]+\)/i)
        : null;
      const nameCandidates = [
        "blue",
        "green",
        "red",
        "orange",
        "purple",
        "pink",
        "indigo",
        "teal",
        "cyan",
        "amber",
        "lime",
        "emerald",
        "violet",
        "sky",
        "rose",
        "brown",
        "black",
        "white",
        "gray",
        "নীল",
        "সবুজ",
        "লাল",
      ];
      const nameMatch =
        !hexMatch && !rgbMatch
          ? nameCandidates.find((n) => lower.includes(n))
          : null;
      const themeColorCandidate =
        hexMatch?.[0] || rgbMatch?.[0] || nameMatch || null;

      if (themeColorCandidate) {
        if (enableStreaming) {
          let accumulated = "";
          console.log("CALLING LANDING PAGE GEN STREAM", {
            provider: aiProvider,
          });
          const stream = await aiService.generateLandingPageWithThemeStream(
            aiPrompt || "",
            themeColorCandidate
          );
          for await (const chunk of stream) {
            accumulated += chunk;
            const partial = aiService.smartParsePartialJson(accumulated, true);
            if (
              partial &&
              partial.elements &&
              Array.isArray(partial.elements)
            ) {
              setElements(
                aiService.sanitizeAndMerge(partial.elements, originalElements)
              );
              const scheme = generateSchemeFromBaseColor(
                partial.themeColor || themeColorCandidate,
                partial.themeName || "Auto Theme",
                "theme-ai-generated"
              );
              if (scheme) addScheme(scheme, true);
            }
          }
          const finalObj = aiService.smartParsePartialJson(accumulated, true);
          if (
            finalObj &&
            finalObj.elements &&
            Array.isArray(finalObj.elements)
          ) {
            setElements(
              aiService.sanitizeAndMerge(finalObj.elements, originalElements)
            );
            const scheme = generateSchemeFromBaseColor(
              finalObj.themeColor || themeColorCandidate,
              finalObj.themeName || "Auto Theme",
              "theme-ai-generated"
            );
            if (scheme) addScheme(scheme, true);
          }
        } else {
          console.log("CALLING LANDING PAGE GEN (NON-STREAM)", {
            provider: aiProvider,
          });
          const result = await aiService.generateLandingPageWithTheme(
            aiPrompt || "",
            themeColorCandidate
          );
          if (result && result.elements && Array.isArray(result.elements)) {
            setElements(
              aiService.sanitizeAndMerge(result.elements, originalElements)
            );
            const scheme = generateSchemeFromBaseColor(
              result.themeColor || themeColorCandidate,
              result.themeName || "Auto Theme",
              "theme-ai-generated"
            );
            if (scheme) addScheme(scheme, true);
          }
        }
      } else if (selectedImage) {
        if (enableStreaming) {
          let accumulatedJson = "";
          const stream = await aiService.fixComponentWithImageStream(
            elements,
            selectedImage,
            aiPrompt || "Update content to match this image"
          );

          for await (const chunk of stream) {
            accumulatedJson += chunk;
            const partialData = aiService.smartParsePartialJson(
              accumulatedJson,
              true
            );
            if (partialData) {
              const dataToMerge = Array.isArray(partialData)
                ? partialData
                : [partialData];
              if (
                dataToMerge.length > 0 &&
                dataToMerge[0] &&
                dataToMerge[0].type
              ) {
                setElements(
                  aiService.sanitizeAndMerge(dataToMerge, originalElements)
                );
              }
            }
          }
          const finalData = aiService.smartParsePartialJson(
            accumulatedJson,
            true
          );
          if (finalData) {
            const dataToMerge = Array.isArray(finalData)
              ? finalData
              : [finalData];
            setElements(
              aiService.sanitizeAndMerge(dataToMerge, originalElements)
            );
          }
        } else {
          // If image is present, use the vision model (non-streaming)
          const newElements = await aiService.fixComponentWithImage(
            elements,
            selectedImage,
            aiPrompt || "Update content to match this image"
          );

          if (newElements) {
            // Normalize result: if it returns a single object, wrap in array if needed,
            // but likely it returns the same structure as input.
            // The sanitizer expects an array for the root usually, but let's be safe.
            const dataToMerge = Array.isArray(newElements)
              ? newElements
              : [newElements];
            setElements(
              aiService.sanitizeAndMerge(dataToMerge, originalElements)
            );
          }
        }
        setSelectedImage(null); // Clear image after use
      } else if (enableStreaming) {
        let accumulatedJson = "";
        const stream = await aiService.optimizeLayoutStream(
          JSON.stringify(elements),
          aiPrompt
        );
        for await (const chunk of stream) {
          accumulatedJson += chunk;
          const partialData = aiService.smartParsePartialJson(
            accumulatedJson,
            true
          );
          if (
            partialData &&
            Array.isArray(partialData) &&
            partialData.length > 0
          ) {
            const safeData = aiService.sanitizeAndMerge(
              partialData,
              originalElements
            );
            setElements(safeData);
          }
        }
        // Final parse
        const finalData = aiService.smartParsePartialJson(
          accumulatedJson,
          true
        );
        if (finalData && Array.isArray(finalData)) {
          setElements(aiService.sanitizeAndMerge(finalData, originalElements));
        }
      } else {
        const newElements = await aiService.optimizeLayout(
          JSON.stringify(elements),
          aiPrompt
        );
        if (newElements && Array.isArray(newElements)) {
          setElements(
            aiService.sanitizeAndMerge(newElements, originalElements)
          );
        }
      }
    } catch (e) {
      console.error("AI optimization error:", e);
      // Show error toast to user
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("show-toast", {
            detail: {
              message: `AI Error: ${e instanceof Error ? e.message : "Optimization failed"}`,
              type: "error",
            },
          })
        );
        // Ensure activity indicator stops
        window.dispatchEvent(new CustomEvent("mcp-scan-complete"));
      }
    }

    setIsAnalyzing(false);
    setAiPrompt("");
  };

  return {
    isAnalyzing,
    followAiScroll,
    showAiPrompt,
    setShowAiPrompt,
    aiPrompt,
    setAiPrompt,
    selectedImage,
    setSelectedImage,
    handleAiOptimization,
    generateSpecificComponent,
  };
};
