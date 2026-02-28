import React, { useState } from 'react';
import { X, KeyRound, Trash2, Save, AlertCircle } from 'lucide-react';

interface ApiKeyConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (apiKey: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  mode: 'update' | 'delete';
  title: string;
}

export const ApiKeyConfirmModal: React.FC<ApiKeyConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onDelete,
  mode,
  title,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!apiKey.trim()) {
      setError('API Key is required');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      await onConfirm(apiKey);
      setApiKey('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!apiKey.trim()) {
      setError('API Key is required');
      return;
    }

    if (!onDelete) return;

    if (!confirm('Are you sure you want to delete this landing page?')) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      await onDelete();
      setApiKey('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setApiKey('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-500">
                Enter your PocketBase API key to proceed
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* API Key Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PocketBase API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setError(null);
              }}
              placeholder="Enter your API key..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isProcessing}
            />
            <p className="text-xs text-gray-500 mt-1">
              Your API key is stored in environment variables and used only for this operation
            </p>
          </div>

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
            {mode === 'update' && (
              <button
                onClick={handleConfirm}
                disabled={isProcessing || !apiKey.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isProcessing ? 'Updating...' : 'Update'}
              </button>
            )}

            {onDelete && (
              <button
                onClick={handleDelete}
                disabled={isProcessing || !apiKey.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {isProcessing ? 'Deleting...' : 'Delete'}
              </button>
            )}

            {mode === 'delete' && !onDelete && (
              <button
                onClick={handleConfirm}
                disabled={isProcessing || !apiKey.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {isProcessing ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyConfirmModal;
