import React, { useState } from 'react';
import { ChevronDown, ChevronRight, BrainCircuit, CheckCircle2, Circle, Loader2 } from 'lucide-react';

interface Step {
    id: string;
    label: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    details?: string;
}

interface ChainOfThoughtProps {
    steps: Step[];
    isThinking: boolean;
    className?: string;
}

export function ChainOfThought({ steps, isThinking, className = '' }: ChainOfThoughtProps) {
    const [isOpen, setIsOpen] = useState(true);

    if (steps.length === 0 && !isThinking) return null;

    return (
        <div className={`border border-gray-200 rounded-lg bg-gray-50 overflow-hidden ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50 transition-colors text-xs font-medium text-gray-700 border-b border-gray-200"
            >
                <div className="flex items-center gap-2">
                    <BrainCircuit className={`w-4 h-4 ${isThinking ? 'text-purple-600 animate-pulse' : 'text-gray-400'}`} />
                    <span>{isThinking ? 'Thinking Process...' : 'Reasoning Complete'}</span>
                </div>
                {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            </button>

            {isOpen && (
                <div className="p-3 space-y-3 bg-white">
                    {steps.map((step) => (
                        <div key={step.id} className="flex gap-3 text-xs">
                            <div className="mt-0.5">
                                {step.status === 'running' && <Loader2 className="w-3.5 h-3.5 text-purple-600 animate-spin" />}
                                {step.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
                                {step.status === 'pending' && <Circle className="w-3.5 h-3.5 text-gray-300" />}
                                {step.status === 'failed' && <Circle className="w-3.5 h-3.5 text-red-600" />}
                            </div>
                            <div className="flex-1">
                                <div className={`font-medium ${step.status === 'running' ? 'text-purple-700' :
                                        step.status === 'completed' ? 'text-gray-900' : 'text-gray-500'
                                    }`}>
                                    {step.label}
                                </div>
                                {step.details && (
                                    <div className="mt-1 text-gray-600 font-mono text-[10px] bg-gray-50 p-1.5 rounded border border-gray-200">
                                        {step.details}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isThinking && steps.length === 0 && (
                        <div className="flex gap-3 text-xs opacity-50 text-gray-500">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Analyzing request...</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
