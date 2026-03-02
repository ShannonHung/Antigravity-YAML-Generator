'use client';

import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

// Hooks
import { useJsonData } from './hooks/useJsonData';
import { useJsonUiState } from './hooks/useJsonUiState';
import { useJsonSortFilter } from './hooks/useJsonSortFilter';
import { useJsonMutations } from './hooks/useJsonMutations';
import { useTheme } from '../FileSystemPage/hooks/useTheme';

// Components
import TreeNode from './TreeNode';
import AddKeyModal from './AddKeyModal';
import JsonTreeHeader from './JsonTreeHeader';
import JsonTreeToolbar from './JsonTreeToolbar';

interface JsonTreeViewerProps {
    content: string;
    fileName: string;
    filePath: string;
    onClose: () => void;
    onBack: () => void;
    onHome: () => void;
    onEditKey: (keyPath: string) => void;
    onNavigate: (path: string) => void;
}

export default function JsonTreeViewer({ content, fileName, filePath, onClose, onBack, onHome, onEditKey, onNavigate }: JsonTreeViewerProps) {
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

    // 6. Quick Add Child state
    const [quickAddParentPath, setQuickAddParentPath] = useState<string | null>(null);
    const [quickAddInitialTypes, setQuickAddInitialTypes] = useState<string[]>([]);

    const handleAddChild = (parentPath: string, initialTypes: string[] = []) => {
        setQuickAddParentPath(parentPath);
        setQuickAddInitialTypes(initialTypes);
        setIsAddKeyModalOpen(true);
    };

    const handleCloseAddKeyModal = () => {
        setIsAddKeyModalOpen(false);
        setQuickAddParentPath(null);
        setQuickAddInitialTypes([]);
    };

    if (error) {
        return <div className="p-8 text-red-500">{error}</div>;
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-zinc-950 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            {/* Header */}
            <JsonTreeHeader
                fileName={fileName}
                filterText={filterText}
                setFilterText={setFilterText}
                isAddKeyModalOpen={isAddKeyModalOpen}
                setIsAddKeyModalOpen={setIsAddKeyModalOpen}
                darkMode={darkMode}
                toggleDarkMode={toggleDarkMode}
            />

            {/* Toolbar */}
            <JsonTreeToolbar
                filePath={filePath}
                onBack={onBack}
                onNavigate={onNavigate}
                expandAll={expandAll}
                collapseAll={collapseAll}
            />

            {/* Content */}
            <div className="flex-1 overflow-auto bg-white dark:bg-zinc-950 p-8 md:p-12">
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm max-w-7xl mx-auto overflow-x-auto">
                    <table className="w-full text-left table-fixed min-w-[1000px]">
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
                                        onAddChild={handleAddChild}
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
                    initialParentPath={quickAddParentPath}
                    initialTypes={quickAddInitialTypes}
                    fileName={fileName}
                    onClose={handleCloseAddKeyModal}
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
