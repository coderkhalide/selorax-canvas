"use client";

import React, { useEffect, useState } from "react";

interface ScanState {
  elementId: string;
  isScanning: boolean;
}

export const ScreenshotScanOverlay: React.FC = () => {
  const [scanState, setScanState] = useState<ScanState | null>(null);

  useEffect(() => {
    const handleScreenshotStart = (e: CustomEvent<{ elementId: string }>) => {
      setScanState({ elementId: e.detail.elementId, isScanning: true });
    };

    const handleScreenshotComplete = () => {
      // Keep showing for a brief moment after completion
      setTimeout(() => {
        setScanState(null);
      }, 300);
    };

    window.addEventListener("mcp-screenshot-start", handleScreenshotStart as EventListener);
    window.addEventListener("mcp-screenshot-complete", handleScreenshotComplete as EventListener);

    return () => {
      window.removeEventListener("mcp-screenshot-start", handleScreenshotStart as EventListener);
      window.removeEventListener("mcp-screenshot-complete", handleScreenshotComplete as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!scanState?.elementId || !scanState.isScanning) return;

    // Find the element and position the overlay
    let element = document.getElementById(scanState.elementId);
    if (!element) {
      element = document.querySelector(`[data-element-id="${scanState.elementId}"]`);
    }

    if (element) {
      // Add scanning class to the element
      element.classList.add("mcp-scanning");

      return () => {
        element?.classList.remove("mcp-scanning");
      };
    }
  }, [scanState]);

  if (!scanState?.isScanning) return null;

  return (
    <style>{`
      .mcp-scanning {
        position: relative;
        overflow: hidden;
      }
      .mcp-scanning::after {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(147, 51, 234, 0.3) 20%,
          rgba(147, 51, 234, 0.9) 50%,
          rgba(147, 51, 234, 0.3) 80%,
          transparent 100%
        );
        box-shadow: 0 0 20px rgba(147, 51, 234, 0.8), 0 0 40px rgba(147, 51, 234, 0.5);
        animation: mcp-scan-animation 1.2s ease-out;
        z-index: 9999;
        pointer-events: none;
      }
      @keyframes mcp-scan-animation {
        0% {
          top: 0;
          opacity: 1;
        }
        100% {
          top: 100%;
          opacity: 0.3;
        }
      }
    `}</style>
  );
};

export default ScreenshotScanOverlay;
