import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { DATA_TYPES, ITEM_DATA_TYPES } from '../../../config/editorConfig'; // Adjust import path
import { InfoLabel } from './InfoLabel';
import clsx from 'clsx';

export default function KeyIdentityForm({
    keyName, setKeyName,
    types, setTypes,
    itemTypes, setItemTypes,
    required, setRequired,
    overrideHint, setOverrideHint
}: any) {
    const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

    return (
        <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center mb-3">
                <span className="w-8 h-px bg-zinc-300 dark:bg-zinc-700 mr-3"></span>
                Identity & Properties
            </h3>

            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-5">
                {/* Key Name */}
                <div>
                    <InfoLabel label="Key Name" tooltip="Unique identifier for this field." placement="right" />
                    <input
                        type="text"
                        value={keyName}
                        onChange={e => setKeyName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none font-mono"
                    />
                    <p className="text-xs text-amber-600/70 mt-2 flex items-center">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Renaming keys may break existing references in the YAML structure.
                    </p>
                </div>

                {/* Constraints Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <div>
                        <InfoLabel label="Type(s)" tooltip="Allowed data types for this field." placement="right" />
                        <div className="relative">
                            <div className="w-full min-h-[42px] p-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg flex flex-wrap gap-2 cursor-text transition-all hover:border-zinc-300 dark:hover:border-zinc-600" onClick={() => setIsTypeDropdownOpen(true)}>
                                {types.map((t: string) => (
                                    <span key={t} className="bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs px-2.5 py-1 rounded-md flex items-center font-medium border border-blue-100 dark:border-blue-500/20">
                                        {t}
                                        <button onClick={(e) => { e.stopPropagation(); setTypes(types.filter((x: string) => x !== t)); }} className="ml-2 hover:text-blue-900 dark:hover:text-blue-100"><X className="w-3 h-3" /></button>
                                    </span>
                                ))}
                                <input readOnly type="text" className="flex-1 bg-transparent outline-none text-sm min-w-[100px] cursor-pointer h-7 px-1" placeholder={types.length === 0 ? "Select type..." : ""} />
                            </div>

                            {/* Type Dropdown Content */}
                            {isTypeDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-20" onClick={() => setIsTypeDropdownOpen(false)} />
                                    <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto py-2">
                                        {DATA_TYPES.filter(o => !types.includes(o)).map(opt => (
                                            <button
                                                key={opt}
                                                disabled={types.includes('enum') && opt !== 'enum'} // Disable others if enum selected
                                                className={clsx(
                                                    "w-full text-left px-4 py-2 text-sm font-mono transition-colors border-l-2 border-transparent",
                                                    (types.includes('enum') && opt !== 'enum')
                                                        ? "text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
                                                        : "hover:bg-zinc-50 dark:hover:bg-zinc-700/50 text-zinc-700 dark:text-zinc-200 hover:border-blue-500"
                                                )}
                                                onClick={() => {
                                                    if (types.includes('enum') && opt !== 'enum') return;

                                                    if (opt === 'enum') {
                                                        setTypes(['enum']); // Enum is exclusive
                                                    } else {
                                                        setTypes([...types, opt]);
                                                    }
                                                    setIsTypeDropdownOpen(false);
                                                }}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {types.includes('list') && (
                        <div className="pl-6 border-l-2 border-purple-100 dark:border-purple-500/20">
                            <InfoLabel label="List Item Type(s)" tooltip="Allowed types for list items." placement="right" />
                            <div className="w-full min-h-[42px] p-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg flex flex-wrap gap-2 cursor-text transition-all hover:border-zinc-300 dark:hover:border-zinc-600">
                                {itemTypes.map((t: string) => (
                                    <span key={t} className="bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 text-[10px] px-1.5 py-0.5 rounded flex items-center font-mono border border-purple-100 dark:border-purple-800">
                                        {t}
                                        <button onClick={() => setItemTypes(itemTypes.filter((x: string) => x !== t))} className="ml-2 hover:text-purple-900 dark:hover:text-purple-100"><X className="w-3 h-3" /></button>
                                    </span>
                                ))}
                                <select
                                    className="bg-transparent outline-none text-sm min-w-[10px] cursor-pointer h- px-1 text-zinc-900 dark:text-zinc-100"
                                    onChange={(e) => {
                                        // Logic reuse from modal: Check duplicates
                                        if (e.target.value && !itemTypes.includes(e.target.value)) {
                                            setItemTypes([...itemTypes, e.target.value]);
                                        }
                                        e.target.value = '';
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <option value="">+ Add</option>
                                    {!itemTypes.includes('object') && <option value="object">object</option>}
                                    {ITEM_DATA_TYPES.filter(o => !itemTypes.includes(o) && o !== 'object').map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* Toggles */}
                <div className="flex flex-wrap gap-3 pt-1">
                    <label className="flex items-center space-x-3 p-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700/30 transition-colors cursor-pointer border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700">
                        <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 select-none">Required Field</span>
                    </label>
                    <label className="flex items-center space-x-3 p-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700/30 transition-colors cursor-pointer border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700">
                        <input type="checkbox" checked={overrideHint} onChange={e => setOverrideHint(e.target.checked)} className="w-4 h-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500" />
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 select-none">Show Override Hint</span>
                    </label>
                </div>
            </div>
        </div>
    );
}
