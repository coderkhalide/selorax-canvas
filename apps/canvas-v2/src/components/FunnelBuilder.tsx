"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useFunnel } from "@/context/FunnelContext";
import { Header } from "./Header";
import { AnalyticsView } from "./AnalyticsView";
import { EditorLayout } from "./EditorLayout";
import { CssEditor } from "./CssEditor";
import { useProjectActions } from "@/hooks/useProjectActions";
import { useAiOptimizer } from "@/hooks/useAiOptimizer";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { AgentChat } from "./AgentChat";
import { useMCPCommandListener } from "@/hooks/useMCPCommandListener";
import { MCPDebugPanel } from "./MCPDebugPanel";
import { ScanningOverlay } from "./ScanningOverlay";
import { MCPStreamingProgress } from "./MCPStreamingProgress";
import { MCPActivityStatus } from "./MCPActivityStatus";
import { prefetchTemplates } from "./TemplateSelectionModal";

interface FunnelBuilderProps {
  initialProducts?: any;
  storeId?: string;
  accessToken?: string;
  domain?: string;
  slug?: string;
  pageId?: string;
  tenantId?: string;
}

export default function FunnelBuilder({ initialProducts, storeId, accessToken, domain, slug, pageId, tenantId }: FunnelBuilderProps) {
  const { viewMode, enableStreaming, undo, redo, setProducts, setStoreId, setAccessToken, setDomain, setSlug, isProductLoading } = useFunnel();
  const [showCssEditor, setShowCssEditor] = useState(false);

  // Listen for MCP commands from Claude Code (always active)
  useMCPCommandListener();

  useEffect(() => {
    if (initialProducts) {
      console.log("Setting initial products", initialProducts);
      setProducts(initialProducts);
    }
    if (storeId) setStoreId(storeId);
    if (accessToken) setAccessToken(accessToken);
    if (domain) setDomain(domain);
    if (slug) setSlug(slug);
  }, [initialProducts, storeId, accessToken, domain, slug, setProducts, setStoreId, setAccessToken, setDomain, setSlug]);

  // Prefetch templates on app load for instant access
  useEffect(() => {
    prefetchTemplates();
  }, []);

  // Enable keyboard shortcuts
  // useKeyboardShortcuts({ onUndo: undo, onRedo: redo });

  const {
    fileInputRef,
    handleExport,
    handleImportClick,
    handleFileChange,
    handleScreenshot,
  } = useProjectActions();

  const {
    isAnalyzing,
    followAiScroll,
    showAiPrompt,
    setShowAiPrompt,
    aiPrompt,
    setAiPrompt,
    handleAiOptimization,
    selectedImage,
    setSelectedImage,
    generateSpecificComponent,
  } = useAiOptimizer();

  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<any>;
      const detail = custom.detail || {};
      if (!detail.message) return;
      setToast({
        message: String(detail.message),
        type: detail.type === "success" ? "success" : "error",
      });
      setTimeout(() => {
        setToast(null);
      }, 3000);
    };

    window.addEventListener("show-toast" as any, handler);
    return () => {
      window.removeEventListener("show-toast" as any, handler);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-white text-gray-900 font-sans relative">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[110] px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 ${
            toast.type === "error"
              ? "bg-red-600 text-white"
              : "bg-emerald-600 text-white"
          }`}
        >
          <span>{toast.message}</span>
        </div>
      )}
      {isAnalyzing && (
        <div className="fixed bottom-6 right-6 z-[100] bg-white border border-purple-500/50 p-4 rounded-xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4 fade-in">
          <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              AI Optimizing...
            </h3>
            {enableStreaming && (
              <p className="text-xs text-gray-500">Streaming changes</p>
            )}
          </div>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept=".json"
        onChange={handleFileChange}
      />

      {showCssEditor && <CssEditor onClose={() => setShowCssEditor(false)} />}

      <Header
        onExport={handleExport}
        onImport={handleImportClick}
        onScreenshot={handleScreenshot}
        setShowCssEditor={setShowCssEditor}
      />

      <div className="flex-1 flex relative overflow-hidden">
        {/* Product Loading Overlay */}
        {isProductLoading && (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50 z-40 flex items-center justify-center">
            <div className="flex flex-col items-center gap-6">
              {/* Animated circles */}
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100"></div>
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin"></div>
                <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" style={{ animationDuration: '0.8s', animationDirection: 'reverse' }}></div>
                <div className="absolute inset-4 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin" style={{ animationDuration: '1.2s' }}></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full animate-pulse"></div>
                </div>
              </div>

              {/* Text with animated dots */}
              <div className="text-center">
                <h3 className="text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Loading Template
                </h3>
                <div className="flex items-center justify-center gap-1 mt-2">
                  <span className="text-sm text-gray-500">Please wait</span>
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === "analytics" ? (
          <AnalyticsView />
        ) : (
          <EditorLayout
            showAiPrompt={showAiPrompt}
            setShowAiPrompt={setShowAiPrompt}
            aiPrompt={aiPrompt}
            setAiPrompt={setAiPrompt}
            isAnalyzing={isAnalyzing}
            followAiScroll={followAiScroll}
            handleAiOptimization={handleAiOptimization}
            selectedImage={selectedImage}
            setSelectedImage={setSelectedImage}
            generateSpecificComponent={generateSpecificComponent}
          />
        )}
      </div>

      <AgentChat />

      {/* MCP Debug Tools */}
      <ScanningOverlay />
      <MCPStreamingProgress />
      <MCPDebugPanel />
      <MCPActivityStatus />
    </div>
  );
}
