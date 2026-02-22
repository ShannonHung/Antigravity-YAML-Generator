import { ChevronRight, ChevronDown, AlertTriangle, CheckCircle2, Ban, Edit, Trash2 } from 'lucide-react';
import { JsonNode } from './types';
import clsx from 'clsx';

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
    parentPath,
    inheritedDeprecated = false
}: TreeNodeProps & { inheritedDeprecated?: boolean }) {
    const hasChildren = node.children && node.children.length > 0;
    const myPath = parentPath ? `${parentPath}>${node.key}` : node.key;
    const isExpanded = expandedKeys.has(myPath);

    // Deprecated Status
    const isSelfDeprecated = node.required === null || inheritedDeprecated;
    const isEffectiveDeprecated = isSelfDeprecated || inheritedDeprecated;

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
            <tr className={clsx(
                "border-b border-zinc-100 dark:border-zinc-800 transition-colors group",
                isSelfDeprecated
                    ? "bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            )}>

                {/* Key Column */}
                <td className="py-2.5 px-4 whitespace-nowrap relative">
                    <div className="flex items-center" style={{ paddingLeft: `${depth * 20}px` }}>
                        {hasChildren ? (
                            <button
                                onClick={() => toggleExpand(myPath)}
                                className="p-0.5 mr-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors text-zinc-500"
                            >
                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                        ) : (
                            <span className="w-5 mr-1 block"></span>
                        )}
                        <span className={clsx(
                            "font-medium font-mono text-xs md:text-sm mr-2",
                            isEffectiveDeprecated
                                ? "text-zinc-500 line-through opacity-70"
                                : "text-zinc-700 dark:text-zinc-300"
                        )}>
                            {node.key}
                        </span>
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
                        <span className={isEffectiveDeprecated ? "line-through opacity-70" : ""}>{typeDisplay}</span>
                    </div>
                </td>

                {/* Required Column */}
                <td className="py-2.5 px-4 text-center w-24">
                    {node.required === true ? (
                        <div className="inline-flex items-center justify-center group/req relative" title="Required">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            <div className="absolute bottom-full mb-1 hidden group-hover/req:block z-50 w-max px-2 py-1 bg-zinc-800 text-white text-[10px] rounded shadow-lg border border-zinc-700 pointer-events-none">
                                Required Field
                                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-4 border-transparent border-t-zinc-800"></div>
                            </div>
                        </div>
                    ) : node.required === null ? (
                        <div className="inline-flex items-center justify-center group/req relative" title="Deprecated">
                            <Ban className="w-3.5 h-3.5 text-red-500" />
                            <div className="absolute bottom-full mb-1 hidden group-hover/req:block z-50 w-max px-2 py-1 bg-zinc-800 text-white text-[10px] rounded shadow-lg border border-zinc-700 pointer-events-none">
                                Deprecated
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
                            <div className="w-3.5 h-3.5 rounded-full border border-zinc-300 dark:border-zinc-700"></div>
                            <div className="absolute bottom-full mb-1 hidden group-hover/req:block z-50 w-max px-2 py-1 bg-zinc-800 text-white text-[10px] rounded shadow-lg border border-zinc-700 pointer-events-none">
                                Optional
                                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-4 border-transparent border-t-zinc-800"></div>
                            </div>
                        </div>
                    )}
                </td>

                {/* Description Column */}
                <td className="py-2.5 px-4 text-xs md:text-sm text-zinc-600 dark:text-zinc-400 max-w-xs xl:max-w-md">
                    <div className={clsx("truncate cursor-help", isEffectiveDeprecated && "line-through opacity-70")} title={node.description}>
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
                        inheritedDeprecated={isEffectiveDeprecated}
                    />
                ))
            )}
        </>
    );
};
