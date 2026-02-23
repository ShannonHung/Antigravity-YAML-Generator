import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { TYPE_OPERATORS, OPERATOR_LABELS } from '@/lib/conditions';
import { InfoLabel } from './InfoLabel';

export default function KeyConditionForm({ condition, setCondition, availableKeys }: any) {
    const [openConditionKeyIndex, setOpenConditionKeyIndex] = useState<number | null>(null);
    const [conditionKeySearch, setConditionKeySearch] = useState('');

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center mb-3">
                <span className="w-8 h-px bg-zinc-300 dark:bg-zinc-700 mr-3"></span>
                Conditional Requirement
            </h3>
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                        <InfoLabel label="Enable Condition" tooltip="Make this field required only when specific conditions are met." placement="right" />
                    </div>
                    <button
                        onClick={() => {
                            if (condition) {
                                setCondition(null);
                            } else {
                                setCondition({ logical: 'and', conditions: [] });
                            }
                        }}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${condition ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                    >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${condition ? 'translate-x-[18px]' : 'translate-x-1'}`} />
                    </button>
                </div>

                {condition && (
                    <div className="space-y-4 animate-in fade-in">
                        {/* Logical Operator */}
                        <div className="flex items-center space-x-4 p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Logic:</span>
                            <div className="flex bg-zinc-100 dark:bg-zinc-900 rounded p-1">
                                <button
                                    onClick={() => setCondition({ ...condition, logical: 'and' })}
                                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${condition.logical === 'and' ? 'bg-white dark:bg-zinc-800 shadow text-blue-600' : 'text-zinc-400 hover:text-zinc-600'}`}
                                >
                                    AND
                                </button>
                                <button
                                    onClick={() => setCondition({ ...condition, logical: 'or' })}
                                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${condition.logical === 'or' ? 'bg-white dark:bg-zinc-800 shadow text-blue-600' : 'text-zinc-400 hover:text-zinc-600'}`}
                                >
                                    OR
                                </button>
                            </div>
                        </div>

                        {/* Conditions List */}
                        <div className="space-y-2">
                            {condition.conditions.map((cond: any, idx: number) => {
                                const selectedKey = availableKeys.find((k: any) => k.path === cond.key);
                                const ops = selectedKey ? (TYPE_OPERATORS[selectedKey.type] || TYPE_OPERATORS['string']) : TYPE_OPERATORS['string'];

                                return (
                                    <div key={idx} className={`flex items-center space-x-2 bg-white dark:bg-zinc-800 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm group relative ${openConditionKeyIndex === idx ? 'z-50' : 'z-10'}`}>
                                        {/* Key Selector (Custom Searchable Dropdown) */}
                                        <div className="flex-1 w-[45%] relative">
                                            <div
                                                className="w-full text-xs border rounded px-2 py-1.5 border-zinc-200 dark:border-zinc-700 bg-transparent cursor-pointer hover:border-blue-400 flex items-center shadow-inner"
                                                onClick={() => {
                                                    setOpenConditionKeyIndex(idx);
                                                    setConditionKeySearch('');
                                                }}
                                                title={cond.key || "Select Field"}
                                            >
                                                {cond.key ? (
                                                    <div className="truncate w-full font-mono">
                                                        <span>{cond.key}</span>
                                                        <span className="text-zinc-400 ml-1 font-sans">({availableKeys.find((k: any) => k.path === cond.key)?.type || '?'})</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-zinc-400">Select Field...</span>
                                                )}
                                            </div>

                                            {openConditionKeyIndex === idx && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setOpenConditionKeyIndex(null)} />
                                                    <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl z-50 max-h-60 flex flex-col min-w-[250px]">
                                                        <div className="p-2 border-b border-zinc-100 dark:border-zinc-700/50 sticky top-0 bg-white dark:bg-zinc-800 rounded-t-lg">
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                className="w-full px-2 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded bg-zinc-50 dark:bg-zinc-900 outline-none focus:border-blue-500"
                                                                placeholder="Search keys..."
                                                                value={conditionKeySearch}
                                                                onClick={e => e.stopPropagation()}
                                                                onChange={e => setConditionKeySearch(e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="overflow-y-auto flex-1 p-1 custom-scrollbar">
                                                            {availableKeys
                                                                .filter((k: any) => k.path.toLowerCase().includes(conditionKeySearch.toLowerCase()))
                                                                .map((k: any) => (
                                                                    <button
                                                                        key={k.path}
                                                                        className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center justify-between group/item"
                                                                        onClick={() => {
                                                                            const newConds = [...condition.conditions];
                                                                            newConds[idx].key = k.path;
                                                                            newConds[idx].operator = 'eq';
                                                                            setCondition({ ...condition, conditions: newConds });
                                                                            setOpenConditionKeyIndex(null);
                                                                        }}
                                                                    >
                                                                        <span className="font-mono text-[11px] truncate whitespace-normal break-all mr-2" title={k.path}>{k.path}</span>
                                                                        <span className="text-[10px] text-zinc-400 bg-zinc-50 dark:bg-zinc-900 px-1 rounded border border-zinc-100 dark:border-zinc-700/50 group-hover/item:border-zinc-200 shrink-0">{k.type}</span>
                                                                    </button>
                                                                ))}
                                                            {availableKeys.filter((k: any) => k.path.toLowerCase().includes(conditionKeySearch.toLowerCase())).length === 0 && (
                                                                <div className="px-2 py-4 text-center text-xs text-zinc-400 italic">No matches found</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Operator Selector */}
                                        <select
                                            className="bg-transparent text-xs border rounded px-2 py-1.5 border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 w-[20%]"
                                            value={cond.operator}
                                            onChange={e => {
                                                const newConds = [...condition.conditions];
                                                newConds[idx].operator = e.target.value;
                                                setCondition({ ...condition, conditions: newConds });
                                            }}
                                        >
                                            {ops.map((op: string) => <option key={op} value={op}>{OPERATOR_LABELS[op] || op}</option>)}
                                        </select>

                                        {/* Value Input */}
                                        <input
                                            type="text"
                                            className="flex-[2] bg-transparent text-xs border rounded px-2 py-1.5 border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 min-w-[30%] shadow-inner"
                                            placeholder="Value"
                                            value={cond.value}
                                            title={cond.value}
                                            onChange={e => {
                                                const newConds = [...condition.conditions];
                                                newConds[idx].value = e.target.value;
                                                setCondition({ ...condition, conditions: newConds });
                                            }}
                                        />

                                        {/* Delete */}
                                        <button
                                            onClick={() => {
                                                const newConds = condition.conditions.filter((_: any, i: number) => i !== idx);
                                                setCondition({ ...condition, conditions: newConds });
                                            }}
                                            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                );
                            })}

                            {/* Add Condition Button */}
                            <button
                                onClick={() => setCondition({ ...condition, conditions: [...condition.conditions, { key: '', operator: 'eq', value: '' }] })}
                                className="w-full py-2 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-400 hover:text-blue-500 hover:border-blue-300 dark:hover:border-blue-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all text-xs font-medium flex items-center justify-center"
                            >
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Add Condition
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
