import React from 'react';
import { ArrowLeft, Maximize2, Minimize2 } from 'lucide-react';
import FileBreadcrumb from '../common/FileBreadcrumb';

interface JsonTreeToolbarProps {
    filePath: string;
    onBack: () => void;
    onNavigate: (path: string) => void;
    expandAll: () => void;
    collapseAll: () => void;
}

export default function JsonTreeToolbar({
    filePath,
    onBack,
    onNavigate,
    expandAll,
    collapseAll
}: JsonTreeToolbarProps) {
    return (
        <div className="h-12 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-sm">
            <div className="flex items-center text-sm text-zinc-500 dark:text-zinc-400 overflow-hidden flex-1 mr-4">
                <button
                    onClick={onBack}
                    className="mr-2 p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors flex-shrink-0"
                    title="Go Back"
                >
                    <ArrowLeft className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                </button>
                <FileBreadcrumb path={filePath} onNavigate={onNavigate} />
            </div>

            <div className="flex items-center space-x-1 bg-zinc-200/50 dark:bg-zinc-800 rounded-lg p-0.5">
                <button
                    onClick={expandAll}
                    className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-all"
                    title="Expand All"
                >
                    <Maximize2 className="w-4 h-4" />
                </button>
                <button
                    onClick={collapseAll}
                    className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-all"
                    title="Collapse All"
                >
                    <Minimize2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
