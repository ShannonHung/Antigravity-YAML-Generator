import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, X, Check, AlertTriangle, Info } from 'lucide-react';
import { api } from '@/lib/api';

interface KeyEditorProps {
    filePath: string;
    targetKey: string; // "root.ntp.servers"
    onClose: () => void;
    onSave: () => void;
}

export default function KeyEditor({ filePath, targetKey, onClose, onSave }: KeyEditorProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fullContent, setFullContent] = useState<any>(null);

    // Form State
    const [keyName, setKeyName] = useState('');
    const [description, setDescription] = useState('');
    const [required, setRequired] = useState(false);
    const [overrideHint, setOverrideHint] = useState(false);
    const [types, setTypes] = useState<string[]>([]);
    const [itemTypes, setItemTypes] = useState<string[]>([]);

    // Logic for Regex vs Value
    const [regexEnable, setRegexEnable] = useState(false);
    const [regexPattern, setRegexPattern] = useState('');
    const [defaultValue, setDefaultValue] = useState('');
    const [defaultValueError, setDefaultValueError] = useState<string | null>(null);

    // UI State for Types
    const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
    const OPTIONS_TYPES = ['string', 'number', 'object', 'list', 'boolean', 'ntp', 'ip'];

    useEffect(() => {
        loadData();
    }, [filePath, targetKey]);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await api.getFileContent(filePath);
            const content = JSON.parse(data.content);
            setFullContent(content);

            const pathParts = targetKey.split('.').filter(p => p !== 'root');

            // Helper to find node
            const findNodeRecursive = (list: any[], path: string[]): any => {
                const [head, ...tail] = path;
                for (const item of list) {
                    if (item.key === head) {
                        if (tail.length === 0) return item;
                        if (item.children) return findNodeRecursive(item.children, tail);
                    }
                }
                return null;
            };

            const node = findNodeRecursive(Array.isArray(content) ? content : [content], pathParts);

            if (!node) throw new Error(`Key '${targetKey}' not found.`);

            setKeyName(node.key);
            setDescription(node.description || '');
            setRequired(!!node.required);
            setOverrideHint(!!node.override_hint);
            setTypes(node.multi_type || (node.type ? [node.type] : []));
            setItemTypes(node.item_multi_type || []);

            setRegexEnable(!!node.regex_enable);
            setRegexPattern(node.regex || '');

            // Format default value as JSON string if object/list, else string
            if (node.default_value !== undefined) {
                if (typeof node.default_value === 'object') {
                    setDefaultValue(JSON.stringify(node.default_value, null, 4));
                } else {
                    setDefaultValue(String(node.default_value));
                }
            } else {
                setDefaultValue('');
            }

        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        // Validate Default Value if it's supposed to be JSON
        let finalDefaultValue: any = defaultValue;
        if (!regexEnable && defaultValue) {
            // Attempt to parse if it looks like JSON structure or needs type conversion
            try {
                // If types include object or list, enforce JSON parsing
                if (types.includes('object') || types.includes('list')) {
                    finalDefaultValue = JSON.parse(defaultValue);
                } else if (types.includes('boolean')) {
                    finalDefaultValue = defaultValue === 'true';
                } else if (types.includes('number')) {
                    finalDefaultValue = parseFloat(defaultValue);
                    if (isNaN(finalDefaultValue)) throw new Error("Invalid number");
                }
            } catch (e) {
                alert("Invalid Default Value format for selected type.");
                return;
            }
        }

        try {
            const newContent = JSON.parse(JSON.stringify(fullContent));
            const pathParts = targetKey.split('.').filter(p => p !== 'root');

            const updateNodeRecursive = (list: any[], path: string[]) => {
                const [head, ...tail] = path;
                for (const item of list) {
                    if (item.key === head) {
                        if (tail.length === 0) {
                            // Update Schema
                            item.key = keyName;
                            item.description = description;
                            item.required = required;
                            item.override_hint = overrideHint;
                            item.multi_type = types;

                            if (types.includes('list')) {
                                item.item_multi_type = itemTypes;
                            } else {
                                delete item.item_multi_type;
                            }

                            // Update Logic (Regex vs Default)
                            if (regexEnable) {
                                item.regex_enable = true;
                                item.regex = regexPattern;
                                delete item.default_value;
                            } else {
                                item.regex_enable = false;
                                delete item.regex;
                                if (defaultValue !== '') {
                                    item.default_value = finalDefaultValue;
                                } else {
                                    delete item.default_value;
                                }
                            }
                            return;
                        }
                        if (item.children) updateNodeRecursive(item.children, tail);
                    }
                }
            };

            updateNodeRecursive(Array.isArray(newContent) ? newContent : [newContent], pathParts);

            await api.createFile(filePath, JSON.stringify(newContent, null, 4));
            onSave();
        } catch (e: any) {
            alert("Failed to save: " + e.message);
        }
    };

    const validateDefaultValue = (val: string) => {
        if (!val) { setDefaultValueError(null); return; }
        if (types.includes('object') || types.includes('list')) {
            try { JSON.parse(val); setDefaultValueError(null); }
            catch (e) { setDefaultValueError("Invalid JSON format"); }
        } else {
            setDefaultValueError(null);
        }
    }

    const InfoLabel = ({ label, tooltip }: { label: string, tooltip: string }) => (
        <div className="flex items-center mb-1">
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mr-2">{label}</span>
            <div className="relative group cursor-help">
                <Info className="w-3.5 h-3.5 text-zinc-400 hover:text-blue-500" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50 w-max max-w-xs pointer-events-none">
                    <div className="bg-zinc-800 text-white text-[10px] rounded px-3 py-2 shadow-xl border border-zinc-700 leading-relaxed">
                        {tooltip}
                    </div>
                    <div className="absolute left-1 top-full w-0 h-0 border-4 border-transparent border-t-zinc-800"></div>
                </div>
            </div>
        </div>
    );

    if (loading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>;
    if (error) return (
        <div className="p-8 flex flex-col items-center text-red-500">
            <AlertTriangle className="w-12 h-12 mb-4 opacity-50" />
            <h2 className="text-xl font-bold mb-2">Error Loading Key</h2>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm">{error}</p>
            <button onClick={onClose} className="mt-8 px-6 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full text-zinc-900 dark:text-zinc-100 text-sm font-medium transition-colors">Go Back</button>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-950 animate-in fade-in slide-in-from-right-8 duration-500">
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-8 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md flex-shrink-0 z-10 sticky top-0">
                <div className="flex items-center space-x-4">
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">Edit Key</h2>
                        <p className="text-xs text-zinc-500 font-mono mt-0.5">{targetKey}</p>
                    </div>
                </div>
                <div className="flex space-x-3">
                    <button onClick={onClose} className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm hover:shadow transition-all text-sm font-medium">
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                    </button>
                </div>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-8 w-full custom-scrollbar">
                <div className="max-w-5xl mx-auto space-y-8 pb-20">

                    {/* Identity Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center mb-6">
                            <span className="w-8 h-px bg-zinc-300 dark:bg-zinc-700 mr-3"></span>
                            Identity & Properties
                        </h3>

                        <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
                            {/* Key Name */}
                            <div>
                                <InfoLabel label="Key Name" tooltip="Unique identifier for this field." />
                                <input
                                    type="text"
                                    value={keyName}
                                    onChange={e => setKeyName(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none font-mono"
                                />
                                <p className="text-xs text-amber-600/70 mt-2 flex items-center">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    Renaming keys may break existing references in the YAML structure.
                                </p>
                            </div>

                            {/* Constraints Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                <div>
                                    <InfoLabel label="Type(s)" tooltip="Allowed data types for this field." />
                                    <div className="relative">
                                        <div className="w-full min-h-[42px] p-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg flex flex-wrap gap-2 cursor-text transition-all hover:border-zinc-300 dark:hover:border-zinc-600" onClick={() => setIsTypeDropdownOpen(true)}>
                                            {types.map(t => (
                                                <span key={t} className="bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs px-2.5 py-1 rounded-md flex items-center font-medium border border-blue-100 dark:border-blue-500/20">
                                                    {t}
                                                    <button onClick={(e) => { e.stopPropagation(); setTypes(types.filter(x => x !== t)); }} className="ml-2 hover:text-blue-900 dark:hover:text-blue-100"><X className="w-3 h-3" /></button>
                                                </span>
                                            ))}
                                            <input readOnly type="text" className="flex-1 bg-transparent outline-none text-sm min-w-[100px] cursor-pointer h-7 px-1" placeholder={types.length === 0 ? "Select type..." : ""} />
                                        </div>

                                        {isTypeDropdownOpen && (
                                            <>
                                                <div className="fixed inset-0 z-20" onClick={() => setIsTypeDropdownOpen(false)} />
                                                <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto py-2">
                                                    {OPTIONS_TYPES.filter(o => !types.includes(o)).map(opt => (
                                                        <button
                                                            key={opt}
                                                            className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700/50 text-zinc-700 dark:text-zinc-200 font-mono transition-colors border-l-2 border-transparent hover:border-blue-500"
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

                                {types.includes('list') && (
                                    <div className="pl-6 border-l-2 border-purple-100 dark:border-purple-500/20">
                                        <InfoLabel label="List Item Type(s)" tooltip="Allowed types for list items." />
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {itemTypes.map(t => (
                                                <span key={t} className="bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 text-xs px-2.5 py-1 rounded-md flex items-center font-medium border border-purple-100 dark:border-purple-500/20">
                                                    {t}
                                                    <button onClick={() => setItemTypes(itemTypes.filter(x => x !== t))} className="ml-2 hover:text-purple-900 dark:hover:text-purple-100"><X className="w-3 h-3" /></button>
                                                </span>
                                            ))}
                                        </div>
                                        <select
                                            className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500/20 transition-all cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-600"
                                            onChange={(e) => { if (e.target.value) setItemTypes([...itemTypes, e.target.value]); e.target.value = ''; }}
                                        >
                                            <option value="">+ Add item type</option>
                                            {OPTIONS_TYPES.filter(o => !itemTypes.includes(o)).map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Toggles */}
                            <div className="flex flex-wrap gap-6 pt-2">
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

                    {/* Logic Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center mb-6">
                            <span className="w-8 h-px bg-zinc-300 dark:bg-zinc-700 mr-3"></span>
                            Validation & Defaults
                        </h3>

                        <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center space-x-3">
                                    <span className={`text-sm font-bold ${regexEnable ? 'text-green-600 dark:text-green-400' : 'text-zinc-500'}`}>Regex Validation</span>
                                    <button
                                        onClick={() => setRegexEnable(!regexEnable)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${regexEnable ? 'bg-green-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${regexEnable ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                <span className="text-xs text-zinc-400">Toggle to switch between Pattern Matching or Default Value</span>
                            </div>

                            <div className="relative min-h-[80px]">
                                {regexEnable ? (
                                    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                                        <InfoLabel label="Regex Pattern" tooltip="Regular expression pattern that values must match." />
                                        <div className="relative group">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-sm group-focus-within:text-green-500">/</span>
                                            <input
                                                type="text"
                                                value={regexPattern}
                                                onChange={e => setRegexPattern(e.target.value)}
                                                className="w-full pl-8 pr-8 py-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-mono text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                                                placeholder="^[a-z]+$"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-sm group-focus-within:text-green-500">/</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                        <InfoLabel label="Default Value" tooltip="Initial value if none provided. Supports JSON for complex types." />
                                        <textarea
                                            value={defaultValue}
                                            onChange={e => { setDefaultValue(e.target.value); validateDefaultValue(e.target.value); }}
                                            className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-zinc-800 text-sm font-mono focus:ring-2 outline-none transition-all min-h-[100px] ${defaultValueError ? 'border-red-500 focus:ring-red-500/20' : 'border-zinc-200 dark:border-zinc-700 focus:ring-blue-500/20 focus:border-blue-500'}`}
                                            placeholder='e.g. "default" or {"key": "val"}'
                                        />
                                        {defaultValueError && (
                                            <div className="flex items-center mt-2 text-xs text-red-500 font-medium animate-in fade-in slide-in-from-top-1">
                                                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                                                {defaultValueError}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Documentation Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center mb-6">
                            <span className="w-8 h-px bg-zinc-300 dark:bg-zinc-700 mr-3"></span>
                            Documentation
                        </h3>
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                            <div>
                                <InfoLabel label="Description" tooltip="Analysis of what this key is used for. displayed in tooltips." />
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 outline-none min-h-[150px] align-top transition-colors resize-y"
                                    placeholder="Enter a detailed description..."
                                />
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
