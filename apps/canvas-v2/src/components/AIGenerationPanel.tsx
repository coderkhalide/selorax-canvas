import React, { useRef, useState } from "react";
import {
  Sparkles,
  X,
  Wand2,
  Grid,
  List as ListIcon,
  Image as ImageIcon,
  LayoutTemplate,
} from "lucide-react";

interface AIGenerationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string, style: string, image?: string | null) => void;
  position?: { top: number; left: number };
  selectedImage?: string | null;
  setSelectedImage?: (image: string | null) => void;
}

const TEMPLATES = [
  { id: "magic", name: "Magic", icon: Sparkles },
  { id: "list", name: "List", icon: ListIcon },
  { id: "boxes", name: "Cards", icon: Grid },
  { id: "step", name: "Steps", icon: LayoutTemplate },
  { id: "carousel", name: "Media", icon: ImageIcon },
];

export const AIGenerationPanel: React.FC<AIGenerationPanelProps> = ({
  isOpen,
  onClose,
  onSubmit,
  position,
  selectedImage,
  setSelectedImage,
}) => {
  const [prompt, setPrompt] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("magic");
  const [isGenerating, setIsGenerating] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Reset state when panel closes
  React.useEffect(() => {
    if (!isOpen) {
      setPrompt("");
      setSelectedTemplate("magic");
      setIsGenerating(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() && selectedTemplate === "magic") return;
    setIsGenerating(true);
    onSubmit(prompt, selectedTemplate, selectedImage);
    // Force close or reset if parent doesn't close immediately (cleanup)
    setTimeout(() => setIsGenerating(false), 3000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && setSelectedImage) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        setSelectedImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob && setSelectedImage) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const result = event.target?.result as string;
            if (result) {
              const base64 = result.split(",")[1];
              setSelectedImage(base64);
            }
          };
          reader.readAsDataURL(blob);
          e.preventDefault();
        }
      }
    }
  };

  return (
    <div
      className="absolute z-[100] animate-in fade-in zoom-in-95 duration-200"
      style={{
        top: position ? position.top + 20 : "50%",
        left: position ? "50%" : "50%",
        transform: "translate(-50%, 0)",
        width: "600px",
        maxWidth: "90vw",
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-blue-100 overflow-hidden">
        {/* Header - Gradient Background */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 flex justify-between items-center border-b border-blue-100">
          <div className="flex items-center gap-2 text-blue-900">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-lg">Generate Component</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-white/50 p-1 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  selectedImage
                    ? "Describe how to use this image"
                    : "Paste image here or describe what to make"
                }
                className="w-full text-lg px-4 py-4 pr-12 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-sm text-black"
                onPaste={handlePaste}
                autoFocus
              />
              <button
                type="submit"
                disabled={
                  (!prompt.trim() && selectedTemplate === "magic") ||
                  isGenerating
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGenerating ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                ) : (
                  <Wand2 className="w-5 h-5" />
                )}
              </button>
            </div>

            <div className="mt-2 flex justify-between items-center text-xs text-gray-400 px-1">
              <span>Press Enter to generate</span>
              {/* <span>{320} credits remaining</span> */}
            </div>
          </form>

          <div className="mt-4 flex items-center gap-3">
            {selectedImage && (
              <div className="relative group w-14 h-14">
                <img
                  src={`data:image/png;base64,${selectedImage}`}
                  alt=""
                  className="w-full h-full object-cover rounded border border-gray-200"
                />
                <button
                  onClick={() => setSelectedImage?.(null)}
                  className="absolute top-1 right-1 bg-white text-gray-900 shadow-sm border border-gray-200 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <input
              type="file"
              ref={imageInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleImageUpload}
            />
            <button
              onClick={() => imageInputRef.current?.click()}
              className="bg-gray-100 text-gray-600 p-2 rounded hover:bg-gray-200 border border-gray-200"
              title="Upload Reference Image"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Templates / Styles */}
          <div className="mt-6">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 block">
              Choose a template
            </label>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => setSelectedTemplate(tmpl.id)}
                  className={`flex flex-col items-center gap-2 p-3 min-w-[80px] rounded-lg border transition-all ${
                    selectedTemplate === tmpl.id
                      ? "bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <tmpl.icon
                    className={`w-6 h-6 ${
                      selectedTemplate === tmpl.id
                        ? "text-blue-600"
                        : "text-gray-400"
                    }`}
                  />
                  <span className="text-xs font-medium">{tmpl.name}</span>
                </button>
              ))}
            </div>
          </div>
          {/* 
          <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2 overflow-x-auto">
            {[
              "Style Guide",
              "Sizing Guide",
              "Gift Options",
              "Custom Orders",
            ].map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-gray-100/80 text-gray-600 text-xs rounded-full cursor-pointer hover:bg-gray-200"
              >
                + {tag}
              </span>
            ))}
          </div> */}
        </div>
      </div>
    </div>
  );
};
