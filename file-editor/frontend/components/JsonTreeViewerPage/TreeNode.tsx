import { ChevronRight, ChevronDown, AlertTriangle, CheckCircle2, Ban, Edit, Trash2 } from 'lucide-react';
import { JsonNode } from './types';

interface TreeNodeProps {
    node: JsonNode;
    depth: number;
    filterText: string;
    expandedKeys: Set<string>;
    toggleExpand: (key: string) => void;
    onDelete: (node: JsonNode, parentPath: string) => void;
    onEdit: (keyPath: string) => void;
    parentPath: string;
}

export default function TreeNode({
    node,
    depth = 0,
    filterText,
    expandedKeys,
    toggleExpand,
    onDelete,
    onEdit,
    parentPath
}: TreeNodeProps) {
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
                    {node.required ? (
                        <div className="inline-flex items-center justify-center group/req relative" title="Required">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            <div className="absolute bottom-full mb-1 hidden group-hover/req:block z-50 w-max px-2 py-1 bg-zinc-800 text-white text-[10px] rounded shadow-lg border border-zinc-700 pointer-events-none">
                                Required Field
                                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-4 border-transparent border-t-zinc-800"></div>
                            </div>
                        </div>
                    ) : (node.condition && node.condition.conditions && node.condition.conditions.length > 0) ? (
                        <div className="inline-flex items-center justify-center group/req relative">
                            <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                            <div className="absolute bottom-full mb-1 hidden group-hover/req:block z-50 w-max max-w-xs px-2 py-1 bg-zinc-800 text-white text-[10px] rounded shadow-lg border border-zinc-700 pointer-events-none text-left">
                                <div className="font-semibold mb-0.5 text-amber-400">Conditionally Required</div>
                                <div>Logic: <span className="font-mono uppercase">{node.condition.logical}</span></div>
                                <div>Conditions: {node.condition.conditions.length}</div>
                                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-4 border-transparent border-t-zinc-800"></div>
                            </div>
                        </div>
                    ) : (
                        <div className="inline-flex items-center justify-center group/req relative">
                            <Ban className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600" />
                            <div className="absolute bottom-full mb-1 hidden group-hover/req:block z-50 w-max px-2 py-1 bg-zinc-800 text-white text-[10px] rounded shadow-lg border border-zinc-700 pointer-events-none">
                                Not Required
                                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-4 border-transparent border-t-zinc-800"></div>
                            </div>
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
