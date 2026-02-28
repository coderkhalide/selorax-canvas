"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, Camera, Eye, Wand2, CheckCircle } from "lucide-react";

export type ScanType = "screenshot" | "reading" | "analyzing" | "generating" | "verifying";

interface ScanState {
  elementId: string;
  scanType: ScanType;
  description?: string;
  startTime: number;
}

const scanConfig: Record<ScanType, {
  icon: React.ElementType;
  color: string;
  gradient: string;
  label: string;
}> = {
  screenshot: {
    icon: Camera,
    color: "rgb(147, 51, 234)", // purple
    gradient: "linear-gradient(90deg, transparent 0%, rgba(147, 51, 234, 0.3) 20%, rgba(147, 51, 234, 0.9) 50%, rgba(147, 51, 234, 0.3) 80%, transparent 100%)",
    label: "Capturing",
  },
  reading: {
    icon: Eye,
    color: "rgb(59, 130, 246)", // blue
    gradient: "linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.3) 20%, rgba(59, 130, 246, 0.9) 50%, rgba(59, 130, 246, 0.3) 80%, transparent 100%)",
    label: "Reading",
  },
  analyzing: {
    icon: Sparkles,
    color: "rgb(236, 72, 153)", // pink
    gradient: "linear-gradient(90deg, transparent 0%, rgba(236, 72, 153, 0.3) 20%, rgba(236, 72, 153, 0.9) 50%, rgba(236, 72, 153, 0.3) 80%, transparent 100%)",
    label: "AI Updating",
  },
  generating: {
    icon: Wand2,
    color: "rgb(139, 92, 246)", // violet
    gradient: "linear-gradient(90deg, transparent 0%, rgba(139, 92, 246, 0.3) 20%, rgba(139, 92, 246, 0.9) 50%, rgba(139, 92, 246, 0.3) 80%, transparent 100%)",
    label: "Generating",
  },
  verifying: {
    icon: CheckCircle,
    color: "rgb(34, 197, 94)", // green
    gradient: "linear-gradient(90deg, transparent 0%, rgba(34, 197, 94, 0.3) 20%, rgba(34, 197, 94, 0.9) 50%, rgba(34, 197, 94, 0.3) 80%, transparent 100%)",
    label: "Verifying",
  },
};

// Apply scanning class and badge to a DOM element
function applyLoadingStyles(elementId: string, scanType: ScanType, description?: string) {
  let element = document.getElementById(elementId);
  if (!element) {
    element = document.querySelector(`[data-element-id="${elementId}"]`);
  }

  if (!element) return;

  const config = scanConfig[scanType];

  // Add scanning class
  element.classList.add("mcp-element-loading");
  element.setAttribute("data-scan-type", scanType);
  element.style.setProperty("--scan-color", config.color);
  element.style.setProperty("--scan-gradient", config.gradient);

  // Create and append badge if not exists
  let badge = element.querySelector(".mcp-loading-badge") as HTMLElement;
  if (!badge) {
    badge = document.createElement("div");
    badge.className = "mcp-loading-badge";
    element.appendChild(badge);
  }

  // Update badge content
  badge.innerHTML = `
    <span class="mcp-loading-spinner"></span>
    <span>${description || config.label}...</span>
  `;
  badge.style.setProperty("--badge-color", config.color);
}

// Remove scanning class and badge from a DOM element
function removeLoadingStyles(elementId: string) {
  let element = document.getElementById(elementId);
  if (!element) {
    element = document.querySelector(`[data-element-id="${elementId}"]`);
  }

  if (!element) return;

  element.classList.remove("mcp-element-loading");
  element.removeAttribute("data-scan-type");
  element.style.removeProperty("--scan-color");
  element.style.removeProperty("--scan-gradient");

  // Remove badge
  const badge = element.querySelector(".mcp-loading-badge");
  if (badge) {
    badge.remove();
  }
}

export const ScanningOverlay: React.FC = () => {
  // Track multiple active scans using Map
  const [activeScans, setActiveScans] = useState<Map<string, ScanState>>(new Map());

  useEffect(() => {
    const handleScanStart = (e: CustomEvent<{ elementId: string; scanType: ScanType; description?: string }>) => {
      const { elementId, scanType, description } = e.detail;

      // Add to active scans
      setActiveScans(prev => {
        const next = new Map(prev);
        next.set(elementId, {
          elementId,
          scanType,
          description,
          startTime: Date.now(),
        });
        return next;
      });

      // Apply visual styles to the DOM element
      applyLoadingStyles(elementId, scanType, description);
    };

    const handleScanComplete = (e: CustomEvent<{ elementId?: string }>) => {
      const elementId = e.detail?.elementId;

      if (elementId) {
        // Remove specific element from active scans
        setActiveScans(prev => {
          const next = new Map(prev);
          next.delete(elementId);
          return next;
        });

        // Remove visual styles after a brief delay for smooth transition
        setTimeout(() => {
          removeLoadingStyles(elementId);
        }, 200);
      } else {
        // No elementId - clear all scans (legacy behavior)
        setActiveScans(prev => {
          prev.forEach((_, id) => {
            removeLoadingStyles(id);
          });
          return new Map();
        });
      }
    };

    // Legacy screenshot events (for backward compatibility)
    const handleScreenshotStart = (e: CustomEvent<{ elementId: string }>) => {
      handleScanStart(new CustomEvent("mcp-scan-start", {
        detail: { elementId: e.detail.elementId, scanType: "screenshot" as ScanType }
      }));
    };

    const handleScreenshotComplete = (e: CustomEvent<{ elementId?: string }>) => {
      handleScanComplete(e);
    };

    window.addEventListener("mcp-scan-start", handleScanStart as EventListener);
    window.addEventListener("mcp-scan-complete", handleScanComplete as EventListener);
    window.addEventListener("mcp-screenshot-start", handleScreenshotStart as EventListener);
    window.addEventListener("mcp-screenshot-complete", handleScreenshotComplete as EventListener);

    return () => {
      window.removeEventListener("mcp-scan-start", handleScanStart as EventListener);
      window.removeEventListener("mcp-scan-complete", handleScanComplete as EventListener);
      window.removeEventListener("mcp-screenshot-start", handleScreenshotStart as EventListener);
      window.removeEventListener("mcp-screenshot-complete", handleScreenshotComplete as EventListener);
    };
  }, []);

  // Auto-cleanup: remove stale scans after 30 seconds
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      setActiveScans(prev => {
        let changed = false;
        const next = new Map(prev);
        next.forEach((scan, id) => {
          if (now - scan.startTime > 30000) {
            next.delete(id);
            removeLoadingStyles(id);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 5000);

    return () => clearInterval(cleanup);
  }, []);

  // Inject global CSS for element-level loading animations
  return (
    <style>{`
      .mcp-element-loading {
        position: relative;
        overflow: hidden;
        pointer-events: none;
      }

      /* Shimmer effect overlay */
      .mcp-element-loading::before {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(
          90deg,
          transparent,
          var(--scan-color, rgba(139, 92, 246, 0.15)),
          transparent
        );
        animation: mcp-shimmer 1.5s infinite;
        z-index: 1000;
        pointer-events: none;
      }

      /* Scanning line effect */
      .mcp-element-loading::after {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        height: 3px;
        background: var(--scan-gradient, linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.9), transparent));
        box-shadow: 0 0 15px var(--scan-color, rgb(139, 92, 246));
        animation: mcp-scan-line 1.2s ease-in-out infinite;
        z-index: 1001;
        pointer-events: none;
      }

      /* Loading badge */
      .mcp-loading-badge {
        position: absolute;
        top: 8px;
        right: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
        background: var(--badge-color, rgba(139, 92, 246, 0.95));
        color: white;
        padding: 6px 12px;
        border-radius: 16px;
        font-size: 12px;
        font-weight: 500;
        z-index: 1002;
        pointer-events: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }

      /* Spinner in badge */
      .mcp-loading-spinner {
        width: 12px;
        height: 12px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: mcp-spin 0.8s linear infinite;
      }

      @keyframes mcp-shimmer {
        0% {
          transform: translateX(-100%);
        }
        100% {
          transform: translateX(100%);
        }
      }

      @keyframes mcp-scan-line {
        0%, 100% {
          top: 0;
          opacity: 0.7;
        }
        50% {
          top: calc(100% - 3px);
          opacity: 1;
        }
      }

      @keyframes mcp-spin {
        to {
          transform: rotate(360deg);
        }
      }

      /* Pulsing border effect */
      .mcp-element-loading {
        box-shadow: 0 0 0 2px var(--scan-color, rgb(139, 92, 246)),
                    0 0 20px var(--scan-color, rgba(139, 92, 246, 0.3));
        animation: mcp-border-pulse 1.5s ease-in-out infinite;
      }

      @keyframes mcp-border-pulse {
        0%, 100% {
          box-shadow: 0 0 0 2px var(--scan-color, rgb(139, 92, 246)),
                      0 0 15px var(--scan-color, rgba(139, 92, 246, 0.2));
        }
        50% {
          box-shadow: 0 0 0 3px var(--scan-color, rgb(139, 92, 246)),
                      0 0 25px var(--scan-color, rgba(139, 92, 246, 0.4));
        }
      }
    `}</style>
  );
};

export default ScanningOverlay;
