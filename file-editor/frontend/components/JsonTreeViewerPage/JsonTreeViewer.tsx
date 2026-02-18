'use client';

import React from 'react';
import { Search, ArrowLeft, Home, Moon, Sun, Plus, Maximize2, Minimize2 } from 'lucide-react';

// Hooks
import { useJsonData } from './hooks/useJsonData';
import { useJsonUiState } from './hooks/useJsonUiState';
import { useJsonSortFilter } from './hooks/useJsonSortFilter';
import { useJsonMutations } from './hooks/useJsonMutations';
import { useTheme } from '../FileSystemPage/hooks/useTheme'; // Reuse global theme hook if possible, or create local

// Components
import TreeNode from './TreeNode';
import AddKeyModal from './AddKeyModal';

interface JsonTreeViewerProps {
    content: string;
    fileName: string;
    filePath: string;
    onClose: () => void;
    onBack: () => void;
    onHome: () => void;
    onEditKey: (keyPath: string) => void;
}

export default function JsonTreeViewer({ content, fileName, filePath, onClose, onBack, onHome, onEditKey }: JsonTreeViewerProps) {
    // 1. Data Store
    const { nodes, setNodes, error } = useJsonData(content);

    // 2. UI State
    const {
        expandedKeys, toggleExpand, expandAll, collapseAll,
        isAddKeyModalOpen, setIsAddKeyModalOpen,
        deleteTarget, setDeleteTarget
    } = useJsonUiState(nodes);

    // 3. Sorting & Filtering
    const {
        filterText, setFilterText,
        sortField, setSortField,
        sortOrder, setSortOrder,
        filteredNodes, handleSort
    } = useJsonSortFilter(nodes);

    // 4. Mutations
    const { handleDelete, handleSaveNewKey } = useJsonMutations(filePath, nodes, setNodes, setDeleteTarget, setIsAddKeyModalOpen);

    // 5. Theme
    const { darkMode, toggleDarkMode } = useTheme();

    if (error) {
        return <div className="p-8 text-red-500">{error}</div>;
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-zinc-950 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="h-14 flex items-center justify-between px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md">
                <div className="flex items-center space-x-4">
                    <button onClick={onBack} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center">
                        <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 text-[10px] px-1.5 py-0.5 rounded mr-2 font-mono uppercase tracking-wider">JSON</span>
                        {fileName}
                    </h2>
                    <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800"></div>
                    <div className="relative group w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Filter keys..."
                            className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-full py-1.5 pl-9 pr-4 text-xs md:text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <button onClick={expandAll} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors" title="Expand All">
                        <Maximize2 className="w-4 h-4" />
                    </button>
                    <button onClick={collapseAll} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors" title="Collapse All">
                        <Minimize2 className="w-4 h-4" />
                    </button>
                    <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 mx-2"></div>
                    <button onClick={() => setIsAddKeyModalOpen(true)} className="flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-medium transition-colors shadow-sm">
                        <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Key
                    </button>
                    <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 mx-2"></div>
                    <button onClick={toggleDarkMode} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-500" title="Toggle Theme">
                        {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                    <button onClick={onHome} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-500" title="Home">
                        <Home className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto bg-white dark:bg-zinc-950 p-8 md:p-12">
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm max-w-7xl mx-auto">
                    <table className="w-full text-left table-fixed">
                        <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 select-none">
                            <tr>
                                <th onClick={() => handleSort('key')} className="py-3 px-6 font-medium text-sm text-zinc-500 dark:text-zinc-400 w-1/3 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Key</th>
                                <th onClick={() => handleSort('type')} className="py-3 px-6 font-medium text-sm text-zinc-500 dark:text-zinc-400 w-48 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Type</th>
                                <th onClick={() => handleSort('required')} className="py-3 px-6 font-medium text-sm text-zinc-500 dark:text-zinc-400 w-24 text-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Req</th>
                                <th onClick={() => handleSort('description')} className="py-3 px-6 font-medium text-sm text-zinc-500 dark:text-zinc-400 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Description</th>
                                <th className="py-3 px-6 font-medium text-sm text-zinc-500 dark:text-zinc-400 w-24 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-950">
                            {filteredNodes.length > 0 ? (
                                filteredNodes.map((node, i) => (
                                    <TreeNode
                                        key={`${node.key}-${i}`}
                                        node={node}
                                        depth={0}
                                        filterText={filterText}
                                        expandedKeys={expandedKeys}
                                        toggleExpand={toggleExpand}
                                        onDelete={(n, p) => setDeleteTarget({ node: n, parentPath: p })}
                                        onEdit={onEditKey}
                                        parentPath=""
                                    />
                                ))
                            ) : (
                                <tr><td colSpan={5} className="py-8 text-center text-zinc-400 dark:text-zinc-600">No keys found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Key Modal */}
            {isAddKeyModalOpen && (
                <AddKeyModal
                    nodes={nodes}
                    onClose={() => setIsAddKeyModalOpen(false)}
                    onSave={handleSaveNewKey}
                />
            )}

            {/* Delete Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
                    <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-2xl w-full max-w-sm p-6 overflow-hidden">
                        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-2">Delete Key?</h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                            Are you sure you want to delete <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded text-red-500">{deleteTarget.node.key}</span>?
                            This cannot be undone.
                        </p>
                        <div className="flex justify-end space-x-2">
                            <button onClick={() => setDeleteTarget(null)} className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors">Cancel</button>
                            <button onClick={() => handleDelete(deleteTarget)} className="px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
