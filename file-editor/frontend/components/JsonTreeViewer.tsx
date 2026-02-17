import React, { useState, useMemo, useEffect } from 'react';
import { ChevronRight, ChevronDown, Search, ArrowLeft, Home, AlertTriangle, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

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
    onClose: () => void;
    onBack: () => void;
    onHome: () => void;
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

    // Format Type
    let typeDisplay = node.type || '-';
    if (node.multi_type && node.multi_type.length > 0) {
        if (node.multi_type.includes('list') && node.item_multi_type && node.item_multi_type.length > 0) {
            // Format as list(type1, type2)
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
                <td className="py-2 px-4 whitespace-nowrap relative">
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
                        <span className="font-medium text-zinc-700 dark:text-zinc-300 font-mono text-sm mr-2">{node.key}</span>
                    </div>
                </td>

                {/* Required Column */}
                <td className="py-2 px-4 text-center w-24">
                    {node.required && (
                        <div className="inline-flex items-center justify-center" title="Required">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                        </div>
                    )}
                </td>

                {/* Type Column */}
                <td className="py-2 px-4 text-sm text-blue-600 dark:text-blue-400 font-mono">
                    <div className="flex items-center space-x-2">
                        {/* Regex Hint */}
                        {node.regex_enable && (
                            <div className="relative group/tooltip inline-block">
                                <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 cursor-help" />
                                <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block z-[9999] w-max max-w-xs pointer-events-none">
                                    <div className="bg-zinc-800 text-white text-xs rounded py-1 px-2 shadow-lg border border-zinc-700">
                                        <div className="font-semibold mb-1 text-zinc-400">Regex Pattern:</div>
                                        <code className="font-mono bg-zinc-900 px-1 py-0.5 rounded text-blue-300 block break-all">{node.regex}</code>
                                    </div>
                                    {/* Arrow */}
                                    <div className="absolute left-1.5 top-full w-0 h-0 border-4 border-transparent border-t-zinc-800"></div>
                                </div>
                            </div>
                        )}
                        <span>{typeDisplay}</span>
                    </div>
                </td>

                {/* Description Column */}
                <td className="py-2 px-4 text-sm text-zinc-600 dark:text-zinc-400 max-w-xs xl:max-w-md">
                    <div className="truncate" title={node.description}>
                        {node.description}
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
                    />
                ))
            )}
        </>
    );
};

export default function JsonTreeViewer({ content, fileName, onClose, onBack, onHome }: JsonTreeViewerProps) {
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
    }, [filterText, nodes]);

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
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors"
                        title="Back to Folder"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>

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
                        onClick={onHome}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 rounded-full transition-colors"
                        title="Home"
                    >
                        <Home className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto bg-white dark:bg-zinc-950 p-6">
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm">
                    <table className="w-full text-left table-fixed">
                        <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                            <tr>
                                <th className="py-3 px-4 font-medium text-sm text-zinc-500 dark:text-zinc-400 w-1/3">Key</th>
                                <th className="py-3 px-4 font-medium text-sm text-zinc-500 dark:text-zinc-400 w-24 text-center">Required</th>
                                <th className="py-3 px-4 font-medium text-sm text-zinc-500 dark:text-zinc-400 w-1/4">Type</th>
                                <th className="py-3 px-4 font-medium text-sm text-zinc-500 dark:text-zinc-400">Description</th>
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
