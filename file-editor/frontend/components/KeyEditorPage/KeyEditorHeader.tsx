import React from 'react';
import { Save } from 'lucide-react';

interface KeyEditorHeaderProps {
    targetKey: string;
    onClose: () => void;
    onSave: () => void;
}

export default function KeyEditorHeader({ targetKey, onClose, onSave }: KeyEditorHeaderProps) {
    return (
        <div className="h-16 flex items-center justify-between px-8 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md flex-shrink-0 z-10 sticky top-0">
            <div className="flex items-center space-x-3">
                <div className="p-1.5 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                    <span className="text-violet-600 dark:text-violet-400 font-bold text-xs px-1">KEY</span>
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">Edit Key</h2>
                    <p className="text-xs text-zinc-500 font-mono mt-0.5">{targetKey}</p>
                </div>
            </div>

            <div className="flex space-x-3">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium"
                >
                    Cancel
                </button>
                <button
                    onClick={onSave}
                    className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm hover:shadow transition-all text-sm font-medium"
                >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                </button>
            </div>
        </div>
    );
}
