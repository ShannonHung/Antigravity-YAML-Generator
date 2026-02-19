import React from 'react';
import { ArrowLeft } from 'lucide-react';
import FileBreadcrumb from '../common/FileBreadcrumb';

interface KeyEditorToolbarProps {
    filePath: string;
    onClose: () => void;
    onNavigate: (path: string) => void;
}

export default function KeyEditorToolbar({ filePath, onClose, onNavigate }: KeyEditorToolbarProps) {
    return (
        <div className="h-12 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-6 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-sm">
            <div className="flex items-center text-sm text-zinc-500 dark:text-zinc-400 overflow-hidden flex-1">
                <button
                    onClick={onClose}
                    className="mr-2 p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors flex-shrink-0"
                    title="Go Back"
                >
                    <ArrowLeft className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                </button>
                <FileBreadcrumb path={filePath} onNavigate={onNavigate} />
            </div>
        </div>
    );
}
