"use client";
import { useState } from "react";
import { X, Loader2 } from "lucide-react";

const PAGE_TYPES = [
  { value: "landing_page", label: "Landing Page", desc: "Standalone marketing page" },
  { value: "product_template", label: "Product Template", desc: "Product detail page template" },
  { value: "collection", label: "Collection", desc: "Category or collection page" },
  { value: "funnel_step", label: "Funnel Step", desc: "Step in a conversion funnel" },
];

interface Props {
  onClose: () => void;
  onCreate: (title: string, type: string) => Promise<void>;
}

export function NewPageModal({ onClose, onCreate }: Props) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("landing_page");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setLoading(true);
    await onCreate(title.trim(), type);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">New Page</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Page Title</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Summer Sale Landing Page"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Page Type</label>
            <div className="grid grid-cols-2 gap-2">
              {PAGE_TYPES.map((pt) => (
                <button
                  key={pt.value}
                  onClick={() => setType(pt.value)}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    type === pt.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900">{pt.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{pt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-6 pt-0 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Page
          </button>
        </div>
      </div>
    </div>
  );
}
