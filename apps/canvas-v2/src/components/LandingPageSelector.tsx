import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  ChevronDown,
  FileJson,
  Loader2,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { useFunnel } from "../context/FunnelContext";
import {
  listLandingPagesFromPocketBase,
  getLandingPageFromPocketBase,
} from "../app/actions/pocketbase";

interface LandingPageItem {
  id: string;
  name: string;
  created: string;
  updated: string;
  data: any;
}

export const LandingPageSelector: React.FC = () => {
  const {
    setElements,
    setSelectedId,
    setGlobalCss,
    setScheme,
    addScheme,
    schemes,
    isDevMode,
    isDevAuthenticated,
    setCurrentTemplateId,
    setCurrentTemplateName,
  } = useFunnel();

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [landingPages, setLandingPages] = useState<LandingPageItem[]>([]);
  const [filteredPages, setFilteredPages] = useState<LandingPageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [selectedPage, setSelectedPage] = useState<LandingPageItem | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // Fetch landing pages from PocketBase
  const fetchLandingPages = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await listLandingPagesFromPocketBase(1, 100);

      if (result.success) {
        setLandingPages(result.items);
        setFilteredPages(result.items);
      } else {
        setError(result.error || "Failed to fetch landing pages");
        setLandingPages([]);
        setFilteredPages([]);
      }
    } catch (err) {
      setError("Failed to fetch landing pages");
      setLandingPages([]);
      setFilteredPages([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount and listen for refresh events
  useEffect(() => {
    fetchLandingPages();

    // Listen for refresh event from Header after saving
    const handleRefresh = () => {
      fetchLandingPages();
    };

    window.addEventListener("refresh-landing-pages", handleRefresh);
    return () => {
      window.removeEventListener("refresh-landing-pages", handleRefresh);
    };
  }, [fetchLandingPages]);

  // Filter pages based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredPages(landingPages);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredPages(
        landingPages.filter((page) => {
          const pageName = (page.name || "").toLowerCase();
          const pageId = page.id.toLowerCase();
          return pageName.includes(term) || pageId.includes(term);
        }),
      );
    }
  }, [searchTerm, landingPages]);

  // Handle selecting a landing page
  const handlePageSelect = async (page: LandingPageItem) => {
    setIsOpen(false);
    setIsLoadingPage(true);
    setSelectedPage(page);

    try {
      // If data is already loaded, use it directly
      if (page.data) {
        loadPageData(page.data);
        setCurrentTemplateId(page.id);
        setCurrentTemplateName(page.name);
        setIsLoadingPage(false);
        return;
      }

      // Otherwise fetch full data
      const result = await getLandingPageFromPocketBase(page.id);

      if (result.success && result.data) {
        loadPageData(result.data);
        setCurrentTemplateId(page.id);
        setCurrentTemplateName(page.name);
      } else {
        window.dispatchEvent(
          new CustomEvent("show-toast", {
            detail: {
              message: result.error || "Failed to load landing page",
              type: "error",
            },
          }),
        );
      }
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent("show-toast", {
          detail: { message: "Failed to load landing page", type: "error" },
        }),
      );
    } finally {
      setIsLoadingPage(false);
    }
  };

  // Load page data into the editor
  const loadPageData = (data: any) => {
    // Load elements
    if (Array.isArray(data.elements)) {
      setElements(data.elements);
    } else if (Array.isArray(data)) {
      setElements(data);
    }

    // Load global CSS
    if (data.globalCss) {
      setGlobalCss(data.globalCss);
    }

    // Load theme - add schemes that don't exist and set active scheme
    if (data.theme) {
      // Add any new schemes from the saved data
      if (data.theme.schemes) {
        Object.values(data.theme.schemes).forEach((scheme: any) => {
          if (scheme && scheme.id && !schemes[scheme.id]) {
            addScheme(scheme, false);
          }
        });
      }

      // Set the active scheme
      if (data.theme.currentSchemeId) {
        setScheme(data.theme.currentSchemeId);
      }
    }

    // Clear selection
    setSelectedId(null);

    window.dispatchEvent(
      new CustomEvent("show-toast", {
        detail: { message: "Landing page loaded!", type: "success" },
      }),
    );
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  // Get display name for a page
  const getPageName = (page: LandingPageItem) => {
    return page.name || "Untitled";
  };

  // Only show if Developer Mode is enabled and authenticated
  if (!isDevMode || !isDevAuthenticated) {
    return null;
  }

  return (
    <div className="w-full mb-2">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
        <FileJson className="w-3 h-3" /> Saved Pages
      </div>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading || isLoadingPage}
          className={`w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm transition-all text-left ${
            isLoading || isLoadingPage
              ? "opacity-75 cursor-not-allowed"
              : "hover:border-purple-500"
          }`}
        >
          {isLoadingPage ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
              <span className="text-sm text-purple-600 font-medium">
                Loading...
              </span>
            </div>
          ) : selectedPage ? (
            <div className="flex items-center gap-2 overflow-hidden">
              <FileJson className="w-4 h-4 text-purple-500 flex-shrink-0" />
              <span className="text-sm font-medium text-gray-900 truncate">
                {getPageName(selectedPage)}
              </span>
            </div>
          ) : (
            <span className="text-sm text-gray-500 flex items-center gap-2">
              <FileJson className="w-4 h-4 text-gray-400" />
              Select Saved Page
            </span>
          )}
          {!isLoading && !isLoadingPage && (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-2 border-b border-gray-100 flex gap-2">
              <div className="relative flex-1 flex items-center justify-center">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search pages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:bg-white transition-colors"
                  autoFocus
                />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fetchLandingPages();
                }}
                disabled={isLoading}
                className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                title="Refresh list"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto py-1">
              {isLoading ? (
                <div className="px-4 py-8 text-center">
                  <Loader2 className="w-6 h-6 text-purple-500 animate-spin mx-auto mb-2" />
                  <span className="text-sm text-gray-500">
                    Loading pages...
                  </span>
                </div>
              ) : error ? (
                <div className="px-4 py-8 text-center text-red-500 text-sm">
                  {error}
                </div>
              ) : filteredPages.length > 0 ? (
                filteredPages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => handlePageSelect(page)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-purple-50 transition-colors ${
                      selectedPage?.id === page.id ? "bg-purple-50" : ""
                    }`}
                  >
                    <FileJson className="w-5 h-5 text-purple-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {getPageName(page)}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(page.created)}
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">
                  No saved pages found
                </div>
              )}
            </div>

            {landingPages.length > 0 && (
              <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 text-center">
                {landingPages.length} saved page
                {landingPages.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
