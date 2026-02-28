import React, { useState, useEffect } from "react";
import { updateProductTemplate } from "../app/actions/product";
import {
  saveLandingPageToPocketBase,
  updateLandingPageInPocketBase,
  deleteLandingPageFromPocketBase,
} from "../app/actions/pocketbase";
import {
  Code,
  Upload,
  Download,
  Monitor,
  Tablet,
  Smartphone,
  ImageIcon,
  Eye,
  Save,
  Database,
  Undo2,
  Redo2,
  Clock,
  KeyRound,
  Loader2,
  ExternalLink,
  Terminal,
  ChevronDown,
  FileText,
  Home,
} from "lucide-react";
import Link from "next/link";
import { useFunnel } from "../context/FunnelContext";
import { HistoryPanel } from "./HistoryPanel";
import { DeveloperModal } from "./DeveloperModal";
import { MCPSessionStatus } from "./MCPSessionStatus";
import { SaveLandingPageModal } from "./SaveLandingPageModal";
import { clearTemplatesCache } from "./TemplateSelectionModal";
import { useMCPCommandListener } from "../hooks/useMCPCommandListener";
import { processExportData } from "../utils/utils";
import {
  DEFAULT_OPENROUTER_MODEL,
  setOpenRouterModel,
} from "../services/openai";
import Image from "next/image";
import { usePageList } from "../hooks/usePageList";
import { useRouter } from "next/navigation";

interface HeaderProps {
  onExport: () => void;
  onImport: () => void;
  onScreenshot: () => void;
  setShowCssEditor: (show: boolean) => void;
  pageId?: string;
  tenantId?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onExport,
  onImport,
  onScreenshot,
  setShowCssEditor,
  pageId,
  tenantId,
}) => {
  const {
    viewMode,
    setViewMode,
    deviceView,
    setDeviceView,
    canUndo,
    canRedo,
    undo,
    redo,
    apiKey,
    setApiKey,
    aiProvider,
    setAiProvider,
    elements,
    globalCss,
    currentSchemeId,
    schemes,
    selectedProduct,
    storeId,
    accessToken,
    domain,
    slug,
    currentTemplateId,
    currentTemplateName,
    setCurrentTemplateId,
    setCurrentTemplateName,
    isDevMode,
    setIsDevMode,
    isDevAuthenticated,
    setIsDevAuthenticated,
    authenticateDeveloper,
  } = useFunnel();
  // const searchParams = useSearchParams(); // Removed dependency on searchParams

  const router = useRouter();
  const { pages, loading: pagesLoading } = usePageList(tenantId ?? "store_001");
  const [showPageMenu, setShowPageMenu] = useState(false);
  const currentPage = pages.find((p) => p.id === pageId);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showPageMenu) return;
    const handler = () => setShowPageMenu(false);
    const timer = setTimeout(() => window.addEventListener("click", handler), 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("click", handler);
    };
  }, [showPageMenu]);

  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingToDb, setIsSavingToDb] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  // Developer Mode State
  // const [isDevMode, setIsDevMode] = useState(false); // Moved to Context
  // const [isDevAuthenticated, setIsDevAuthenticated] = useState(false); // Moved to Context
  const [showDevModal, setShowDevModal] = useState(false);

  const [isTogglingTemplate, setIsTogglingTemplate] = useState(false);
  const [isTemplateDisabled, setIsTemplateDisabled] = useState(
    selectedProduct?.disable_landing_template === 1,
  );

  useEffect(() => {
    setIsTemplateDisabled(selectedProduct?.disable_landing_template === 1);
  }, [selectedProduct?.disable_landing_template]);

  const [openRouterModel, setOpenRouterModelState] = useState(
    DEFAULT_OPENROUTER_MODEL,
  );

  // MCP enabled state (persisted to localStorage)
  const [mcpEnabled, setMcpEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("mcp_enabled") === "true";
    }
    return false;
  });

  // MCP session state - only polls when enabled
  const {
    isConnected: mcpConnected,
    isInitializing: mcpInitializing,
    session: mcpSession,
    regenerateSession,
  } = useMCPCommandListener(mcpEnabled);

  // Toggle MCP connection
  const handleToggleMcp = () => {
    const newValue = !mcpEnabled;
    setMcpEnabled(newValue);
    if (typeof window !== "undefined") {
      localStorage.setItem("mcp_enabled", String(newValue));
    }
  };

  const handleOpenRouterModelChange = (value: string) => {
    setOpenRouterModelState(value);
    setOpenRouterModel(value);
  };

  const handleToggleTemplate = async () => {
    if (!slug || !accessToken || !storeId) {
      window.dispatchEvent(
        new CustomEvent("show-toast", {
          detail: {
            message: "Missing slug, access token, or store id",
            type: "error",
          },
        }),
      );
      return;
    }

    setIsTogglingTemplate(true);
    const newDisabledState = !isTemplateDisabled;

    try {
      // When disabling: only send disable_landing_template: true (no landing_template needed)
      // When enabling: send existing landing_template so backend sets disable_landing_template = 0
      const result = await updateProductTemplate(
        slug,
        accessToken,
        newDisabledState ? null : (selectedProduct?.landing_template || {}),
        storeId,
        newDisabledState,
      );

      if (result.success) {
        setIsTemplateDisabled(newDisabledState);
        window.dispatchEvent(
          new CustomEvent("show-toast", {
            detail: {
              message: newDisabledState
                ? "Landing page template disabled"
                : "Landing page template enabled",
              type: "success",
            },
          }),
        );
      } else {
        window.dispatchEvent(
          new CustomEvent("show-toast", {
            detail: {
              message: result.error || "Failed to update template status",
              type: "error",
            },
          }),
        );
      }
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("show-toast", {
          detail: { message: "An unexpected error occurred", type: "error" },
        }),
      );
    } finally {
      setIsTogglingTemplate(false);
    }
  };

  const handlePublish = async () => {
    if (!slug || !accessToken || !storeId || !domain) {
      window.dispatchEvent(
        new CustomEvent("show-toast", {
          detail: {
            message: "Missing slug, access token, store id, or domain",
            type: "error",
          },
        }),
      );
      return;
    }

    setIsPublishing(true);
    try {
      const payload = {
        theme_bulder_version: 2,
        version: 1,
        elements: processExportData(elements, selectedProduct),
        globalCss: globalCss,
        theme: {
          currentSchemeId: currentSchemeId,
          schemes: schemes,
        },
      };

      const result = await updateProductTemplate(
        slug,
        accessToken,
        payload,
        storeId,
      );
      if (result.success) {
        window.dispatchEvent(
          new CustomEvent("show-toast", {
            detail: { message: "Published successfully!", type: "success" },
          }),
        );
      } else {
        window.dispatchEvent(
          new CustomEvent("show-toast", {
            detail: {
              message: result.error || "Failed to publish",
              type: "error",
            },
          }),
        );
      }
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("show-toast", {
          detail: { message: "An unexpected error occurred", type: "error" },
        }),
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSaveToDb = async (name: string) => {
    setIsSavingToDb(true);
    try {
      const payload = {
        name: name,
        theme_builder_version: 2,
        version: 1,
        elements: processExportData(elements, selectedProduct),
        globalCss: globalCss,
        theme: {
          currentSchemeId: currentSchemeId,
          schemes: schemes,
        },
        savedAt: new Date().toISOString(),
      };

      const result = await saveLandingPageToPocketBase(payload);

      if (result.success) {
        setShowSaveModal(false);
        setCurrentTemplateId(result.recordId);
        setCurrentTemplateName(name);
        window.dispatchEvent(
          new CustomEvent("show-toast", {
            detail: {
              message: `"${name}" saved successfully!`,
              type: "success",
            },
          }),
        );
        // Dispatch event to refresh the landing page list
        window.dispatchEvent(new CustomEvent("refresh-landing-pages"));
      } else {
        window.dispatchEvent(
          new CustomEvent("show-toast", {
            detail: {
              message: result.error || "Failed to save to database",
              type: "error",
            },
          }),
        );
      }
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("show-toast", {
          detail: { message: "An unexpected error occurred", type: "error" },
        }),
      );
    } finally {
      setIsSavingToDb(false);
    }
  };

  const handleUpdateToDb = async (name: string, apiKey: string) => {
    if (!currentTemplateId) {
      window.dispatchEvent(
        new CustomEvent("show-toast", {
          detail: { message: "No template loaded to update", type: "error" },
        }),
      );
      return;
    }

    setIsSavingToDb(true);
    try {
      const payload = {
        name: name,
        theme_builder_version: 2,
        version: 1,
        elements: processExportData(elements, selectedProduct),
        globalCss: globalCss,
        theme: {
          currentSchemeId: currentSchemeId,
          schemes: schemes,
        },
        savedAt: new Date().toISOString(),
      };

      const result = await updateLandingPageInPocketBase(
        currentTemplateId,
        payload,
        apiKey,
      );

      if (result.success) {
        setShowSaveModal(false);
        setCurrentTemplateName(name);
        clearTemplatesCache();
        window.dispatchEvent(
          new CustomEvent("show-toast", {
            detail: {
              message: `"${name}" updated successfully! Reloading...`,
              type: "success",
            },
          }),
        );
        window.dispatchEvent(new CustomEvent("refresh-landing-pages"));

        // Reload page after a short delay to show the success message
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } else {
        window.dispatchEvent(
          new CustomEvent("show-toast", {
            detail: {
              message: result.error || "Failed to update",
              type: "error",
            },
          }),
        );
      }
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("show-toast", {
          detail: { message: "An unexpected error occurred", type: "error" },
        }),
      );
    } finally {
      setIsSavingToDb(false);
    }
  };

  const handleDeleteFromDb = async (apiKey: string) => {
    if (!currentTemplateId) {
      window.dispatchEvent(
        new CustomEvent("show-toast", {
          detail: { message: "No template loaded to delete", type: "error" },
        }),
      );
      return;
    }

    setIsSavingToDb(true);
    try {
      const result = await deleteLandingPageFromPocketBase(
        currentTemplateId,
        apiKey,
      );

      if (result.success) {
        setShowSaveModal(false);
        setCurrentTemplateId(null);
        setCurrentTemplateName(null);
        clearTemplatesCache();
        window.dispatchEvent(
          new CustomEvent("show-toast", {
            detail: {
              message: "Template deleted successfully! Reloading...",
              type: "success",
            },
          }),
        );
        window.dispatchEvent(new CustomEvent("refresh-landing-pages"));

        // Reload page after a short delay to show the success message
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } else {
        window.dispatchEvent(
          new CustomEvent("show-toast", {
            detail: {
              message: result.error || "Failed to delete",
              type: "error",
            },
          }),
        );
      }
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("show-toast", {
          detail: { message: "An unexpected error occurred", type: "error" },
        }),
      );
    } finally {
      setIsSavingToDb(false);
    }
  };

  const handleToggleDevMode = () => {
    if (isDevMode) {
      setIsDevMode(false);
    } else {
      if (isDevAuthenticated) {
        setIsDevMode(true);
      } else {
        setShowDevModal(true);
      }
    }
  };

  const handleDevAuthSuccess = () => {
    authenticateDeveloper();
  };

  return (
    <header className="h-14 border-b border-gray-200 flex items-center justify-between px-4 bg-white z-10">
      <div className="flex items-center gap-2">
        {pageId && (
          <Link
            href="/"
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors mr-1"
            title="Back to Dashboard"
          >
            <Home className="w-4 h-4" />
          </Link>
        )}
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-md flex items-center justify-center">
          <span className="font-bold text-white">S</span>
        </div>
        <Image
          width={400}
          height={200}
          src="/selorax.png"
          alt="SeloraX"
          className="w-40 h-8"
        />

        {/* Page Switcher */}
        {pageId && (
          <div className="relative ml-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowPageMenu(!showPageMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors border border-gray-200"
            >
              <FileText size={13} />
              <span className="max-w-[140px] truncate">
                {currentPage?.title ?? currentPage?.slug ?? (pagesLoading ? "Loading…" : "Select page")}
              </span>
              <ChevronDown
                size={13}
                className={`transition-transform ${showPageMenu ? "rotate-180" : ""}`}
              />
            </button>

            {showPageMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-[999] min-w-[220px] max-h-64 overflow-y-auto">
                {pages.length === 0 && !pagesLoading && (
                  <div className="px-4 py-3 text-sm text-gray-400">No pages found</div>
                )}
                {pagesLoading && (
                  <div className="px-4 py-3 text-sm text-gray-400">Loading…</div>
                )}
                {pages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => {
                      router.push(`/editor/${page.id}`);
                      setShowPageMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-start gap-2 ${
                      page.id === pageId
                        ? "text-blue-600 font-medium bg-blue-50"
                        : "text-gray-700"
                    }`}
                  >
                    <FileText size={13} className="flex-shrink-0 text-gray-400 mt-0.5" />
                    <div>
                      <div className="font-medium leading-tight">
                        {page.title || page.slug}
                      </div>
                      <div className="text-xs text-gray-400 capitalize mt-0.5">
                        {page.pageType?.replace(/_/g, " ")}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {/* <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200">
        <button
          onClick={() => setViewMode("editor")}
          className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 ${
            viewMode === "editor"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500"
          }`}
        >
          <MonitorPlay className="w-4 h-4" /> Editor
        </button>
      </div> */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 bg-gray-100 rounded p-1 mr-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo (⌘/Ctrl+Z)"
            className="p-1.5 hover:bg-gray-200 rounded text-gray-600 hover:text-purple-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo (⌘/Ctrl+Shift+Z)"
            className="p-1.5 hover:bg-gray-200 rounded text-gray-600 hover:text-purple-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowHistoryPanel(true)}
            title="History Panel"
            className="p-1.5 hover:bg-gray-200 rounded text-gray-600 hover:text-purple-600 transition-colors"
          >
            <Clock className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-gray-300 mx-1" />
          <button
            onClick={() => setShowCssEditor(true)}
            className="p-1.5 hover:bg-gray-200 rounded text-gray-600 hover:text-blue-600"
          >
            <Code className="w-4 h-4" />
          </button>
          <button
            onClick={onImport}
            className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
          >
            <Upload className="w-4 h-4" />
          </button>
          <button
            onClick={onExport}
            className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
        <div className="hidden md:flex items-center gap-2 mr-4 bg-gray-100 rounded-md px-2 py-1 border border-gray-200">
          <div className="flex bg-gray-200 rounded p-0.5 mr-1">
            <button
              onClick={() => setAiProvider("gemini")}
              className={`px-2 py-0.5 text-[10px] rounded font-bold transition-all ${
                aiProvider === "gemini"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Gemini
            </button>
            <button
              onClick={() => setAiProvider("openai")}
              className={`px-2 py-0.5 text-[10px] rounded font-bold transition-all ${
                aiProvider === "openai"
                  ? "bg-white text-purple-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              OpenRouter
            </button>
          </div>
          <KeyRound className="w-3.5 h-3.5 text-gray-500" />
          <input
            type="password"
            placeholder={`Enter ${
              aiProvider === "openai" ? "OpenRouter" : "Gemini"
            } API key`}
            className="bg-transparent text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none w-40"
            onChange={(e) => {
              setApiKey(e.target.value.trim());
            }}
            value={apiKey}
          />
          {aiProvider === "openai" && (
            <select
              className="ml-1 bg-white border border-gray-300 rounded text-[10px] px-1.5 py-0.5 text-gray-700 focus:outline-none"
              value={openRouterModel}
              onChange={(e) => handleOpenRouterModelChange(e.target.value)}
            >
              <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
              <option value="openai/gpt-4o">GPT-4o</option>
              <option value="anthropic/claude-3.5-sonnet">
                Claude 3.5 Sonnet
              </option>
              <option value="anthropic/claude-3-5-sonnet-20241022">
                Claude 3.5 Sonnet (Latest)
              </option>
              <option value="google/gemini-2.0-flash-001">
                Gemini 2.0 Flash
              </option>
              <option value="meta-llama/llama-3.1-70b-instruct">
                Llama 3.1 70B
              </option>
            </select>
          )}
        </div>
        <div className="flex items-center gap-2 mr-4">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setDeviceView("desktop")}
              className={`p-1.5 rounded-md transition-colors ${
                deviceView === "desktop"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
              }`}
              title="Desktop (1440px)"
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeviceView("tablet")}
              className={`p-1.5 rounded-md transition-colors ${
                deviceView === "tablet"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
              }`}
              title="Tablet (768px)"
            >
              <Tablet className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeviceView("mobile")}
              className={`p-1.5 rounded-md transition-colors ${
                deviceView === "mobile"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
              }`}
              title="Mobile (375px)"
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>
          <span className="text-xs text-gray-400 font-mono tabular-nums">
            {deviceView === "desktop" ? "1440px" : deviceView === "tablet" ? "768px" : "375px"}
          </span>
        </div>
        <MCPSessionStatus
          isConnected={mcpConnected}
          isInitializing={mcpInitializing}
          isEnabled={mcpEnabled}
          session={mcpSession}
          onRegenerate={regenerateSession}
          onToggleEnabled={handleToggleMcp}
        />
        {viewMode === "preview" && (
          <button
            onClick={onScreenshot}
            className="px-3 py-2 rounded-md border border-gray-200 text-gray-600 hover:text-gray-900 text-sm flex items-center gap-2"
          >
            <ImageIcon className="w-4 h-4" /> Export Image
          </button>
        )}
        <button
          onClick={() =>
            setViewMode(viewMode === "preview" ? "editor" : "preview")
          }
          className={`px-4 py-2 rounded-md border text-sm font-medium flex items-center gap-2 ${
            viewMode === "preview"
              ? "bg-blue-600 border-blue-600 text-white"
              : "border-gray-200 hover:bg-gray-100 text-gray-700"
          }`}
        >
          <Eye className="w-4 h-4" />{" "}
          {viewMode === "preview" ? "Exit Preview" : "Preview"}
        </button>
        <button
          onClick={() => {
            if (domain && slug) {
              window.open(
                `https://${domain}/products/${slug}?fbclid=1`,
                "_blank",
              );
            } else {
              window.dispatchEvent(
                new CustomEvent("show-toast", {
                  detail: {
                    message: "Missing domain or slug for preview",
                    type: "error",
                  },
                }),
              );
            }
          }}
          disabled={!selectedProduct?.landing_template}
          className="px-4 py-2 rounded-md border border-gray-200 hover:bg-gray-100 text-gray-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ExternalLink className="w-4 h-4" /> Live Preview
        </button>
        <div className="flex items-center gap-2 mr-2 border-r pr-2 border-gray-300">
          <span className="text-xs font-medium text-gray-500 hidden xl:inline">
            Developer
          </span>
          <button
            onClick={handleToggleDevMode}
            className={`relative flex items-center bg-gray-100 rounded-full p-0.5 transition-colors ${
              isDevMode ? "bg-purple-100" : ""
            }`}
            title="Toggle Developer Mode"
          >
            <div className="w-16 h-7 flex items-center justify-center relative">
              <span
                className={`absolute left-0.5 px-2.5 py-1 text-[10px] font-bold rounded-full transition-all duration-200 ${
                  isDevMode
                    ? "bg-purple-600 text-white shadow-sm opacity-100"
                    : "opacity-0 translate-x-4"
                }`}
              >
                ON
              </span>
              <span
                className={`absolute right-0.5 px-2.5 py-1 text-[10px] font-bold rounded-full transition-all duration-200 ${
                  !isDevMode
                    ? "bg-gray-400 text-white shadow-sm opacity-100"
                    : "opacity-0 -translate-x-4"
                }`}
              >
                OFF
              </span>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Template</span>
          <button
            onClick={handleToggleTemplate}
            disabled={isTogglingTemplate || !selectedProduct}
            title={
              isTemplateDisabled
                ? "Enable landing page template"
                : "Disable landing page template"
            }
            className="relative flex items-center bg-gray-100 rounded-full p-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTogglingTemplate ? (
              <div className="w-16 h-7 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
              </div>
            ) : (
              <>
                <span
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-full transition-all duration-200 ${
                    !isTemplateDisabled
                      ? "bg-green-500 text-white shadow-sm"
                      : "text-gray-400"
                  }`}
                >
                  ON
                </span>
                <span
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-full transition-all duration-200 ${
                    isTemplateDisabled
                      ? "bg-gray-400 text-white shadow-sm"
                      : "text-gray-400"
                  }`}
                >
                  OFF
                </span>
              </>
            )}
          </button>
        </div>

        {isDevMode && isDevAuthenticated && (
          <button
            onClick={() => setShowSaveModal(true)}
            title="Save to PocketBase database"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-md text-sm font-bold flex items-center gap-2 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Database className="w-4 h-4 text-white" />
            Save
          </button>
        )}
        <button
          onClick={handlePublish}
          disabled={isPublishing || !selectedProduct}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-sm font-bold flex items-center gap-2 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPublishing ? (
            <Loader2 className="w-4 h-4 text-white animate-spin" />
          ) : (
            <Save className="w-4 h-4 text-white" />
          )}
          {isPublishing ? "Publishing..." : "Publish"}
        </button>
      </div>

      <HistoryPanel
        isOpen={showHistoryPanel}
        onClose={() => setShowHistoryPanel(false)}
      />

      <SaveLandingPageModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveToDb}
        onUpdate={handleUpdateToDb}
        onDelete={handleDeleteFromDb}
        isSaving={isSavingToDb}
        mode={currentTemplateId ? "update" : "create"}
        existingName={currentTemplateName || ""}
        recordId={currentTemplateId || ""}
      />

      <DeveloperModal
        isOpen={showDevModal}
        onClose={() => setShowDevModal(false)}
        onSuccess={handleDevAuthSuccess}
      />
    </header>
  );
};
