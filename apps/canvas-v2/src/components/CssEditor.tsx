import React from 'react';
import { X, Code } from 'lucide-react';
import { useFunnel } from '../context/FunnelContext';

interface CssEditorProps {
    onClose: () => void;
}

export const CssEditor: React.FC<CssEditorProps> = ({ onClose }) => {
    const { globalCss, setGlobalCss } = useFunnel();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white w-[600px] h-[500px] rounded-xl border border-gray-200 shadow-2xl flex flex-col">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2 text-gray-900">
                        <Code className="w-5 h-5 text-blue-600" /> Global Custom CSS
                    </h3>
                    <button onClick={onClose}>
                        <X className="w-5 h-5 text-gray-500 hover:text-gray-700" />
                    </button>
                </div>
                <div className="flex-1 p-4">
                    <textarea
                        value={globalCss}
                        onChange={(e) => setGlobalCss(e.target.value)}
                        className="w-full h-full bg-gray-50 font-mono text-sm text-gray-800 p-4 rounded-lg focus:outline-none resize-none border border-gray-200 focus:border-blue-500"
                        placeholder="/* Custom CSS */"
                    />
                </div>
                <div className="p-4 border-t border-gray-200 flex justify-end">
                    <button onClick={onClose} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-medium">
                        Save & Close
                    </button>
                </div>
            </div>
        </div>
    );
};
