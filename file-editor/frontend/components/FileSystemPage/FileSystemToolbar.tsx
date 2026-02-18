import { ArrowLeft, ChevronRight, ArrowUpDown, List, LayoutGrid } from 'lucide-react';
import clsx from 'clsx';

interface FileSystemToolbarProps {
    currentPath: string;
    navigateTo: (path: string) => void;
    navigateUp: () => void;
    sortField: 'name' | 'mtime' | 'size';
    setSortField: (field: 'name' | 'mtime' | 'size') => void;
    sortOrder: 'asc' | 'desc';
    setSortOrder: (order: 'asc' | 'desc') => void;
    viewMode: 'grid' | 'list';
    setViewMode: (mode: 'grid' | 'list') => void;
}

export default function FileSystemToolbar({
    currentPath,
    navigateTo,
    navigateUp,
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,
    viewMode,
    setViewMode
}: FileSystemToolbarProps) {
    const activeFolderPath = currentPath.endsWith('/') ? currentPath.slice(0, -1) : currentPath;
    const isRoot = activeFolderPath === '' || activeFolderPath === '/';

    // Logic from page.tsx to determine breadcrumbs
    // Note: page.tsx handles file vs folder path logic. Here we assume currentPath passed is the folder path or we handle it?
    // Actually page.tsx calculates activeFolderPath. Let's assume the parent passes the correct base path for breadcrumbs.
    // We'll calculate breadcrumbs from currentPath.

    const breadcrumbs = currentPath.split('/').filter(Boolean);

    return (
        <div className="h-12 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-sm">
            <div className="flex items-center text-sm text-zinc-500 dark:text-zinc-400 overflow-hidden">
                <button
                    onClick={navigateUp}
                    className="mr-2 p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    title="Go Back"
                >
                    <ArrowLeft className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                </button>
                <button onClick={() => navigateTo('/')} className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors px-1 rounded">Home</button>
                {breadcrumbs.map((segment, index) => (
                    <div key={index} className="flex items-center">
                        <ChevronRight className="w-3 h-3 mx-1 text-zinc-300 dark:text-zinc-600" />
                        <button onClick={() => navigateTo('/' + breadcrumbs.slice(0, index + 1).join('/'))} className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors px-1 rounded font-medium">{segment}</button>
                    </div>
                ))}
            </div>

            <div className="flex items-center space-x-2">
                {/* Sort Toggle */}
                <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="p-1.5 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 rounded-md text-zinc-500 transition-colors"
                    title="Sort Order"
                >
                    <ArrowUpDown className="w-4 h-4" />
                </button>

                {/* View Toggle */}
                <div className="flex items-center bg-zinc-200/50 dark:bg-zinc-800 rounded-md p-0.5">
                    <button
                        onClick={() => setViewMode('list')}
                        className={clsx("p-1.5 rounded-sm transition-all", viewMode === 'list' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-400 hover:text-zinc-600")}
                    >
                        <List className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('grid')}
                        className={clsx("p-1.5 rounded-sm transition-all", viewMode === 'grid' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-400 hover:text-zinc-600")}
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
