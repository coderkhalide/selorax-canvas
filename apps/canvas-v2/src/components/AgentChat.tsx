import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Bot,
  User,
  X,
  Paperclip,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Trash2,
  Zap,
  Wand2,
  CheckCircle2,
  Wrench,
  Brain,
  Eye,
  Palette,
  LayoutGrid,
  Camera,
  Circle,
} from "lucide-react";
import { useFunnelAgentMCP } from "../hooks/useFunnelAgentMCP";
import { useFunnel } from "../context/FunnelContext";
import { MCPStatusBadge } from "./mcp/MCPStatusBadge";
import ReactMarkdown from "react-markdown";

// Icon mapping for tool types
const toolIcons: Record<string, React.ElementType> = {
  think: Brain,
  getDesignGuidelines: Eye,
  getDesignSystem: Palette,
  getCapabilities: Eye,
  planDesign: Brain,
  generatePage: LayoutGrid,
  generateLandingPage: Sparkles,
  setElements: LayoutGrid,
  updateElement: Wrench,
  screenshotElement: Camera,
  aiActivityStart: Sparkles,
  aiActivityEnd: CheckCircle2,
  evaluateSectionQuality: Eye,
  improveSectionWithAI: Sparkles,
  searchIcon: Eye,
  default: Wrench,
};

interface AgentChatProps {
  pageId?: string;
  tenantId?: string;
}

export function AgentChat({ pageId, tenantId }: AgentChatProps = {}) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    clearMessages,
    setMessages,
    thinkingSteps,
    isThinking,
    processMessage,
    mcpStatus,
    mcpError,
    mcpTools,
    mcpResources,
    initializeMCP,
  } = useFunnelAgentMCP({ pageId, tenantId });
  const { selectedId: selectedElementId } = useFunnel();
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [attachments, setAttachments] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            setAttachments((prev) => [...prev, e.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              setAttachments((prev) => [...prev, e.target!.result as string]);
            }
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(e, attachments); // Pass attachments to hook
    setAttachments([]);
  };

  // Auto-scroll to bottom when messages or thinking steps change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinkingSteps]);

  // Listen for external triggers
  useEffect(() => {
    const handleTrigger = (e: CustomEvent) => {
      const { prompt } = e.detail;
      setIsOpen(true);
      processMessage(prompt); // triggers don't usually have attachments yet
    };

    window.addEventListener("trigger-ai-agent" as any, handleTrigger);
    return () =>
      window.removeEventListener("trigger-ai-agent" as any, handleTrigger);
  }, [processMessage]);

  return (
    <>
      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-full shadow-lg transition-all hover:scale-110 flex items-center gap-2"
        >
          <Sparkles className="w-6 h-6" />
          <span className="font-bold">AI Agent</span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[600px] bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
          {/* Header */}
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Funnel Agent</h3>
                <div className="mt-0.5">
                  <MCPStatusBadge
                    status={mcpStatus}
                    onReconnect={initializeMCP}
                    tools={mcpTools}
                    resources={mcpResources}
                    error={mcpError}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearMessages}
                className="text-gray-400 hover:text-red-400 transition-colors p-1 rounded-md hover:bg-gray-200"
                title="Clear Chat"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-900 transition-colors p-1 rounded-md hover:bg-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Context Indicator */}
          {selectedElementId && (
            <div className="px-4 py-3 bg-purple-50 border-b border-purple-200 flex items-center justify-between animate-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-xs text-purple-800 overflow-hidden">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.5)] flex-shrink-0" />
                <div className="flex flex-col overflow-hidden">
                  <span className="font-medium truncate">
                    Editing:{" "}
                    <span className="opacity-75 font-mono">
                      {selectedElementId}
                    </span>
                  </span>
                </div>
              </div>
              <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200 flex-shrink-0">
                Selected
              </span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            {messages.length === 0 && thinkingSteps.length === 0 && (
              <div className="text-center text-gray-400 mt-10">
                <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>How can I help you build your funnel today?</p>
              </div>
            )}

            {/* User/Assistant Messages First */}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    m.role === "user" ? "bg-blue-600" : "bg-purple-600"
                  }`}
                >
                  {m.role === "user" ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                    m.role === "user"
                      ? "bg-blue-50 text-blue-900 rounded-tr-none"
                      : "bg-gray-100 text-gray-900 rounded-tl-none"
                  }`}
                >
                  {/* Display Attachments if any */}
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {m.attachments.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt="attachment"
                          className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                        />
                      ))}
                    </div>
                  )}
                  <div className="prose prose-sm max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4">
                    <ReactMarkdown
                      components={{
                        code({ node, className, children, ...props }) {
                          return (
                            <code
                              className={`${className} bg-gray-200 rounded px-1 py-0.5 text-purple-700 font-mono text-xs`}
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        },
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-gray-100 p-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                  <span className="text-xs text-gray-500">Thinking...</span>
                </div>
              </div>
            )}

            {/* Analyzing indicator when thinking but no steps yet */}
            {isThinking && thinkingSteps.length === 0 && (
              <div className="flex gap-2 animate-in slide-in-from-left-2 fade-in duration-200">
                <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Loader2 className="w-3.5 h-3.5 text-purple-600 animate-spin" />
                </div>
                <div className="flex-1 p-2.5 rounded-xl text-xs bg-purple-50 border border-purple-200">
                  <span className="text-purple-700 font-medium">Analyzing request via MCP...</span>
                </div>
              </div>
            )}

            {/* Tool Steps at the Bottom */}
            {thinkingSteps.map((step) => {
              // Parse tool name from label (e.g., "MCP Tool: think" -> "think")
              const toolMatch = step.label.match(/MCP Tool:\s*(\w+)/i);
              const toolName = toolMatch ? toolMatch[1] : "default";
              const ToolIcon = toolIcons[toolName] || toolIcons.default;

              const isRunning = step.status === "running";
              const isCompleted = step.status === "completed";
              const isFailed = step.status === "failed";

              return (
                <div
                  key={step.id}
                  className="flex gap-2 animate-in slide-in-from-left-2 fade-in duration-200"
                >
                  {/* Status Icon */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isRunning ? "bg-purple-100" :
                    isCompleted ? "bg-green-100" :
                    isFailed ? "bg-red-100" : "bg-gray-100"
                  }`}>
                    {isRunning ? (
                      <Loader2 className="w-3.5 h-3.5 text-purple-600 animate-spin" />
                    ) : isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    ) : isFailed ? (
                      <X className="w-3.5 h-3.5 text-red-600" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-gray-400" />
                    )}
                  </div>

                  {/* Message Content */}
                  <div className={`flex-1 p-2.5 rounded-xl text-xs ${
                    isRunning ? "bg-purple-50 border border-purple-200" :
                    isCompleted ? "bg-gray-50 border border-gray-200" :
                    isFailed ? "bg-red-50 border border-red-200" : "bg-gray-50 border border-gray-200"
                  }`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <ToolIcon className={`w-3.5 h-3.5 ${
                        isRunning ? "text-purple-600" :
                        isCompleted ? "text-gray-600" :
                        isFailed ? "text-red-600" : "text-gray-400"
                      }`} />
                      <span className={`font-semibold ${
                        isRunning ? "text-purple-700" :
                        isCompleted ? "text-gray-700" :
                        isFailed ? "text-red-700" : "text-gray-500"
                      }`}>
                        {step.label}
                      </span>
                    </div>
                    {step.details && (
                      <div className="mt-1.5 text-gray-600 font-mono text-[10px] bg-white/50 p-1.5 rounded border border-gray-100 overflow-hidden">
                        <div className="truncate">{step.details.length > 80 ? step.details.slice(0, 80) + "..." : step.details}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-gray-50 border-t border-gray-200">
            {/* Attachment Previews */}
            {attachments.length > 0 && (
              <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
                {attachments.map((url, i) => (
                  <div
                    key={i}
                    className="relative w-16 h-16 group flex-shrink-0"
                  >
                    <img
                      src={url}
                      alt="preview"
                      className="w-full h-full object-cover rounded-lg border border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => removeAttachment(i)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Shortcuts */}
            {messages.length === 0 && (
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-none">
                {[
                  {
                    label: "Fix Spelling",
                    icon: <Sparkles className="w-3 h-3" />,
                    prompt: "Fix spelling and grammar in the selected element",
                  },
                  {
                    label: "Make Professional",
                    icon: <Zap className="w-3 h-3" />,
                    prompt: "Rewrite the content to be more professional",
                  },
                  {
                    label: "Analyze Layout",
                    icon: <Bot className="w-3 h-3" />,
                    prompt:
                      "Analyze the current layout and suggest improvements",
                  },
                ].map((shortcut, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setMessages((prev) => [
                        ...prev,
                        {
                          id: Date.now().toString(),
                          role: "user",
                          content: shortcut.prompt,
                        },
                      ]);
                      handleInputChange({
                        target: { value: shortcut.prompt },
                      } as any);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-100 text-xs text-gray-600 rounded-full transition-colors whitespace-nowrap border border-gray-200"
                  >
                    {shortcut.icon}
                    {shortcut.label}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={onFormSubmit} className="relative">
              <textarea
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onFormSubmit(e);
                  }
                }}
                onPaste={handlePaste} // Handle Paste
                placeholder="Ask me to change colors, text, or layout..."
                className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-4 pr-12 text-sm text-gray-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none min-h-[50px] max-h-[150px] scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent"
                rows={1}
                style={{ height: "auto", minHeight: "50px" }}
              />
              <button
                type="submit"
                disabled={
                  isLoading || (!input.trim() && attachments.length === 0)
                }
                className="absolute right-2 bottom-2 p-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:hover:bg-purple-600 text-white rounded-lg transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileSelect}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Upload Screenshot"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <button
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Attach File (Coming Soon)"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-gray-300 mx-1"></div>
              <button
                onClick={() => {
                  const prompt =
                    "Analyze the current page layout and content. Identify areas for improvement in conversion, design, and copy. Then, use the updateLayout tool to apply a professional, high-converting redesign.";
                  processMessage(prompt);
                }}
                className="text-purple-600 hover:text-purple-500 transition-colors flex items-center gap-1 text-xs font-medium"
                title="Auto Fix & Optimize"
              >
                <Wand2 className="w-3 h-3" />
                <span>Auto Fix</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
