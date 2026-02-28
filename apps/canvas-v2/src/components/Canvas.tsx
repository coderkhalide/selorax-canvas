import React, { useState, useEffect } from "react";
import { DropPosition, FunnelElement } from "../types";
import { Plus, Layout, FilePlus } from "lucide-react";
import { useFunnel } from "../context/FunnelContext";
import { ElementRenderer } from "./ElementRenderer";
import { LayoutSidebar } from "./LayoutSidebar";
import { AddComponentModal } from "./AddComponentModal";
import { TemplateSelectionModal } from "./TemplateSelectionModal";

export const Canvas: React.FC<{
  isAnalyzing?: boolean;
  followAiScroll?: boolean;
}> = ({ isAnalyzing, followAiScroll = true }) => {
  const {
    elements,
    selectedId,
    setSelectedId,
    viewMode,
    globalCss,
    setGlobalCss,
    handleDrop,
    setDraggingType,
    draggingType,
    deviceView,
    setElements,
    addScheme,
    setScheme,
    setCurrentTemplateId,
    setCurrentTemplateName,
  } = useFunnel();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: DropPosition;
  } | null>(null);
  const isPreview = viewMode === "preview";

  const scrollAnimId = React.useRef<number | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const [scrollZone, setScrollZone] = useState<"top" | "bottom" | null>(null);
  const scrollZoneRef = React.useRef<"top" | "bottom" | null>(null);
  useEffect(() => {
    scrollZoneRef.current = scrollZone;
  }, [scrollZone]);
  const lastPointerYRef = React.useRef<number | null>(null);
  const lastEventTsRef = React.useRef<number>(0);
  const [isLayoutSidebarOpen, setIsLayoutSidebarOpen] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      if (e?.detail?.elementId) {
        setSelectedId(e.detail.elementId);
      }
      setIsLayoutSidebarOpen(true);
    };
    window.addEventListener("openLayoutSidebar", handler as EventListener);
    return () =>
      window.removeEventListener("openLayoutSidebar", handler as EventListener);
  }, []);

  const [isComponentModalOpen, setIsComponentModalOpen] = useState(false);
  const [componentModalTargetId, setComponentModalTargetId] = useState<
    string | null
  >(null);
  const [componentModalMode, setComponentModalMode] = useState<
    "default" | "create_section"
  >("default");
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Handler for selecting a template from the modal
  const handleSelectTemplate = (
    templateElements: FunnelElement[],
    templateGlobalCss?: string,
    templateTheme?: any,
    templateId?: string,
    templateName?: string
  ) => {
    // Load the template elements
    setElements(templateElements);

    // Load global CSS if available
    if (templateGlobalCss) {
      setGlobalCss(templateGlobalCss);
    }

    // Load theme schemes if available
    if (templateTheme?.schemes) {
      Object.values(templateTheme.schemes).forEach((scheme: any) => {
        addScheme(scheme);
      });
      if (templateTheme.currentSchemeId) {
        setScheme(templateTheme.currentSchemeId);
      }
    }

    // Track the loaded template
    if (templateId) {
      setCurrentTemplateId(templateId);
      setCurrentTemplateName(templateName || null);
    }
  };

  useEffect(() => {
    const handler = (e: any) => {
      if (e?.detail?.elementId) {
        setComponentModalTargetId(e.detail.elementId);
      }
      if (e?.detail?.mode) {
        setComponentModalMode(e.detail.mode);
      } else {
        setComponentModalMode("default");
      }
      setIsComponentModalOpen(true);
    };
    window.addEventListener("openComponentModal", handler as EventListener);
    return () =>
      window.removeEventListener(
        "openComponentModal",
        handler as EventListener,
      );
  }, []);

  useEffect(() => {
    const handleGlobalDragOver = (e: DragEvent) => {
      if (!draggingType) {
        setScrollZone(null);
        return;
      }

      const container = containerRef.current;
      if (!container) return;

      e.preventDefault();

      lastPointerYRef.current = e.clientY;
      lastEventTsRef.current = Date.now();
      const topThreshold = 80;
      const bottomThreshold = 80;
      const nearViewportTop = e.clientY <= topThreshold;
      const nearViewportBottom =
        window.innerHeight - e.clientY <= bottomThreshold;

      if (nearViewportTop) {
        setScrollZone("top");
      } else if (nearViewportBottom) {
        setScrollZone("bottom");
      } else {
        const rect = container.getBoundingClientRect();
        const localY = e.clientY - rect.top;
        const nearContainerTop = localY <= topThreshold;
        const nearContainerBottom = rect.height - localY <= bottomThreshold;
        if (nearContainerTop) setScrollZone("top");
        else if (nearContainerBottom) setScrollZone("bottom");
        else setScrollZone(null);
      }
    };

    const handleGlobalDragEnd = () => {
      setScrollZone(null);
    };

    window.addEventListener("dragover", handleGlobalDragOver);
    window.addEventListener("dragend", handleGlobalDragEnd);
    window.addEventListener("drop", handleGlobalDragEnd);

    return () => {
      window.removeEventListener("dragover", handleGlobalDragOver);
      window.removeEventListener("dragend", handleGlobalDragEnd);
      window.removeEventListener("drop", handleGlobalDragEnd);
    };
  }, [draggingType]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !draggingType || !scrollZone) {
      if (scrollAnimId.current !== null) {
        cancelAnimationFrame(scrollAnimId.current);
        scrollAnimId.current = null;
      }
      return;
    }

    let lastTs = 0;
    const speed = 650;
    const step = (ts: number) => {
      if (Date.now() - lastEventTsRef.current > 300 || !scrollZoneRef.current) {
        if (scrollAnimId.current !== null)
          cancelAnimationFrame(scrollAnimId.current);
        scrollAnimId.current = null;
        return;
      }
      if (!lastTs) lastTs = ts;
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;
      const { scrollTop, scrollHeight, clientHeight } = container;
      const max = scrollHeight - clientHeight;
      const dir = scrollZoneRef.current === "top" ? -1 : 1;
      const y = lastPointerYRef.current;
      const topThreshold = 80;
      const bottomThreshold = 80;
      const rect = container.getBoundingClientRect();
      const localY = y != null ? y - rect.top : null;
      const intensity = (() => {
        if (y == null) return 0.6;
        if (dir < 0) {
          const t =
            localY != null
              ? Math.max(0, Math.min(1, (topThreshold - localY) / topThreshold))
              : 0.6;
          return Math.max(0.35, t);
        } else {
          const b =
            localY != null
              ? Math.max(
                  0,
                  Math.min(
                    1,
                    (bottomThreshold - (rect.height - localY)) /
                      bottomThreshold,
                  ),
                )
              : 0.6;
          return Math.max(0.35, b);
        }
      })();
      const next = scrollTop + dir * speed * intensity * dt;
      if (dir < 0) {
        container.scrollTop = next <= 0 ? 0 : next;
        if (container.scrollTop <= 0) {
          if (scrollAnimId.current !== null)
            cancelAnimationFrame(scrollAnimId.current);
          scrollAnimId.current = null;
          return;
        }
      } else {
        container.scrollTop = next >= max ? max : next;
        if (container.scrollTop >= max) {
          if (scrollAnimId.current !== null)
            cancelAnimationFrame(scrollAnimId.current);
          scrollAnimId.current = null;
          return;
        }
      }
      scrollAnimId.current = requestAnimationFrame(step);
    };

    scrollAnimId.current = requestAnimationFrame(step);

    return () => {
      if (scrollAnimId.current !== null) {
        cancelAnimationFrame(scrollAnimId.current);
        scrollAnimId.current = null;
      }
    };
  }, [scrollZone, draggingType]);

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleMainDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleDrop(e, "root", "inside");
    setDropTarget(null);
    setDraggingType(null);
    setScrollZone(null);
  };

  // Refs to track previous state for smart scrolling
  const prevElementsRef = React.useRef(elements);
  const prevIdsRef = React.useRef(elements.map((e) => e.id).join(","));

  // Auto-scroll to show new content during AI streaming
  useEffect(() => {
    // Don't auto-scroll if dragging, reordering (dropTarget), editing (selectedId), or in preview
    if (
      isPreview ||
      !containerRef.current ||
      draggingType ||
      dropTarget ||
      (!isAnalyzing && selectedId) ||
      !followAiScroll
    ) {
      // Update refs even if we don't scroll, to keep sync
      prevElementsRef.current = elements;
      prevIdsRef.current = elements.map((e) => e.id).join(",");
      return;
    }

    const currentIds = elements.map((e) => e.id).join(",");
    const prevIds = prevIdsRef.current;
    const prevLen = prevElementsRef.current.length;
    const isReorder = currentIds !== prevIds && elements.length === prevLen;
    const isGrowth = elements.length > prevLen;

    // Update refs for next render
    prevElementsRef.current = elements;
    prevIdsRef.current = currentIds;

    // Skip scrolling on reorder or shrink (e.g., delete). Only scroll on growth.
    if (!isAnalyzing && (isReorder || !isGrowth)) return;

    const container = containerRef.current;
    let animationFrameId: number;

    const startTs = performance.now();
    const followBottom = (ts: number) => {
      const { scrollHeight, clientHeight } = container;
      const max = Math.max(0, scrollHeight - clientHeight);
      if (container.scrollTop !== max) container.scrollTop = max;
      if (ts - startTs < 1800) {
        animationFrameId = requestAnimationFrame(followBottom);
      }
    };
    // Wait a tick so layout updates apply, then follow bottom
    setTimeout(() => {
      animationFrameId = requestAnimationFrame(followBottom);
    }, 0);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [JSON.stringify(elements), isPreview]);

  return (
    <div className="relative flex-1 w-full h-full flex flex-col overflow-hidden">
      {/* Removed top-right Change Layout button; sidebar opens from element toolbar */}
      {/* Top Scroll Zone Overlay */}
      <div
        className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-blue-100/70 to-transparent z-50 pointer-events-none transition-opacity duration-300 ${
          draggingType && scrollZone === "top" ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-blue-100/70 to-transparent z-50 pointer-events-none transition-opacity duration-300 ${
          draggingType && scrollZone === "bottom" ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        ref={containerRef}
        className={`flex-1 overflow-auto h-full flex flex-col items-center bg-gray-100 ${
          isPreview ? "py-6" : "py-8 px-4"
        }`}
        onClick={() => !isPreview && setSelectedId(null)}
        onMouseLeave={() => setHoveredId(null)}
      >
        {globalCss && <style>{globalCss}</style>}
        <div
          id="funnel-canvas-container"
          className={`bg-white transition-all duration-300 ease-in-out ${
            isPreview
              ? "min-h-screen rounded-xl shadow-lg"
              : "shadow-sm flex flex-col"
          } ${
            deviceView === "mobile"
              ? "w-[375px]"
              : deviceView === "tablet"
                ? "w-[768px]"
                : "w-[1440px] max-w-full"
          }`}
          onDragOver={handleDragOver}
          onDrop={handleMainDrop}
        >
          {elements.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-gray-300 m-8 rounded-xl bg-gray-50/50">
              <Plus className="w-12 h-12 mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-600 mb-2">Start Building</p>
              <p className="text-sm text-gray-400 mb-6 text-center max-w-md">
                Choose a template to get started quickly, or start with a blank canvas
              </p>

              <div className="flex gap-4">
                {/* Template Button */}
                <button
                  onClick={() => setIsTemplateModalOpen(true)}
                  className="flex flex-col items-center gap-3 px-8 py-6 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-lg transition-all group"
                >
                  <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <Layout className="w-7 h-7 text-blue-600" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">Template</p>
                    <p className="text-xs text-gray-400 mt-1">Use saved design</p>
                  </div>
                </button>

                {/* Blank Button */}
                <button
                  onClick={() => {
                    // Directly add a blank section
                    const newSection: FunnelElement = {
                      id: `section-${Date.now()}`,
                      type: "section",
                      name: "New Section",
                      style: {
                        padding: "60px 20px",
                        backgroundColor: "var(--color-background)",
                      },
                      children: [],
                    };
                    setElements([newSection]);
                    setSelectedId(newSection.id);
                  }}
                  className="flex flex-col items-center gap-3 px-8 py-6 bg-white border-2 border-gray-200 rounded-xl hover:border-green-500 hover:shadow-lg transition-all group"
                >
                  <div className="w-14 h-14 bg-green-50 rounded-xl flex items-center justify-center group-hover:bg-green-100 transition-colors">
                    <FilePlus className="w-7 h-7 text-green-600" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">Blank</p>
                    <p className="text-xs text-gray-400 mt-1">Start from scratch</p>
                  </div>
                </button>
              </div>

              <p className="text-xs text-gray-400 mt-6">
                Or drag a Section from the sidebar
              </p>
            </div>
          ) : (
            elements.map((el) => (
              <ElementRenderer
                key={el.id}
                element={el}
                hoveredId={hoveredId}
                setHoveredId={setHoveredId}
                dropTarget={dropTarget}
                setDropTarget={setDropTarget}
                parentDirection="column"
                parentType="root"
              />
            ))
          )}
        </div>
      </div>
      <LayoutSidebar
        isOpen={isLayoutSidebarOpen}
        onClose={() => setIsLayoutSidebarOpen(false)}
        selectedElementId={selectedId}
      />
      <AddComponentModal
        isOpen={isComponentModalOpen}
        onClose={() => {
          setIsComponentModalOpen(false);
          setComponentModalTargetId(null);
          setComponentModalMode("default");
        }}
        targetElementId={componentModalTargetId}
        mode={componentModalMode}
      />
      <TemplateSelectionModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onSelectTemplate={handleSelectTemplate}
      />
    </div>
  );
};
