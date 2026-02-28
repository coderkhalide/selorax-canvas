import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Database, Loader2, KeyRound, Trash2, AlertCircle } from "lucide-react";
import { DeleteConfirmModal } from "./DeleteConfirmModal";

interface SaveLandingPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, apiKey?: string) => void;
  onUpdate?: (name: string, apiKey: string) => void;
  onDelete?: (apiKey: string) => void;
  isSaving: boolean;
  mode?: 'create' | 'update';
  existingName?: string;
  recordId?: string;
}

export const SaveLandingPageModal: React.FC<SaveLandingPageModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  onDelete,
  isSaving,
  mode = 'create',
  existingName = '',
  recordId = '',
}) => {
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setName(mode === 'update' ? existingName : "");
      setApiKey("");
      setShowApiKeyInput(mode === 'update');
      setError(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, mode, existingName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Page name is required");
      return;
    }

    if (mode === 'update') {
      if (!apiKey.trim()) {
        setError("API Key is required for update operation");
        return;
      }
      onUpdate?.(name.trim(), apiKey.trim());
    } else {
      if (showApiKeyInput && apiKey.trim()) {
        onSave(name.trim(), apiKey.trim());
      } else {
        onSave(name.trim());
      }
    }
  };

  const handleDeleteClick = () => {
    if (!apiKey.trim()) {
      setError("API Key is required for delete operation");
      return;
    }
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    onDelete?.(apiKey.trim());
    setShowDeleteConfirm(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  const isUpdateMode = mode === 'update';

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${isUpdateMode ? 'bg-blue-100' : 'bg-purple-100'} rounded-lg flex items-center justify-center`}>
              {isUpdateMode ? (
                <KeyRound className="w-5 h-5 text-blue-600" />
              ) : (
                <Database className="w-5 h-5 text-purple-600" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isUpdateMode ? 'Update Landing Page' : 'Save Landing Page'}
              </h2>
              <p className="text-sm text-gray-500">
                {isUpdateMode ? 'Update or delete your landing page' : 'Give your landing page a name'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Record ID display for update mode */}
          {isUpdateMode && recordId && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Record ID</p>
              <p className="text-sm font-mono text-gray-700">{recordId}</p>
            </div>
          )}

          {/* Name input */}
          <div className="mb-4">
            <label
              htmlFor="landing-page-name"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Landing Page Name
            </label>
            <input
              ref={inputRef}
              id="landing-page-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="e.g., Summer Sale Hero, Product Launch v2"
              disabled={isSaving}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-gray-50"
            />
          </div>

          {/* API Key input toggle for create mode */}
          {!isUpdateMode && (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <KeyRound className="w-4 h-4" />
                {showApiKeyInput ? 'Hide' : 'Use custom'} API Key
              </button>
            </div>
          )}

          {/* API Key input */}
          {(showApiKeyInput || isUpdateMode) && (
            <div className="mb-4">
              <label
                htmlFor="api-key"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                PocketBase API Key {isUpdateMode && <span className="text-red-500">*</span>}
              </label>
              <input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setError(null);
                }}
                placeholder="Enter your API key..."
                disabled={isSaving}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                {isUpdateMode ? 'Required for update/delete operations' : 'Optional: defaults to environment variable'}
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            {isUpdateMode && onDelete && (
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={isSaving || !apiKey.trim()}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}

            <button
              type="submit"
              disabled={!name.trim() || isSaving || (isUpdateMode && !apiKey.trim())}
              className={`flex-1 px-4 py-2.5 ${isUpdateMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-500'} rounded-lg text-white font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isUpdateMode ? 'Updating...' : 'Saving...'}
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  {isUpdateMode ? 'Update' : 'Save'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        isDeleting={isSaving}
        itemName={name}
      />
    </div>,
    document.body
  );
};
