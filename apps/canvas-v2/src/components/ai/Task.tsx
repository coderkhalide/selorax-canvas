import React from 'react';
import { Check, Clock, AlertCircle } from 'lucide-react';

interface TaskItemProps {
    status: 'pending' | 'in-progress' | 'done' | 'error';
    children: React.ReactNode;
}

export function TaskList({ children }: { children: React.ReactNode }) {
    return <div className="space-y-2 my-2">{children}</div>;
}

export function TaskItem({ status, children }: TaskItemProps) {
    return (
        <div className="flex items-center gap-2 text-xs p-2 rounded bg-white border border-gray-200 shadow-sm">
            <div className="flex-shrink-0">
                {status === 'done' && <div className="w-4 h-4 bg-green-50 rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-green-600" /></div>}
                {status === 'in-progress' && <div className="w-4 h-4 bg-blue-50 rounded-full flex items-center justify-center"><Clock className="w-2.5 h-2.5 text-blue-600 animate-pulse" /></div>}
                {status === 'pending' && <div className="w-4 h-4 bg-gray-100 rounded-full" />}
                {status === 'error' && <div className="w-4 h-4 bg-red-50 rounded-full flex items-center justify-center"><AlertCircle className="w-2.5 h-2.5 text-red-600" /></div>}
            </div>
            <div className={`flex-1 ${status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                {children}
            </div>
        </div>
    );
}
