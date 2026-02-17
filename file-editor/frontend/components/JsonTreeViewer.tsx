import React, { useState, useMemo, useEffect } from 'react';
import { ChevronRight, ChevronDown, Search, X } from 'lucide-react';
import clsx from 'clsx';

interface JsonNode {
    key: string;
    description?: string;
    default_value?: any;
    value?: any; // sometimes value is used instead of default_value
    override_hint?: boolean;
    type?: string;
    children?: JsonNode[];
    [key: string]: any; // Allow other props
}

interface JsonTreeViewerProps {
    content: string;
    fileName: string;
    onClose: () => void;
}

const TreeNode = ({
    node,
    depth = 0,
    filterText,
    expandedKeys,
    toggleExpand
}: {
    node: JsonNode,
    depth: number,
    filterText: string,
    expandedKeys: Set<string>,
    toggleExpand: (key: string) => void
}) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedKeys.has(node.key);

    // Highlighting filter text logic could be added here

    // Format value for display
    const displayValue = node.default_value !== undefined ? node.default_value : node.value;
    let formattedValue = '';

    if (displayValue !== undefined && displayValue !== null) {
        if (typeof displayValue === 'object') {
            formattedValue = Array.isArray(displayValue) ? `[Array(${displayValue.length})]` : '{Object}';
        } else {
            formattedValue = String(displayValue);
        }
    }

    return (
        <>
            <tr className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                <td className="py-2 px-4 whitespace-nowrap">
                    <div className="flex items-center" style={{ paddingLeft: `${depth * 20}px` }}>
                        {hasChildren ? (
                            <button
                                onClick={() => toggleExpand(node.key)}
                                className="p-1 mr-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors text-zinc-500"
                            >
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                        ) : (
                            <span className="w-6 mr-1 block"></span>
                        )}
                        <span className="font-medium text-zinc-700 dark:text-zinc-300 font-mono text-sm">{node.key}</span>
                    </div>
                </td>
                <td className="py-2 px-4 text-sm text-zinc-500 dark:text-zinc-400 font-mono truncate max-w-xs" title={String(formattedValue)}>
                    {formattedValue}
                </td>
                <td className="py-2 px-4 text-sm text-zinc-600 dark:text-zinc-400">
                    {node.description}
                </td>
                <td className="py-2 px-4 text-center">
                    {node.override_hint && (
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-500" title="Override Hint"></span>
                    )}
                </td>
            </tr>
            {hasChildren && isExpanded && (
                node.children!.map(child => (
                    <TreeNode
                        key={child.key}
                        node={child}
                        depth={depth + 1}
                        filterText={filterText}
                        expandedKeys={expandedKeys}
                        toggleExpand={toggleExpand}
                    />
                ))
            )}
        </>
    );
};

export default function JsonTreeViewer({ content, fileName, onClose }: JsonTreeViewerProps) {
    const [nodes, setNodes] = useState<JsonNode[]>([]);
    const [filterText, setFilterText] = useState('');
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                setNodes(parsed);
            } else if (typeof parsed === 'object') {
                setNodes([parsed]);
            } else {
                setError('Content is not a valid JSON object or array.');
            }
        } catch (e: any) {
            setError(`JSON Parse Error: ${e.message}`);
        }
    }, [content]);

    const toggleExpand = (key: string) => {
        const newSet = new Set(expandedKeys);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        setExpandedKeys(newSet);
    };

    const expandAll = () => {
        const keys = new Set<string>();
        const collectKeys = (list: JsonNode[]) => {
            list.forEach(n => {
                if (n.children && n.children.length > 0) {
                    keys.add(n.key);
                    collectKeys(n.children);
                }
            });
        };
        collectKeys(filteredNodes);
        setExpandedKeys(keys);
    };

    const collapseAll = () => {
        setExpandedKeys(new Set());
    };

    // Filter Recursively
    const filterNodesRecursive = (nodes: JsonNode[], text: string): JsonNode[] => {
        return nodes.reduce((acc: JsonNode[], node) => {
            const matchesKey = node.key.toLowerCase().includes(text.toLowerCase());
            const matchesDesc = node.description?.toLowerCase().includes(text.toLowerCase());

            let childrenMatches: JsonNode[] = [];
            if (node.children) {
                childrenMatches = filterNodesRecursive(node.children, text);
            }

            if (matchesKey || matchesDesc || childrenMatches.length > 0) {
                // Should we clone? Yes to avoid mutating state directly in deep nested edits if we were editing
                // But here for read-only filter, we can return a new object masking children
                acc.push({
                    ...node,
                    children: childrenMatches.length > 0 ? childrenMatches : (matchesKey || matchesDesc ? node.children : [])
                });
            }
            return acc;
        }, []);
    };

    const filteredNodes = useMemo(() => {
        if (!filterText) return nodes;
        return filterNodesRecursive(nodes, filterText);
    }, [nodes, filterText]);

    // Auto-expand if filtering
    useEffect(() => {
        if (filterText) {
            expandAll();
        }
    }, [filterText, nodes]); // Depend on nodes loosely, mostly filterText

    if (error) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 p-8">
                <div className="text-red-500 mb-4">{error}</div>
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 rounded text-zinc-900 dark:text-zinc-100"
                >
                    Close
                </button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-zinc-950 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md">
                <div className="flex items-center space-x-4">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center">
                        <span className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-xs px-2 py-1 rounded mr-3 font-mono">JSON Config</span>
                        {fileName}
                    </h2>
                    <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800"></div>

                    {/* Search */}
                    <div className="relative group w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Filter keys..."
                            className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-full py-1.5 pl-9 pr-4 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    <button onClick={expandAll} className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">Expand All</button>
                    <button onClick={collapseAll} className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">Collapse All</button>
                    <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-2"></div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-500 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto bg-white dark:bg-zinc-950 p-6">
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                        <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                            <tr>
                                <th className="py-3 px-4 font-medium text-sm text-zinc-500 dark:text-zinc-400 w-1/3">Key</th>
                                <th className="py-3 px-4 font-medium text-sm text-zinc-500 dark:text-zinc-400 w-1/4">Value</th>
                                <th className="py-3 px-4 font-medium text-sm text-zinc-500 dark:text-zinc-400">Description</th>
                                <th className="py-3 px-4 font-medium text-sm text-zinc-500 dark:text-zinc-400 w-16 text-center">Hint</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-950">
                            {filteredNodes.length > 0 ? (
                                filteredNodes.map((node, i) => (
                                    <TreeNode
                                        key={node.key + i} // fallback key uniqueness
                                        node={node}
                                        depth={0}
                                        filterText={filterText}
                                        expandedKeys={expandedKeys}
                                        toggleExpand={toggleExpand}
                                    />
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-zinc-400 dark:text-zinc-600">
                                        No keys found matching "{filterText}"
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
