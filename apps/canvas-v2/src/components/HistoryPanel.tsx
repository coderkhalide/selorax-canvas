import React from 'react';
import { X, Clock, Trash2, HardDrive } from 'lucide-react';
import { useFunnel } from '../context/FunnelContext';

interface HistoryPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export function HistoryPanel({ isOpen, onClose }: HistoryPanelProps) {
    const { historyEntries, currentHistoryIndex, goToHistory, clearHistory, storageUsage, storageSize } = useFunnel();

    if (!isOpen) return null;

    const formatTime = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;

        const date = new Date(timestamp);
        return date.toLocaleDateString();
    };

    const handleClearHistory = () => {
        if (confirm('Are you sure you want to clear all history? This cannot be undone.')) {
            clearHistory();
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40 animate-in fade-in"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed right-0 top-0 h-full w-80 bg-white border-l border-gray-200 z-50 flex flex-col animate-in slide-in-from-right">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-purple-600" />
                        <h2 className="text-lg font-bold text-gray-900">History</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Storage Info */}
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                        <div className="flex items-center gap-1">
                            <HardDrive className="w-3 h-3" />
                            <span>Storage: {storageSize}</span>
                        </div>
                        <span>{(storageUsage * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                            className={`h-1.5 rounded-full transition-all ${storageUsage > 0.8 ? 'bg-red-500' : storageUsage > 0.5 ? 'bg-yellow-500' : 'bg-purple-500'
                                }`}
                            style={{ width: `${Math.min(storageUsage * 100, 100)}%` }}
                        />
                    </div>
                </div>

                {/* Keyboard Shortcuts */}
                <div className="p-4 bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
                    <div className="flex justify-between mb-1">
                        <span>Undo</span>
                        <kbd className="px-2 py-0.5 bg-gray-200 rounded text-gray-700">⌘/Ctrl + Z</kbd>
                    </div>
                    <div className="flex justify-between">
                        <span>Redo</span>
                        <kbd className="px-2 py-0.5 bg-gray-200 rounded text-gray-700">⌘/Ctrl + Shift + Z</kbd>
                    </div>
                </div>

                {/* History List */}
                <div className="flex-1 overflow-y-auto p-2">
                    {historyEntries.length === 0 ? (
                        <div className="text-center text-gray-500 mt-8">
                            <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No history yet</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {[...historyEntries].reverse().map((entry, reverseIndex) => {
                                const index = historyEntries.length - 1 - reverseIndex;
                                const isCurrent = index === currentHistoryIndex;
                                const isFuture = index > currentHistoryIndex;

                                return (
                                    <button
                                        key={entry.id}
                                        onClick={() => goToHistory(index)}
                                        className={`w-full text-left p-3 rounded-lg transition-all ${isCurrent
                                                ? 'bg-purple-600 text-white shadow-lg'
                                                : isFuture
                                                    ? 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                                                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className={`font-medium text-sm truncate ${isCurrent ? 'text-white' : isFuture ? 'text-gray-400' : 'text-gray-900'}`}>
                                                    {entry.description}
                                                </div>
                                                <div className={`text-xs mt-1 ${isCurrent ? 'text-purple-200' : isFuture ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {formatTime(entry.timestamp)}
                                                </div>
                                            </div>
                                            {isCurrent && (
                                                <div className="flex-shrink-0">
                                                    <div className="w-2 h-2 bg-white rounded-full" />
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200">
                    <button
                        onClick={handleClearHistory}
                        disabled={historyEntries.length <= 1}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 disabled:bg-gray-100 disabled:text-gray-400 text-red-600 rounded-lg transition-colors disabled:cursor-not-allowed"
                    >
                        <Trash2 className="w-4 h-4" />
                        <span className="text-sm font-medium">Clear History</span>
                    </button>
                    <div className="text-xs text-gray-500 text-center mt-2">
                        {historyEntries.length} {historyEntries.length === 1 ? 'entry' : 'entries'}
                    </div>
                </div>
            </div>
        </>
    );
}
