import React, { useState } from "react";
import { useFunnel } from "../context/FunnelContext";
import { Plus, Trash, Settings, FileText } from "lucide-react";

export const PagesSidebar: React.FC = () => {
  const { elements } = useFunnel();
  const [isAdding, setIsAdding] = useState(false);
  const [newPageName, setNewPageName] = useState("");

  return (
    <div className="flex flex-col h-full bg-white text-gray-900">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="font-bold flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" /> Pages
        </h2>
        <button
          onClick={() => setIsAdding(true)}
          className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
          title="Add New Page"
        >
          <Plus size={18} className="text-gray-600 hover:text-gray-900" />
        </button>
      </div>

      {isAdding && (
        <div className="p-3 border-b border-gray-200 bg-gray-50">
          <input
            value={newPageName}
            onChange={(e) => setNewPageName(e.target.value)}
            placeholder="Page Name"
            className="w-full bg-white border border-gray-200 rounded p-2 text-sm text-gray-900 mb-2 focus:outline-none focus:border-blue-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") setIsAdding(false);
            }}
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setIsAdding(false)}
              className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-1"></div>
    </div>
  );
};
