import React, { useRef } from "react";
import html2canvas from "html2canvas";
import { useFunnel } from "../context/FunnelContext";
import { ProjectData } from "../types";
import { processExportData } from "../utils/utils";

export const useProjectActions = () => {
  const {
    elements,
    setElements,
    globalCss,
    setGlobalCss,
    currentSchemeId,
    schemes,
    setScheme,
    addScheme,
    selectedProduct,
  } = useFunnel();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const projectData: ProjectData = {
      theme_bulder_version: 2,
      version: 1,
      elements: processExportData(elements, selectedProduct),
      globalCss,
      theme: {
        currentSchemeId,
        schemes,
      },
    };
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(projectData, null, 2));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "funnel_project.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);

        // Handle legacy array format
        if (Array.isArray(json)) {
          setElements(json);
        }
        // Handle new project format
        else if (json.elements) {
          setElements(json.elements);
          setGlobalCss(json.globalCss || "");

          // Import theme if available
          if (json.theme) {
            const {
              schemes: importedSchemes,
              currentSchemeId: importedCurrentId,
            } = json.theme;

            // Add all imported schemes
            if (importedSchemes) {
              Object.values(importedSchemes).forEach((scheme: any) => {
                addScheme(scheme, false);
              });
            }

            // Set active scheme
            if (importedCurrentId && importedSchemes[importedCurrentId]) {
              setScheme(importedCurrentId);
            }
          }
        }
      } catch (err) {
        alert("Error parsing JSON file.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleScreenshot = async () => {
    const canvasElement = document.getElementById("funnel-canvas-container");
    if (!canvasElement) return;
    try {
      const canvas = await html2canvas(canvasElement, {
        scale: 2,
        backgroundColor: null,
      });
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = "funnel-preview.png";
      link.click();
    } catch (err) {
      alert("Failed to generate image.");
    }
  };

  return {
    fileInputRef,
    handleExport,
    handleImportClick,
    handleFileChange,
    handleScreenshot,
  };
};
