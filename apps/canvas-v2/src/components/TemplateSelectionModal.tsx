import React, { useState, useEffect, useCallback } from "react";
import { X, Loader2, FileJson, Layout, RefreshCw } from "lucide-react";
import { listLandingPagesFromPocketBase } from "../app/actions/pocketbase";
import { FunnelElement } from "../types";
import { SimpleSectionPreview } from "./SimpleSectionPreview";

interface LandingPageItem {
  id: string;
  name: string;
  created: string;
  data: {
    elements?: FunnelElement[];
    globalCss?: string;
    theme?: any;
  } | null;
}

interface TemplateSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (
    elements: FunnelElement[],
    globalCss?: string,
    theme?: any,
    templateId?: string,
    templateName?: string,
  ) => void;
}

// Cache disabled: always hit PocketBase for real-time data
export function clearTemplatesCache(): void {
  // no-op (kept for call sites)
}

// Prefetch templates on app load (no caching, just a warm request)
export async function prefetchTemplates(): Promise<void> {
  try {
    await listLandingPagesFromPocketBase(1, 100);
  } catch (err) {
    console.error("[Templates] Prefetch failed:", err);
  }
}

export const TemplateSelectionModal: React.FC<TemplateSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  const [pages, setPages] = useState<LandingPageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLandingPages = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await listLandingPagesFromPocketBase(1, 100);

      if (result.success) {
        setPages(result.items as LandingPageItem[]);
      } else {
        setError(result.error || "Failed to fetch templates");
      }
    } catch (err) {
      setError("Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchLandingPages();
    }
  }, [isOpen, fetchLandingPages]);

  const handleSelectTemplate = (page: LandingPageItem) => {
    if (page.data?.elements) {
      onSelectTemplate(
        page.data.elements,
        page.data.globalCss,
        page.data.theme,
        page.id,
        page.name,
      );
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Layout className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Choose a Template
              </h2>
              <p className="text-sm text-gray-500">
                Select a saved landing page to start with
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchLandingPages()}
              disabled={isLoading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh templates"
            >
              <RefreshCw
                className={`w-5 h-5 text-gray-500 ${isLoading ? "animate-spin" : ""}`}
              />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
              <p className="text-gray-500">Loading templates...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="text-red-500 mb-4">
                <X className="w-12 h-12" />
              </div>
              <p className="text-red-600 font-medium mb-2">
                Error loading templates
              </p>
              <p className="text-gray-500 text-sm mb-4">{error}</p>
              <button
                onClick={() => fetchLandingPages()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
              >
                Retry
              </button>
            </div>
          ) : pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <FileJson className="w-12 h-12 text-gray-300 mb-4" />
              <p className="text-gray-600 font-medium mb-1">
                No templates found
              </p>
              <p className="text-gray-400 text-sm">
                Save a landing page first to use it as a template
              </p>
            </div>
          ) : (
            <>
              {/* CSS for smooth auto-scroll animation */}
              <style>{`
                .template-preview-wrapper {
                  transition: transform 25s linear;
                  transform: translateY(0);
                }
                .template-card:hover .template-preview-wrapper {
                  transform: translateY(calc(-100% + 220px));
                }
              `}</style>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {pages.map((page) => {
                  // Get all sections for preview
                  const sections =
                    page.data?.elements?.filter(
                      (el) => el.type === "section",
                    ) || [];

                  return (
                    <button
                      key={page.id}
                      onClick={() => handleSelectTemplate(page)}
                      className="template-card group relative bg-white border-2 border-gray-200 rounded-xl overflow-hidden hover:border-blue-500 hover:shadow-lg transition-all duration-200 text-left"
                    >
                      {/* Preview Area - Smooth scroll on hover */}
                      <div className="h-56 bg-white overflow-hidden relative">
                        {sections.length > 0 ? (
                          <div className="template-preview-wrapper absolute left-0 right-0 top-0 pointer-events-none">
                            <div
                              className="origin-top-left"
                              style={{
                                transform: "scale(0.35)",
                                width: "285.7%",
                                transformOrigin: "top left",
                              }}
                            >
                              {sections.map((section) => (
                                <SimpleSectionPreview
                                  key={section.id}
                                  element={section}
                                />
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                              <FileJson className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                              <p className="text-xs text-gray-400">
                                {page.data?.elements?.length || 0} sections
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-3 border-t border-gray-100 bg-white relative z-10">
                        <p className="font-medium text-gray-900 truncate">
                          {page.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {sections.length} sections
                        </p>
                      </div>

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                        <span className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg">
                          Use Template
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateSelectionModal;
