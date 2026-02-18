import { Monitor, Search, Folder, Plus, Sun, Moon } from 'lucide-react';
import clsx from 'clsx';

interface FileSystemHeaderProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    darkMode: boolean;
    toggleDarkMode: () => void;
    onNewFolder: () => void;
    onNewFile: () => void;
}

export default function FileSystemHeader({
    searchQuery,
    setSearchQuery,
    darkMode,
    toggleDarkMode,
    onNewFolder,
    onNewFile
}: FileSystemHeaderProps) {
    return (
        <header className="h-16 flex items-center justify-between px-6 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                    <Monitor className="w-5 h-5" />
                </div>
                <span className="font-semibold text-lg tracking-tight">File Editor</span>
            </div>

            {/* Search Bar - Center */}
            <div className="flex-1 max-w-xl mx-6">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-600 dark:group-focus-within:text-zinc-200 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search files..."
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-zinc-700 transition"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Actions - Right */}
            <div className="flex items-center space-x-2">
                <button
                    onClick={onNewFolder}
                    className="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-300"
                    title="New Folder"
                >
                    <Folder className="w-5 h-5" />
                </button>
                <button
                    onClick={onNewFile}
                    className="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-300"
                    title="New File"
                >
                    <Plus className="w-5 h-5" />
                </button>
                <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-800 mx-1"></div>
                <button
                    onClick={toggleDarkMode}
                    className="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-300"
                    title="Toggle Theme"
                >
                    {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
            </div>
        </header>
    );
}
