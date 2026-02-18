'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { ChevronRight, ChevronDown, Search, ArrowLeft, Home, AlertTriangle, CheckCircle2, Moon, Sun, Plus, X, Save, ArrowUpDown, Trash2, Edit, Info } from 'lucide-react';
import { Typeahead, Menu, MenuItem } from 'react-bootstrap-typeahead'; // Added Menu, MenuItem
import 'react-bootstrap-typeahead/css/Typeahead.css';
import { api } from '@/lib/api';
import clsx from 'clsx';

// Types
interface JsonNode {
    key: string;
    description?: string;
    default_value?: any;
    value?: any;
    override_hint?: boolean;
    type?: string;
    multi_type?: string[];
    item_multi_type?: string[];
    regex_enable?: boolean;
    regex?: string;
    required?: boolean;
    children?: JsonNode[];
    [key: string]: any;
}

interface JsonTreeViewerProps {
    content: string;
    fileName: string;
    filePath: string;
    onClose: () => void;
    onBack: () => void;
    onHome: () => void;
    onEditKey: (keyPath: string) => void;
}

type SortField = 'key' | 'type' | 'required' | 'description';
type SortOrder = 'asc' | 'desc';

// Helper to flatten valid parents
const getValidParents = (nodes: JsonNode[], parentPath: string = ''): string[] => {
    let parents: string[] = [];

    // If at top level (parentPath is empty), 'root' is a valid parent
    if (parentPath === '') {
        parents.push('root');
    }

    for (const node of nodes) {
        const currentPath = parentPath ? `${parentPath}.${node.key}` : node.key;

        // Check if this node can be a parent (Object or List of Objects)
        const isObject = node.multi_type?.includes('object');
        const isListOfObjects = node.multi_type?.includes('list') && node.item_multi_type?.includes('object');

        if (isObject || isListOfObjects) {
            parents.push(currentPath); // Push relative path e.g "ntp" or "ntp.servers"
            if (node.children) {
                parents = parents.concat(getValidParents(node.children, currentPath));
            }
        }
    }
    return parents;
};

// TreeNode Component
const TreeNode = ({
    node,
    depth = 0,
    filterText,
    expandedKeys,
    toggleExpand,
    onDelete,
    onEdit,
    parentPath
}: {
    node: JsonNode,
    depth: number,
    filterText: string,
    expandedKeys: Set<string>,
    toggleExpand: (key: string) => void,
    onDelete: (node: JsonNode, parentPath: string) => void,
    onEdit: (keyPath: string) => void,
    parentPath: string
}) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedKeys.has(node.key);
    const myPath = parentPath ? `${parentPath}.${node.key}` : node.key;

    // Format Type
    let typeDisplay = node.type || '-';
    if (node.multi_type && node.multi_type.length > 0) {
        if (node.multi_type.includes('list') && node.item_multi_type && node.item_multi_type.length > 0) {
            const itemTypes = node.item_multi_type.join(', ');
            typeDisplay = `list(${itemTypes})`;
        } else {
            typeDisplay = node.multi_type.join(', ');
        }
    }

    return (
        <>
            <tr className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">

                {/* Key Column */}
                <td className="py-2.5 px-4 whitespace-nowrap relative">
                    <div className="flex items-center" style={{ paddingLeft: `${depth * 20}px` }}>
                        {hasChildren ? (
                            <button
                                onClick={() => toggleExpand(node.key)}
                                className="p-0.5 mr-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors text-zinc-500"
                            >
                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                        ) : (
                            <span className="w-5 mr-1 block"></span>
                        )}
                        <span className="font-medium text-zinc-700 dark:text-zinc-300 font-mono text-xs md:text-sm mr-2">{node.key}</span>
                    </div>
                </td>

                {/* Type Column */}
                <td className="py-2.5 px-4 text-xs md:text-sm text-blue-600 dark:text-blue-400 font-mono w-48">
                    <div className="flex items-center space-x-2">
                        {node.regex_enable && (
                            <div className="relative group/tooltip inline-block">
                                <AlertTriangle className="w-3 h-3 text-yellow-500 cursor-help" />
                                <div className="absolute left-0 bottom-full mb-1 hidden group-hover/tooltip:block z-[9999] w-max max-w-xs pointer-events-none">
                                    <div className="bg-zinc-800 text-white text-[10px] rounded py-1 px-2 shadow-lg border border-zinc-700">
                                        <div className="font-semibold mb-0.5 text-zinc-400">Regex Pattern:</div>
                                        <code className="font-mono bg-zinc-900 px-1 py-0.5 rounded text-blue-300 block break-all">{node.regex}</code>
                                    </div>
                                    <div className="absolute left-1 top-full w-0 h-0 border-4 border-transparent border-t-zinc-800"></div>
                                </div>
                            </div>
                        )}
                        <span>{typeDisplay}</span>
                    </div>
                </td>

                {/* Required Column */}
                <td className="py-2.5 px-4 text-center w-24">
                    {node.required && (
                        <div className="inline-flex items-center justify-center" title="Required">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        </div>
                    )}
                </td>

                {/* Description Column */}
                <td className="py-2.5 px-4 text-xs md:text-sm text-zinc-600 dark:text-zinc-400 max-w-xs xl:max-w-md">
                    <div className="truncate cursor-help" title={node.description}>
                        {node.description}
                    </div>
                </td>

                {/* Actions Column - Always Visible (Greyed Out) */}
                <td className="py-2.5 px-4 w-24">
                    <div className="flex items-center justify-end space-x-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(myPath); }}
                            className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition-colors opacity-60 hover:opacity-100"
                            title="Edit"
                        >
                            <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(node, parentPath); }}
                            className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition-colors opacity-60 hover:opacity-100"
                            title="Delete"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </td>
            </tr>
            {hasChildren && isExpanded && (
                node.children!.map((child, idx) => (
                    <TreeNode
                        key={`${child.key}-${idx}`}
                        node={child}
                        depth={depth + 1}
                        filterText={filterText}
                        expandedKeys={expandedKeys}
                        toggleExpand={toggleExpand}
                        onDelete={onDelete}
                        onEdit={onEdit}
                        parentPath={myPath}
                    />
                ))
            )}
        </>
    );
};

// Main Component
export default function JsonTreeViewer({ content, fileName, filePath, onClose, onBack, onHome, onEditKey }: JsonTreeViewerProps) {
    const [nodes, setNodes] = useState<JsonNode[]>([]);
    const [initialContent, setInitialContent] = useState('');
    const [filterText, setFilterText] = useState('');
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set()); // Auto-expand root?
    const [error, setError] = useState<string | null>(null);

    // Sorting
    const [sortField, setSortField] = useState<SortField>('key');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

    // Theme
    const [isDark, setIsDark] = useState(false);

    // Add Key Modal
    const [isAddKeyModalOpen, setIsAddKeyModalOpen] = useState(false);

    // Delete Confirmation
    const [deleteTarget, setDeleteTarget] = useState<{ node: JsonNode, parentPath: string } | null>(null);

    useEffect(() => {
        try {
            setInitialContent(content);
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                setNodes(parsed);
                // Expand root keys by default if manageable?
                // setExpandedKeys(new Set(parsed.map(n => n.key)));
            } else if (typeof parsed === 'object') {
                setNodes([parsed]);
            } else {
                setError('Content is not a valid JSON object');
            }
        } catch (e: any) {
            setError(`JSON Parse Error: ${e.message}`);
        }
        if (document.documentElement.classList.contains('dark')) setIsDark(true);
    }, [content]);

    const toggleTheme = () => {
        if (isDark) {
            document.documentElement.classList.remove('dark');
            setIsDark(false);
        } else {
            document.documentElement.classList.add('dark');
            setIsDark(true);
        }
    };

    const toggleExpand = (key: string) => {
        const newSet = new Set(expandedKeys);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        setExpandedKeys(newSet);
    };

    // Filter & Sort Logic
    const filterNodesRecursive = (nodes: JsonNode[], text: string): JsonNode[] => {
        let filtered = nodes.reduce((acc: JsonNode[], node) => {
            const matchesKey = node.key.toLowerCase().includes(text.toLowerCase());
            const matchesDesc = node.description?.toLowerCase().includes(text.toLowerCase());
            let childrenMatches: JsonNode[] = [];
            if (node.children) {
                childrenMatches = filterNodesRecursive(node.children, text);
            }
            if (matchesKey || matchesDesc || childrenMatches.length > 0) {
                acc.push({ ...node, children: childrenMatches.length > 0 ? childrenMatches : (matchesKey || matchesDesc ? node.children : []) });
            }
            return acc;
        }, []);

        filtered.sort((a, b) => {
            let aVal: any = '', bVal: any = '';
            switch (sortField) {
                case 'key': aVal = a.key; bVal = b.key; break;
                case 'type': aVal = a.multi_type?.[0] || ''; bVal = b.multi_type?.[0] || ''; break;
                case 'required': aVal = a.required ? 1 : 0; bVal = b.required ? 1 : 0; break;
                case 'description': aVal = a.description || ''; bVal = b.description || ''; break;
            }
            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        return filtered;
    };

    const filteredNodes = useMemo(() => {
        const nodesCopy = JSON.parse(JSON.stringify(nodes));
        return filterNodesRecursive(nodesCopy, filterText);
    }, [nodes, filterText, sortField, sortOrder]);

    const handleSort = (field: SortField) => {
        if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortOrder('asc'); }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            const newNodes = JSON.parse(JSON.stringify(nodes));
            const removeRecursive = (list: JsonNode[], parentP: string): boolean => {
                for (let i = 0; i < list.length; i++) {
                    const n = list[i];
                    const p = parentP ? `${parentP}.${n.key}` : n.key;
                    if (p === (deleteTarget.parentPath ? `${deleteTarget.parentPath}.${deleteTarget.node.key}` : deleteTarget.node.key)) {
                        list.splice(i, 1);
                        return true;
                    }
                    if (n.children && removeRecursive(n.children, p)) return true;
                }
                return false;
            };

            if (!deleteTarget.parentPath) {
                const idx = newNodes.findIndex((n: JsonNode) => n.key === deleteTarget.node.key);
                if (idx !== -1) newNodes.splice(idx, 1);
            } else {
                removeRecursive(newNodes, '');
            }

            await api.createFile(filePath, JSON.stringify(newNodes, null, 4));
            setNodes(newNodes);
            setDeleteTarget(null);

        } catch (e: any) {
            alert("Failed to delete: " + e.message);
        }
    };

    const handleSaveNewKey = async (data: any) => {
        // Data contains: { parentPathString: "root.ntp", key, types, itemTypes, desc, required }
        const newNodes = JSON.parse(JSON.stringify(nodes));
        const newNode: JsonNode = {
            key: data.key,
            description: data.desc,
            multi_type: data.types,
            item_multi_type: data.types.includes('list') ? data.itemTypes : undefined,
            required: data.required,
            children: []
        };

        const targetPath = data.parentPathString === 'root' ? [] : data.parentPathString.split('.').filter((p: string) => p !== 'root');

        if (targetPath.length === 0) {
            // Add to root
            newNodes.push(newNode);
        } else {
            // Traverse
            const findAndPush = (list: JsonNode[], path: string[]): boolean => {
                const [head, ...tail] = path;
                for (const n of list) {
                    if (n.key === head) {
                        if (tail.length === 0) {
                            if (!n.children) n.children = [];
                            n.children.push(newNode);
                            return true;
                        }
                        if (n.children && findAndPush(n.children, tail)) return true;
                    }
                }
                return false;
            };
            findAndPush(newNodes, targetPath);
        }

        try {
            await api.createFile(filePath, JSON.stringify(newNodes, null, 4));
            setNodes(newNodes);
            setIsAddKeyModalOpen(false);
        } catch (e: any) {
            alert("Failed to save: " + e.message);
        }
    };

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
                    <button onClick={() => setIsAddKeyModalOpen(true)} className="flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-medium transition-colors shadow-sm">
                        <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Key
                    </button>
                    <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 mx-2"></div>
                    <button onClick={toggleTheme} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-500" title="Toggle Theme">
                        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                    <button onClick={onHome} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-500" title="Home">
                        <Home className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content - WITH INCREASED PADDING and MAX-WIDTH */}
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
                <AddKeyModalV3
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
                            <button onClick={handleDelete} className="px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Improved Modal with Single Searchable Selection + Tooltips + Small Fonts
function AddKeyModalV3({ nodes, onClose, onSave }: any) {
    const [parentPath, setParentPath] = useState<string[]>([]);
    const [keyName, setKeyName] = useState('');
    const [types, setTypes] = useState<string[]>([]);
    const [itemTypes, setItemTypes] = useState<string[]>([]);
    const [desc, setDesc] = useState('');
    const [req, setReq] = useState(false);

    // Type dropdown state
    const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

    // Flatten valid parents
    const validParents = useMemo(() => getValidParents(nodes), [nodes]);

    const OPTIONS = ['string', 'number', 'object', 'list', 'boolean', 'ntp', 'ip'];

    // Info Label Component
    const InfoLabel = ({ label, tooltip }: { label: string, tooltip: string }) => (
        <div className="flex items-center mb-1">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mr-1.5">{label}</span>
            <div className="relative group cursor-help z-10"> {/* Ensure tooltip icon isn't hidden */}
                <Info className="w-3 h-3 text-zinc-400 hover:text-blue-500" />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-50 w-max max-w-xs pointer-events-none">
                    <div className="bg-zinc-800 text-white text-[10px] rounded px-2 py-1 shadow-lg border border-zinc-700">
                        {tooltip}
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-4 border-transparent border-t-zinc-800"></div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/50">
                    <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Add New Key</h3>
                    <button onClick={onClose}><X className="w-4 h-4 text-zinc-400 hover:text-zinc-600" /></button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar relative">
                    {/* Parent Selector (Single Typeahead) - HIGH Z-INDEX */}
                    <div className="relative z-20">
                        <InfoLabel label="Parent" tooltip="The location in the JSON structure where this key will be added." />
                        <Typeahead
                            id="parent-select"
                            options={validParents}
                            selected={parentPath}
                            onChange={(s) => setParentPath(s as string[])}
                            placeholder="Search parent path (e.g. root.ntp)..."
                            inputProps={{ className: 'w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none focus:ring-2 focus:ring-blue-500 text-xs' }}
                            renderMenuItemChildren={(option) => (
                                <div className="text-xs font-mono text-zinc-700 dark:text-zinc-200 px-2 py-1">{option as string}</div>
                            )}
                            emptyLabel={
                                <span className="text-red-500 text-xs font-medium px-2">No matches found</span>
                            }
                            renderMenu={(results, menuProps) => (
                                <Menu {...menuProps} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                    {results.map((result, index) => (
                                        <MenuItem key={index} option={result} position={index}>
                                            <div className="text-xs font-mono text-zinc-700 dark:text-zinc-200 px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer">
                                                {result as string}
                                            </div>
                                        </MenuItem>
                                    ))}
                                </Menu>
                            )}
                        />
                    </div>

                    {/* Key Name */}
                    <div className="relative z-0">
                        <InfoLabel label="Key Name" tooltip="The unique identifier for this field." />
                        <input
                            type="text"
                            value={keyName}
                            onChange={e => setKeyName(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                            placeholder="e.g. server_port"
                        />
                    </div>

                    {/* Styled Type Selector */}
                    <div className="relative z-10">
                        <InfoLabel label="Type" tooltip="The data type(s) allowed for this key." />
                        <div className="relative">
                            <div className="w-full min-h-[34px] p-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md flex flex-wrap gap-1.5 cursor-text" onClick={() => setIsTypeDropdownOpen(true)}>
                                {types.map(t => (
                                    <span key={t} className="bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 text-[10px] px-1.5 py-0.5 rounded flex items-center font-mono border border-blue-100 dark:border-blue-800">
                                        {t}
                                        <button onClick={(e) => { e.stopPropagation(); setTypes(types.filter(x => x !== t)); }} className="ml-1 hover:text-blue-800 dark:hover:text-blue-100"><X className="w-3 h-3" /></button>
                                    </span>
                                ))}
                                <input readOnly type="text" className="flex-1 bg-transparent outline-none text-xs min-w-[60px] cursor-pointer h-6 px-1" placeholder={types.length === 0 ? "Select type..." : ""} />
                            </div>

                            {isTypeDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsTypeDropdownOpen(false)} />
                                    <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg z-20 max-h-40 overflow-y-auto py-1">
                                        {OPTIONS.filter(o => !types.includes(o)).map(opt => (
                                            <button
                                                key={opt}
                                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-mono"
                                                onClick={() => { setTypes([...types, opt]); setIsTypeDropdownOpen(false); }}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Item Type (if list) */}
                    {types.includes('list') && (
                        <div className="pl-3 border-l-2 border-blue-500/20 py-1 relative z-0">
                            <InfoLabel label="List Item Type" tooltip="The data type(s) allowed for items within this list." />
                            <div className="flex flex-wrap gap-1.5 mb-1.5">
                                {itemTypes.map(t => (
                                    <span key={t} className="bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 text-[10px] px-1.5 py-0.5 rounded flex items-center font-mono border border-purple-100 dark:border-purple-800">
                                        {t}
                                        <button onClick={() => setItemTypes(itemTypes.filter(x => x !== t))} className="ml-1 hover:text-purple-800 dark:hover:text-purple-100"><X className="w-3 h-3" /></button>
                                    </span>
                                ))}
                            </div>
                            <select
                                className="w-full px-2 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-xs outline-none focus:ring-2 focus:ring-purple-500/50"
                                onChange={(e) => { if (e.target.value) setItemTypes([...itemTypes, e.target.value]); e.target.value = ''; }}
                            >
                                <option value="">Add item type...</option>
                                <option value="object">object</option>
                                {OPTIONS.filter(o => !itemTypes.includes(o) && o !== 'object').map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Desc */}
                    <div className="relative z-0">
                        <InfoLabel label="Description" tooltip="A brief explanation of what this key is used for." />
                        <textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none text-xs min-h-[60px]" placeholder="..." />
                    </div>

                    {/* Req */}
                    <div className="flex items-center space-x-2 pt-1 relative z-0">
                        <input type="checkbox" id="req-check-3" checked={req} onChange={e => setReq(e.target.checked)} className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500" />
                        <label htmlFor="req-check-3" className="text-xs font-medium text-zinc-700 dark:text-zinc-300 select-none">Required Field</label>
                        <div className="relative group cursor-help ml-1">
                            <Info className="w-3 h-3 text-red-400 hover:text-red-500" />
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-50 w-max max-w-xs pointer-events-none">
                                <div className="bg-zinc-800 text-white text-[10px] rounded px-2 py-1 shadow-lg border border-zinc-700">
                                    Whether this field must be present in the configuration.
                                </div>
                                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-4 border-transparent border-t-zinc-800"></div>
                            </div>
                        </div>
                    </div>

                </div>

                <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 flex justify-end space-x-2">
                    <button onClick={onClose} className="px-3 py-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-xs font-medium transition-colors">Cancel</button>
                    <button onClick={() => onSave({ parentPathString: parentPath[0] || 'root', key: keyName, types, itemTypes, desc, required: req })} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium flex items-center shadow-sm transition-colors">
                        <Save className="w-3.5 h-3.5 mr-1.5" /> Save Key
                    </button>
                </div>
            </div>
        </div>
    );
}
