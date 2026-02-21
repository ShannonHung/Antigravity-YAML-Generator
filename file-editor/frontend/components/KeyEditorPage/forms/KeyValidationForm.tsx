import React, { useState } from 'react';
import { X, Edit3, AlertTriangle } from 'lucide-react';
import { InfoLabel } from './InfoLabel';

export default function KeyValidationForm({
    types,
    regexEnable, setRegexEnable,
    regexPattern, setRegexPattern,
    enumValues, setEnumValues,
    defaultValue, setDefaultValue,
    onEditDefaultValue
}: any) {
    const [enumInput, setEnumInput] = useState('');
    const [defaultValueError, setDefaultValueError] = useState<string | null>(null);

    const validateDefaultValue = (val: string) => {
        if (!val) { setDefaultValueError(null); return; }
        const trimmed = val.trim();
        if (types.includes('object') || types.includes('list')) {
            try { JSON.parse(val); setDefaultValueError(null); }
            catch (e) { setDefaultValueError("Invalid JSON format"); }
        } else if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            try { JSON.parse(val); setDefaultValueError(null); }
            catch (e) { setDefaultValueError("Invalid literal JSON format (optional)"); }
        } else {
            setDefaultValueError(null);
        }
    }

    return (
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
                            {enumValues.map((val: string, idx: number) => (
                                <span key={idx} className="bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs px-2 py-1 rounded-md flex items-center border border-zinc-200 dark:border-zinc-600">
                                    {val}
                                    <button
                                        onClick={() => setEnumValues(enumValues.filter((_: any, i: number) => i !== idx))}
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
                        onClick={onEditDefaultValue}
                        className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline flex items-center"
                    >
                        <Edit3 className="w-3 h-3 mr-1" />
                        Edit in Modal
                    </button>
                </div>

                <div
                    onClick={onEditDefaultValue}
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
    );
}
