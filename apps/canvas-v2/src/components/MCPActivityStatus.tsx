"use client";

import React, { useEffect, useState } from "react";
import {
  Sparkles,
  Camera,
  Wand2,
  CheckCircle,
  Loader2,
  Eye,
  Layers,
  Palette,
  Type,
  MousePointer,
  Zap,
  LayoutGrid,
  PenTool
} from "lucide-react";

interface ActivityMessage {
  id: string;
  message: string;
  type: "working" | "screenshot" | "reading" | "ai" | "success" | "theme";
  icon: React.ElementType;
  color: string;
  timestamp: number;
}

const typeConfig: Record<ActivityMessage["type"], { bgColor: string; textColor: string; borderColor: string }> = {
  working: { bgColor: "bg-blue-50", textColor: "text-blue-600", borderColor: "border-blue-200" },
  screenshot: { bgColor: "bg-purple-50", textColor: "text-purple-600", borderColor: "border-purple-200" },
  reading: { bgColor: "bg-indigo-50", textColor: "text-indigo-600", borderColor: "border-indigo-200" },
  ai: { bgColor: "bg-violet-50", textColor: "text-violet-600", borderColor: "border-violet-200" },
  success: { bgColor: "bg-emerald-50", textColor: "text-emerald-600", borderColor: "border-emerald-200" },
  theme: { bgColor: "bg-pink-50", textColor: "text-pink-600", borderColor: "border-pink-200" },
};

export const MCPActivityStatus: React.FC = () => {
  const [activities, setActivities] = useState<ActivityMessage[]>([]);

  useEffect(() => {
    const addActivity = (
      message: string,
      type: ActivityMessage["type"],
      icon: React.ElementType = Loader2
    ) => {
      const id = `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setActivities((prev) => {
        // Keep more activities (up to 8) for better visibility
        const updated = [
          ...prev.slice(-7),
          { id, message, type, icon, color: typeConfig[type].textColor, timestamp: Date.now() },
        ];
        return updated;
      });

      // Auto-remove: success = 3s, ai/generating = 15s (keep longer for page generation), others = 5s
      const timeout = type === "success" ? 3000 : type === "ai" ? 15000 : 5000;
      setTimeout(() => {
        setActivities((prev) => prev.filter((a) => a.id !== id));
      }, timeout);
    };

    // Listen for MCP command events
    const handleCommand = (e: CustomEvent<{ command: string; args?: any }>) => {
      const cmd = e.detail.command;
      const args = e.detail.args || {};

      // Map commands to user-friendly messages with icons
      const commandConfig: Record<string, { message: string; type: ActivityMessage["type"]; icon: React.ElementType }> = {
        setElements: { message: "✨ Updating page layout...", type: "working", icon: LayoutGrid },
        addElement: { message: `➕ Adding ${args.element?.type || "element"}...`, type: "working", icon: Layers },
        updateElement: { message: "🔄 Updating element...", type: "working", icon: PenTool },
        generatePage: { message: "🚀 Generating landing page...", type: "ai", icon: Wand2 },
        generateLandingPage: { message: `🚀 AI generating ${args.style || "modern"} ${args.industry || "landing"} page...`, type: "ai", icon: Wand2 },
        changeTheme: { message: `🎨 Applying ${args.color || "new"} theme...`, type: "theme", icon: Palette },
        setHeadline: { message: "📝 Updating headline...", type: "working", icon: Type },
        setButtonText: { message: "🔘 Updating button...", type: "working", icon: MousePointer },
        screenshotElement: { message: "📸 Capturing screenshot...", type: "screenshot", icon: Camera },
        getSelectedElement: { message: "👁️ Reading selection...", type: "reading", icon: Eye },
        getParentSection: { message: "🔍 Getting section context...", type: "reading", icon: Layers },
        verifyElement: { message: "✅ Verifying element...", type: "reading", icon: CheckCircle },
        evaluateSectionQuality: { message: "🔍 Evaluating section quality...", type: "ai", icon: Eye },
        improveSectionWithAI: { message: "✨ AI improving section...", type: "ai", icon: Sparkles },
        aiActivityStart: {
          message: args.description || `⚡ AI ${args.activityType}...`,
          type: "ai",
          icon: Sparkles
        },
        aiActivityEnd: {
          message: args.success ? "✅ AI completed!" : "AI finished",
          type: args.success ? "success" : "working",
          icon: args.success ? CheckCircle : Zap
        },
      };

      const config = commandConfig[cmd];
      if (config) {
        addActivity(config.message, config.type, config.icon);
      }
    };

    // Listen for AI activity events
    const handleAIActivity = (
      e: CustomEvent<{ type: string; elementId?: string; description?: string }>
    ) => {
      const { type, description } = e.detail;

      if (type === "completed" || type === "failed") {
        addActivity(
          type === "completed" ? "✅ AI completed successfully!" : "⚠️ AI operation finished",
          type === "completed" ? "success" : "working",
          type === "completed" ? CheckCircle : Zap
        );
      } else if (description) {
        addActivity(`⚡ ${description}`, "ai", Sparkles);
      } else {
        addActivity(`⚡ AI ${type}...`, "ai", Sparkles);
      }
    };

    // Listen for scan events
    const handleScanStart = (e: CustomEvent<{ elementId: string; scanType: string; description?: string }>) => {
      const { scanType, description } = e.detail;
      const scanMessages: Record<string, { message: string; icon: React.ElementType }> = {
        screenshot: { message: "📸 Capturing screenshot...", icon: Camera },
        reading: { message: "👁️ Reading element...", icon: Eye },
        analyzing: { message: "🔍 Analyzing element...", icon: Sparkles },
        generating: { message: "✨ Generating content...", icon: Wand2 },
        verifying: { message: "✅ Verifying element...", icon: CheckCircle },
      };
      const config = scanMessages[scanType] || { message: description || "Processing...", icon: Loader2 };
      addActivity(config.message, scanType === "screenshot" ? "screenshot" : "reading", config.icon);
    };

    const handleScanComplete = () => {
      addActivity("✅ Scan complete!", "success", CheckCircle);
    };

    // Listen for screenshot events (legacy)
    const handleScreenshot = () => {
      addActivity("📸 Taking screenshot...", "screenshot", Camera);
    };

    const handleScreenshotComplete = (
      e: CustomEvent<{ elementId: string; imageData?: string; error?: string }>
    ) => {
      if (e.detail.error) {
        addActivity("❌ Screenshot failed", "working", Camera);
      } else {
        addActivity("✅ Screenshot captured!", "success", CheckCircle);
      }
    };

    window.addEventListener("mcp-command", handleCommand as EventListener);
    window.addEventListener("mcp-ai-activity", handleAIActivity as EventListener);
    window.addEventListener("mcp-scan-start", handleScanStart as EventListener);
    window.addEventListener("mcp-scan-complete", handleScanComplete as EventListener);
    window.addEventListener("mcp-screenshot-start", handleScreenshot as EventListener);
    window.addEventListener("mcp-screenshot-complete", handleScreenshotComplete as EventListener);

    return () => {
      window.removeEventListener("mcp-command", handleCommand as EventListener);
      window.removeEventListener("mcp-ai-activity", handleAIActivity as EventListener);
      window.removeEventListener("mcp-scan-start", handleScanStart as EventListener);
      window.removeEventListener("mcp-scan-complete", handleScanComplete as EventListener);
      window.removeEventListener("mcp-screenshot-start", handleScreenshot as EventListener);
      window.removeEventListener("mcp-screenshot-complete", handleScreenshotComplete as EventListener);
    };
  }, []);

  if (activities.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-100 flex flex-col gap-2 max-w-md">
      {activities.map((activity, index) => {
        const Icon = activity.icon;
        const colors = typeConfig[activity.type];
        const isAnimated = activity.type !== "success";

        return (
          <div
            key={activity.id}
            className={`${colors.bgColor} ${colors.borderColor} border backdrop-blur-sm rounded-xl shadow-lg px-4 py-2.5 flex items-center gap-3 animate-in slide-in-from-left-4 fade-in duration-300`}
            style={{
              animationDelay: `${index * 50}ms`,
            }}
          >
            <div className={`relative ${isAnimated ? "animate-pulse" : ""}`}>
              <Icon
                className={`w-5 h-5 ${colors.textColor} ${isAnimated && activity.type !== "reading" ? "animate-spin" : ""}`}
                style={{ animationDuration: isAnimated ? "2s" : undefined }}
              />
              {isAnimated && activity.type === "ai" && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-violet-400 rounded-full animate-ping" />
              )}
            </div>
            <span className={`text-sm ${colors.textColor} font-medium`}>
              {activity.message}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default MCPActivityStatus;
