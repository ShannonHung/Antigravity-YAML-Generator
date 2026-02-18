import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, X, Check, AlertTriangle, Info, Edit3, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { DATA_TYPES, ITEM_DATA_TYPES } from '../config/editorConfig';
import { FieldType, OperationTypes, TYPE_OPERATORS, ConditionItem, ConditionGroup, OPERATOR_LABELS } from '@/lib/conditions';
import clsx from 'clsx';

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

    // Enum State
    const [enumValues, setEnumValues] = useState<string[]>([]);
    const [enumInput, setEnumInput] = useState('');

    // Condition State
    const [condition, setCondition] = useState<ConditionGroup | null>(null);
    const [availableKeys, setAvailableKeys] = useState<{ path: string, type: string }[]>([]);
    const [openConditionKeyIndex, setOpenConditionKeyIndex] = useState<number | null>(null);
    const [conditionKeySearch, setConditionKeySearch] = useState('');

    // Default Value Modal
    const [isDefaultValueModalOpen, setIsDefaultValueModalOpen] = useState(false);
    const [tempDefaultValue, setTempDefaultValue] = useState('');

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
            setRegexEnable(!!node.regex_enable);
            setRegexPattern(node.regex || '');

            // Initialize enum values if type is enum
            if ((node.multi_type || []).includes('enum') && node.regex) {
                try {
                    // Try parsing as JSON array first [a,b,c]
                    // If regex is just a string representation of list like "[a,b]", we parse it
                    // If it's a raw regex string, we might not be able to parse it as enum list easily unless we define a standard.
                    // The requirement says "store as string [a,b,c]". So we parse that string.
                    const cleaned = node.regex.replace(/^\[|\]$/g, '');
                    if (cleaned) {
                        setEnumValues(cleaned.split(',').map((s: string) => s.trim()));
                    } else {
                        setEnumValues([]);
                    }
                } catch (e) {
                    setEnumValues([]);
                }
            } else {
                setEnumValues([]);
            }

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

            if (node.condition) {
                setCondition(node.condition);
            } else {
                setCondition(null);
            }

            // Flatten keys to get available paths for conditions
            const keys: { path: string, type: string }[] = [];
            const flatten = (items: any[], prefix = '') => {
                for (const item of items) {
                    const currentPath = prefix ? `${prefix}.${item.key}` : item.key;
                    // Determine type (use first if multiple, or specific string representation)
                    const type = item.multi_type ? item.multi_type[0] : (item.type || 'string');
                    keys.push({ path: currentPath, type });

                    if (item.children) {
                        flatten(item.children, currentPath);
                    }
                }
            };
            flatten(Array.isArray(content) ? content : [content]);
            // Filter out current key to prevent circular dependency if needed, though self-reference might be valid in complex scenarios?
            // User requirement: "all fields of the same .yml.json file"
            setAvailableKeys(keys.filter(k => k.path !== targetKey && k.path !== 'root'));

        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        // Validate Default Value if it's supposed to be JSON
        let finalDefaultValue: any = defaultValue;
        if (defaultValue) {
            // Attempt to parse if it looks like JSON structure or needs type conversion
            try {
                // If types include object or list, enforce JSON parsing
                if (types.includes('object') || types.includes('list')) {
                    finalDefaultValue = JSON.parse(defaultValue);
                    // Auto-format
                    setDefaultValue(JSON.stringify(finalDefaultValue, null, 4));
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

                            // Update Logic (Decoupled)
                            if (types.includes('enum')) {
                                // Enum Mode: Save as [a,b,c] string
                                // User requested to keep regex_enable toggleable even for enum.
                                // So we respecting regexEnable state.
                                item.regex_enable = regexEnable;
                                item.regex = `[${enumValues.join(',')}]`;
                            } else {
                                // Regex/Fixed Mode
                                item.regex_enable = regexEnable;
                                if (regexPattern) {
                                    item.regex = regexPattern;
                                } else {
                                    delete item.regex;
                                }
                            }

                            if (defaultValue !== '') {
                                item.default_value = finalDefaultValue;
                            } else {
                                delete item.default_value;
                            }

                            // Update Condition
                            if (!required && condition && condition.conditions.length > 0) {
                                item.condition = condition;
                            } else {
                                delete item.condition;
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

    const InfoLabel = ({ label, tooltip, placement = 'right' }: { label: string, tooltip: string, placement?: 'top' | 'bottom' | 'right' }) => (
        <div className="flex items-center mb-1">
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mr-2">{label}</span>
            <div className="relative group cursor-help z-10">
                <Info className="w-3.5 h-3.5 text-zinc-400 hover:text-blue-500" />
                <div className={clsx(
                    "absolute hidden group-hover:block z-50 w-max max-w-xs pointer-events-none",
                    placement === 'top' && "left-0 bottom-full mb-2",
                    placement === 'right' && "left-full top-1/2 -translate-y-1/2 ml-2"
                )}>
                    <div className="bg-zinc-800 text-white text-[10px] rounded px-3 py-2 shadow-xl border border-zinc-700 leading-relaxed z-50 relative">
                        {tooltip}
                        {placement === 'top' && <div className="absolute left-1 top-full w-0 h-0 border-4 border-transparent border-t-zinc-800"></div>}
                        {placement === 'right' && <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-4 border-transparent border-r-zinc-800"></div>}
                    </div>
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
            <div className="flex-1 overflow-y-auto p-5 w-full custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-5 pb-20">

                    {/* Identity Section */}
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
                                            {types.map(t => (
                                                <span key={t} className="bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs px-2.5 py-1 rounded-md flex items-center font-medium border border-blue-100 dark:border-blue-500/20">
                                                    {t}
                                                    <button onClick={(e) => { e.stopPropagation(); setTypes(types.filter(x => x !== t)); }} className="ml-2 hover:text-blue-900 dark:hover:text-blue-100"><X className="w-3 h-3" /></button>
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
                                            {itemTypes.map(t => (
                                                <span key={t} className="bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 text-[10px] px-1.5 py-0.5 rounded flex items-center font-mono border border-purple-100 dark:border-purple-800">
                                                    {t}
                                                    <button onClick={() => setItemTypes(itemTypes.filter(x => x !== t))} className="ml-2 hover:text-purple-900 dark:hover:text-purple-100"><X className="w-3 h-3" /></button>
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

                    {/* Conditional Requirement Section - Only if NOT required */}
                    {!required && (
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
                                            {condition.conditions.map((cond, idx) => {
                                                const selectedKey = availableKeys.find(k => k.path === cond.key);
                                                const ops = selectedKey ? (TYPE_OPERATORS[selectedKey.type] || TYPE_OPERATORS['string']) : TYPE_OPERATORS['string'];

                                                return (
                                                    <div key={idx} className={`flex items-center space-x-2 bg-white dark:bg-zinc-800 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm group relative ${openConditionKeyIndex === idx ? 'z-50' : 'z-10'}`}>
                                                        {/* Key Selector (Custom Searchable Dropdown) */}
                                                        <div className="flex-1 w-[40%] relative">
                                                            <div
                                                                className="w-full text-xs border rounded px-2 py-1.5 border-zinc-200 dark:border-zinc-700 bg-transparent cursor-pointer hover:border-blue-400 truncate"
                                                                onClick={() => {
                                                                    setOpenConditionKeyIndex(idx);
                                                                    setConditionKeySearch('');
                                                                }}
                                                            >
                                                                {cond.key ? (
                                                                    <span>{cond.key} <span className="text-zinc-400 ml-1">({availableKeys.find(k => k.path === cond.key)?.type || '?'})</span></span>
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
                                                                                .filter(k => k.path.toLowerCase().includes(conditionKeySearch.toLowerCase()))
                                                                                .map(k => (
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
                                                                                        <span className="font-mono truncate mr-2">{k.path}</span>
                                                                                        <span className="text-[10px] text-zinc-400 bg-zinc-50 dark:bg-zinc-900 px-1 rounded border border-zinc-100 dark:border-zinc-700/50 group-hover/item:border-zinc-200">{k.type}</span>
                                                                                    </button>
                                                                                ))}
                                                                            {availableKeys.filter(k => k.path.toLowerCase().includes(conditionKeySearch.toLowerCase())).length === 0 && (
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
                                                            {ops.map(op => <option key={op} value={op}>{OPERATOR_LABELS[op] || op}</option>)}
                                                        </select>

                                                        {/* Value Input */}
                                                        <input
                                                            type="text"
                                                            className="flex-1 bg-transparent text-xs border rounded px-2 py-1.5 border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 w-[30%]"
                                                            placeholder="Value"
                                                            value={cond.value}
                                                            onChange={e => {
                                                                const newConds = [...condition.conditions];
                                                                newConds[idx].value = e.target.value;
                                                                setCondition({ ...condition, conditions: newConds });
                                                            }}
                                                        />

                                                        {/* Delete */}
                                                        <button
                                                            onClick={() => {
                                                                const newConds = condition.conditions.filter((_, i) => i !== idx);
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
                    )}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center mb-3">
                            <span className="w-8 h-px bg-zinc-300 dark:bg-zinc-700 mr-3"></span>
                            Validation & Defaults
                        </h3>

                        {/* Validation Block */}
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
                            {types.includes('enum') ? (
                                <div className="animate-in fade-in duration-300">
                                    <InfoLabel label="Enum Values" tooltip="List of allowed string values. Input text and press Enter to add." placement="right" />
                                    <div className="w-full min-h-[42px] p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg flex flex-wrap gap-2 transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
                                        {enumValues.map((val, idx) => (
                                            <span key={idx} className="bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs px-2 py-1 rounded-md flex items-center border border-zinc-200 dark:border-zinc-600">
                                                {val}
                                                <button
                                                    onClick={() => setEnumValues(enumValues.filter((_, i) => i !== idx))}
                                                    className="ml-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                        <input
                                            type="text"
                                            className="flex-1 bg-transparent outline-none text-xs font-mono min-w-[80px] h-6"
                                            placeholder="Add value..."
                                            value={enumInput}
                                            onChange={e => setEnumInput(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && enumInput.trim()) {
                                                    setEnumValues([...enumValues, enumInput.trim()]);
                                                    setEnumInput('');
                                                }
                                                if (e.key === 'Backspace' && !enumInput && enumValues.length > 0) {
                                                    setEnumValues(enumValues.slice(0, -1));
                                                }
                                            }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-zinc-400 mt-2">Values will be stored as comma-separated string `[val1,val2]`</p>

                                    {/* Enum Regex Toggle */}
                                    <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-700/50">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center space-x-3">
                                                <span className={`text-xs font-bold ${regexEnable ? 'text-green-600 dark:text-green-400' : 'text-zinc-500'}`}>
                                                    {regexEnable ? 'Regex Enabled' : 'Regex Disabled'}
                                                </span>
                                                <button
                                                    onClick={() => setRegexEnable(!regexEnable)}
                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${regexEnable ? 'bg-green-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                                                >
                                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${regexEnable ? 'translate-x-[18px]' : 'translate-x-1'}`} />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-zinc-400">If enabled, values will be treated as regex patterns during validation.</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center space-x-3">
                                            <span className={`text-xs font-bold ${regexEnable ? 'text-green-600 dark:text-green-400' : 'text-zinc-500'}`}>
                                                {regexEnable ? 'Regex Pattern' : 'Fixed Value'}
                                            </span>
                                            <button
                                                onClick={() => setRegexEnable(!regexEnable)}
                                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${regexEnable ? 'bg-green-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                                            >
                                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${regexEnable ? 'translate-x-[18px]' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="animate-in fade-in duration-300">
                                        <InfoLabel
                                            label={regexEnable ? "Pattern" : "Match Value"}
                                            tooltip={regexEnable ? "Value must match this regex pattern." : "Value must exactly equal this string."}
                                            placement="right"
                                        />
                                        <div className="relative group">
                                            {regexEnable && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-xs group-focus-within:text-green-500">/</span>}
                                            <input
                                                type="text"
                                                value={regexPattern}
                                                onChange={e => setRegexPattern(e.target.value)}
                                                className={`w-full ${regexEnable ? 'pl-6 pr-6' : 'px-3'} py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all`}
                                                placeholder={regexEnable ? "^[a-z]+$" : "exact_value"}
                                            />
                                            {regexEnable && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-xs group-focus-within:text-green-500">/</span>}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="w-full h-px bg-zinc-200 dark:bg-zinc-800"></div>

                        {/* Default Value Block */}
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
                            <div className="flex items-center justify-between mb-2">
                                <InfoLabel label="Template Default Value" tooltip="Value used when generating the template. Supports JSON for object/list types. Auto-formats on save." placement="right" />
                                <button
                                    onClick={() => { setTempDefaultValue(defaultValue); setIsDefaultValueModalOpen(true); }}
                                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline flex items-center"
                                >
                                    <Edit3 className="w-3 h-3 mr-1" />
                                    Edit in Modal
                                </button>
                            </div>

                            <div
                                onClick={() => { setTempDefaultValue(defaultValue); setIsDefaultValueModalOpen(true); }}
                                className={`w-full px-3 py-2 rounded-lg border bg-zinc-50 dark:bg-zinc-900/50 text-xs font-mono min-h-[60px] cursor-pointer hover:border-blue-400 transition-all ${defaultValueError ? 'border-red-500' : 'border-zinc-200 dark:border-zinc-700'} text-zinc-600 dark:text-zinc-300 overflow-hidden text-ellipsis`}
                            >
                                {defaultValue || <span className="text-zinc-400 italic">No default value set...</span>}
                            </div>

                            {defaultValueError && (
                                <div className="flex items-center mt-2 text-xs text-red-500 font-medium animate-in fade-in slide-in-from-top-1">
                                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                                    {defaultValueError}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Documentation Section */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center mb-3">
                            <span className="w-8 h-px bg-zinc-300 dark:bg-zinc-700 mr-3"></span>
                            Documentation
                        </h3>
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
                            <div>
                                <InfoLabel label="Description" tooltip="Analysis of what this key is used for. displayed in tooltips." placement="right" />
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 outline-none min-h-[100px] align-top transition-colors resize-y"
                                    placeholder="Enter a detailed description..."
                                />
                            </div>
                        </div>
                    </div>

                </div>
            </div>


            {/* Default Value Modal Overlay */}
            {
                isDefaultValueModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col border border-zinc-200 dark:border-zinc-800">
                            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
                                <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">Edit Default Value</h3>
                                <button onClick={() => setIsDefaultValueModalOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                                    <X className="w-5 h-5 text-zinc-500" />
                                </button>
                            </div>
                            <div className="flex-1 p-4 overflow-hidden relative">
                                <textarea
                                    value={tempDefaultValue}
                                    onChange={e => setTempDefaultValue(e.target.value)}
                                    className="w-full h-full bg-zinc-50 dark:bg-zinc-950 font-mono text-sm p-4 rounded-lg resize-none outline-none focus:ring-2 focus:ring-blue-500/20 border border-zinc-200 dark:border-zinc-800"
                                    placeholder="Enter JSON or string value..."
                                />
                                <div className="absolute bottom-6 right-6 flex space-x-2">
                                    <button
                                        onClick={() => {
                                            try {
                                                // Auto format if json
                                                const parsed = JSON.parse(tempDefaultValue);
                                                setTempDefaultValue(JSON.stringify(parsed, null, 4));
                                            } catch (e) { /* ignore */ }
                                        }}
                                        className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-800 text-xs font-medium rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
                                    >
                                        Format JSON
                                    </button>
                                </div>
                            </div>
                            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end space-x-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-b-xl">
                                <button
                                    onClick={() => setIsDefaultValueModalOpen(false)}
                                    className="px-5 py-2.5 text-zinc-600 dark:text-zinc-400 font-medium hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        setDefaultValue(tempDefaultValue);
                                        validateDefaultValue(tempDefaultValue);
                                        setIsDefaultValueModalOpen(false);
                                    }}
                                    className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-lg hover:shadow-blue-500/20 transition"
                                >
                                    Apply Changes
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
