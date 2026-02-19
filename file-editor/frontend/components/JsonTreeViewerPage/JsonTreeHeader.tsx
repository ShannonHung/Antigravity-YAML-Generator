import React from 'react';
import { Search, Plus, Moon, Sun, Monitor } from 'lucide-react';

interface JsonTreeHeaderProps {
    fileName: string;
    filterText: string;
    setFilterText: (text: string) => void;
    isAddKeyModalOpen: boolean;
    setIsAddKeyModalOpen: (open: boolean) => void;
    darkMode: boolean;
    toggleDarkMode: () => void;
}

export default function JsonTreeHeader({
    fileName,
    filterText,
    setFilterText,
    setIsAddKeyModalOpen,
    darkMode,
    toggleDarkMode
}: JsonTreeHeaderProps) {
    return (
        <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md">
            <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <span className="text-blue-600 dark:text-blue-400 font-bold text-xs px-1">JSON</span>
                </div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">{fileName}</h2>
            </div>

            <div className="flex-1 max-w-xl mx-6">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Filter keys..."
                        className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-full py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex items-center space-x-2">
                <button
                    onClick={() => setIsAddKeyModalOpen(true)}
                    className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4 mr-1.5" /> Add Key
                </button>
                <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-2"></div>
                <button
                    onClick={toggleDarkMode}
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition-colors"
                    title="Toggle Theme"
                >
                    {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
            </div>
        </div>
    );
}
