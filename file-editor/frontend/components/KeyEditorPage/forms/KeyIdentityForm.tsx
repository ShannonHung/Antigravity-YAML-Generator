import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Typeahead, Menu, MenuItem } from 'react-bootstrap-typeahead';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import { useEditorConfig } from '../../FileSystemPage/hooks/EditorConfigContext';
import { InfoLabel } from './InfoLabel';
import clsx from 'clsx';

export default function KeyIdentityForm({
    keyName, setKeyName,
    types, setTypes,
    itemTypes, setItemTypes,
    required, setRequired,
    eitherRequired, setEitherRequired,
    uniqueness, setUniqueness,
    overrideHint, setOverrideHint,
    overrideStrategy, setOverrideStrategy,
    plugins, setPlugins
}: any) {
    const { DATA_TYPES, ITEM_DATA_TYPES, DEFAULT_PLUGINS, UNIQUENESS_OPTIONS } = useEditorConfig();

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
                        <div className="min-h-[42px] transition-all bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg flex items-center flex-wrap px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 hover:border-zinc-300 dark:hover:border-zinc-600">
                            <Typeahead
                                id="type-select-editor"
                                multiple
                                options={DATA_TYPES}
                                selected={types}
                                onChange={(s) => {
                                    const selected = s as string[];
                                    if (selected.includes('enum')) {
                                        setTypes(['enum']);
                                    } else {
                                        setTypes(selected);
                                    }
                                }}
                                placeholder={types.length === 0 ? "Search types..." : ""}
                                className="flex-1"
                                inputProps={{
                                    className: 'bg-transparent border-none outline-none text-[13px] py-1 px-2 w-full text-zinc-900 dark:text-zinc-100 min-w-[100px]',
                                }}
                                renderToken={(option, props, index) => (
                                    <div key={index} className="bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[11px] px-2.5 py-1 rounded-md flex items-center font-mono border border-blue-100 dark:border-blue-500/20 m-1 shadow-sm">
                                        {option as string}
                                        <button onClick={(e) => { e.stopPropagation(); props.onRemove && props.onRemove(option); }} className="ml-2 hover:text-blue-900 dark:hover:text-blue-100 transition-colors"><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                )}
                                renderMenuItemChildren={(option) => (
                                    <div className="text-[13px] font-mono text-zinc-700 dark:text-zinc-200 px-2 py-0.5">{option as string}</div>
                                )}
                                renderMenu={(results, { newSelectionPrefix, paginationText, renderMenuItemChildren, ...menuProps }: any) => (
                                    <Menu {...menuProps} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1 mt-2 z-[100]">
                                        {results.map((result, index) => (
                                            <MenuItem key={index} option={result} position={index}>
                                                <div className="text-[13px] font-mono text-zinc-700 dark:text-zinc-200 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 cursor-pointer border-l-2 border-transparent hover:border-blue-500 transition-all">
                                                    {result as string}
                                                </div>
                                            </MenuItem>
                                        ))}
                                    </Menu>
                                )}
                            />
                        </div>
                    </div>

                    {types.includes('list') && (
                        <div className="pl-6 border-l-2 border-purple-100 dark:border-purple-500/20">
                            <InfoLabel label="List Item Type(s)" tooltip="Allowed types for list items." placement="right" />
                            <div className="min-h-[42px] transition-all bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg flex items-center flex-wrap px-3 py-2 focus-within:ring-2 focus-within:ring-purple-500/20 focus-within:border-purple-500 hover:border-zinc-300 dark:hover:border-zinc-600">
                                <Typeahead
                                    id="item-type-select-editor"
                                    multiple
                                    options={ITEM_DATA_TYPES}
                                    selected={itemTypes}
                                    onChange={(s) => setItemTypes(s as string[])}
                                    placeholder={itemTypes.length === 0 ? "Search item types..." : ""}
                                    className="flex-1"
                                    inputProps={{
                                        className: 'bg-transparent border-none outline-none text-[13px] py-1 px-2 w-full text-zinc-900 dark:text-zinc-100 min-w-[100px]',
                                    }}
                                    renderToken={(option, props, index) => (
                                        <div key={index} className="bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[11px] px-2.5 py-1 rounded-md flex items-center font-mono border border-purple-100 dark:border-purple-500/20 m-1 shadow-sm">
                                            {option as string}
                                            <button onClick={(e) => { e.stopPropagation(); props.onRemove && props.onRemove(option); }} className="ml-2 hover:text-purple-900 dark:hover:text-purple-100 transition-colors"><X className="w-3.5 h-3.5" /></button>
                                        </div>
                                    )}
                                    renderMenuItemChildren={(option) => (
                                        <div className="text-[13px] font-mono text-zinc-700 dark:text-zinc-200 px-2 py-0.5">{option as string}</div>
                                    )}
                                    renderMenu={(results, { newSelectionPrefix, paginationText, renderMenuItemChildren, ...menuProps }: any) => (
                                        <Menu {...menuProps} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1 mt-2 z-[100]">
                                            {results.map((result, index) => (
                                                <MenuItem key={index} option={result} position={index}>
                                                    <div className="text-[13px] font-mono text-zinc-700 dark:text-zinc-200 px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-700/50 cursor-pointer border-l-2 border-transparent hover:border-purple-500 transition-all">
                                                        {result as string}
                                                    </div>
                                                </MenuItem>
                                            ))}
                                        </Menu>
                                    )}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Toggles */}
                <div className="flex flex-wrap gap-3 pt-1">
                    {/* Required Status Selector */}
                    <div className="w-full md:w-[48%]">
                        <InfoLabel label="Field Status" tooltip="Define the requirement status of this field." placement="right" />
                        <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 border border-zinc-200 dark:border-zinc-700">
                            <button
                                onClick={() => setRequired(true)}
                                className={clsx(
                                    "flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center",
                                    required === true
                                        ? "bg-white dark:bg-zinc-700 shadow text-green-600 dark:text-green-400"
                                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                )}
                            >
                                Required
                            </button>
                            <button
                                onClick={() => setRequired(false)}
                                className={clsx(
                                    "flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center",
                                    required === false
                                        ? "bg-white dark:bg-zinc-700 shadow text-blue-600 dark:text-blue-400"
                                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                )}
                            >
                                Optional
                            </button>
                            <button
                                onClick={() => setRequired(null)}
                                className={clsx(
                                    "flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center",
                                    required === null
                                        ? "bg-white dark:bg-zinc-700 shadow text-red-600 dark:text-red-400"
                                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                )}
                            >
                                Deprecated
                            </button>
                        </div>
                    </div>

                    {/* Either Required Selector */}
                    <div className="w-full md:w-[48%] mt-2 md:mt-0">
                        <InfoLabel label="Either Required" tooltip="If true, at least one key at this path level must exist." placement="right" />
                        <label className="flex items-center h-[36px] space-x-3 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                            <div className="relative flex items-center">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={eitherRequired}
                                    onChange={(e) => setEitherRequired(e.target.checked)}
                                />
                                <div className="w-8 h-4 bg-zinc-200 dark:bg-zinc-700 rounded-full peer peer-checked:bg-purple-600 transition-colors"></div>
                                <div className="absolute left-1 w-2 h-2 bg-white rounded-full peer-checked:translate-x-4 transition-transform"></div>
                            </div>
                            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Requires peers</span>
                        </label>
                    </div>

                    {/* Uniqueness Selector */}
                    <div className="w-full md:w-[48%]">
                        <InfoLabel label="Uniqueness" tooltip="The scoping level at which this key must be unique." placement="right" />
                        <div className="relative">
                            <select
                                value={uniqueness}
                                onChange={(e) => setUniqueness(e.target.value)}
                                className="w-full px-3 py-[9px] bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium transition-colors appearance-none cursor-pointer text-zinc-700 dark:text-zinc-100"
                            >
                                {UNIQUENESS_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-[10px] pointer-events-none text-zinc-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                    </div>

                    {/* Override Strategy Selector */}
                    <div className="w-full md:w-[48%]">
                        <InfoLabel label="Override Strategy" tooltip="How this array/object merges across inventory files." placement="right" />
                        <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 border border-zinc-200 dark:border-zinc-700">
                            <button
                                onClick={() => setOverrideStrategy('merge')}
                                className={clsx(
                                    "flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center",
                                    overrideStrategy === 'merge'
                                        ? "bg-white dark:bg-zinc-700 shadow text-zinc-900 dark:text-zinc-100"
                                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                )}
                            >
                                Merge
                            </button>
                            <button
                                onClick={() => setOverrideStrategy('replace')}
                                className={clsx(
                                    "flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center",
                                    overrideStrategy === 'replace'
                                        ? "bg-white dark:bg-zinc-700 shadow text-amber-600 dark:text-amber-400"
                                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                )}
                            >
                                Replace
                            </button>
                        </div>
                    </div>

                    <div className="w-full mt-2">
                        <label className="inline-flex items-center space-x-3 p-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700/30 transition-colors cursor-pointer border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700">
                            <input type="checkbox" checked={overrideHint} onChange={e => setOverrideHint(e.target.checked)} className="w-4 h-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500" />
                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 select-none">Show Override Hint</span>
                        </label>
                    </div>

                    {/* Plugins Editor */}
                    <div className="w-full mt-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                        <InfoLabel label="Generator Plugins" tooltip="List of generator plugins to apply to this key." placement="right" />
                        <div className="min-h-[42px] transition-all bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl flex items-center flex-wrap px-3 py-2 focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-500 hover:border-zinc-300 dark:hover:border-zinc-600">
                            <Typeahead
                                id="plugins-select-editor"
                                multiple
                                allowNew
                                options={DEFAULT_PLUGINS}
                                selected={plugins}
                                onChange={(s) => {
                                    const selected = s.map((item: any) => typeof item === 'string' ? item : item.label);
                                    setPlugins(selected);
                                }}
                                placeholder={plugins.length === 0 ? "Add plugin..." : ""}
                                className="flex-1"
                                inputProps={{
                                    className: 'bg-transparent border-none outline-none text-[13px] py-1 px-2 w-full text-zinc-900 dark:text-zinc-100 min-w-[120px] font-mono'
                                }}
                                renderToken={(option: any, props, index) => (
                                    <div key={index} className="bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 text-[11px] px-2.5 py-1 rounded-md flex items-center font-mono border border-teal-100 dark:border-teal-800 m-1 shadow-sm">
                                        {(option as any).label || (option as any)}
                                        <button onClick={(e) => { e.stopPropagation(); props.onRemove && props.onRemove(option); }} className="ml-2 hover:text-teal-900 dark:hover:text-teal-100 transition-colors"><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                )}
                                renderMenu={(results, { newSelectionPrefix, paginationText, renderMenuItemChildren, ...menuProps }: any) => (
                                    <Menu {...menuProps} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1 mt-2 z-[100]">
                                        {results.map((result: any, index: number) => (
                                            <MenuItem key={index} option={result} position={index}>
                                                <div className="text-[13px] font-mono text-zinc-700 dark:text-zinc-200 px-3 py-2 hover:bg-teal-50 dark:hover:bg-teal-900/30 cursor-pointer border-l-2 border-transparent hover:border-teal-500 transition-all">
                                                    {result.label || result}
                                                </div>
                                            </MenuItem>
                                        ))}
                                    </Menu>
                                )}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
