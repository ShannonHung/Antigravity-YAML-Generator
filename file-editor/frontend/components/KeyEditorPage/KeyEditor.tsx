import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

// Hooks
import { useKeyData } from './hooks/useKeyData';
import { useKeyForm } from './hooks/useKeyForm';
import { useKeyMutations } from './hooks/useKeyMutations';

// Components
import KeyIdentityForm from './forms/KeyIdentityForm';
import KeyConditionForm from './forms/KeyConditionForm';
import KeyValidationForm from './forms/KeyValidationForm';
import KeyDocumentationForm from './forms/KeyDocumentationForm';
import KeyEditorHeader from './KeyEditorHeader';
import KeyEditorToolbar from './KeyEditorToolbar';

interface KeyEditorProps {
    filePath: string;
    targetKey: string;
    onClose: () => void;
    onSave: () => void;
    onNavigate: (path: string) => void;
}

export default function KeyEditor({ filePath, targetKey, onClose, onSave, onNavigate }: KeyEditorProps) {
    // 1. Data Store
    const { loading, error, fullContent, initialData, availableKeys } = useKeyData(filePath, targetKey);

    // 2. Form State
    const form = useKeyForm(initialData);

    // 3. Mutations
    const { handleSave } = useKeyMutations(filePath, targetKey, fullContent, onSave);

    // 4. Local UI State
    const [isDefaultValueModalOpen, setIsDefaultValueModalOpen] = useState(false);
    const [tempDefaultValue, setTempDefaultValue] = useState('');

    const onSaveClick = () => {
        handleSave(form);
    };

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
            {/* Header */}
            <KeyEditorHeader
                targetKey={targetKey}
                onClose={onClose}
                onSave={onSaveClick}
            />

            {/* Toolbar */}
            <KeyEditorToolbar
                filePath={filePath}
                onClose={onClose}
                onNavigate={onNavigate}
            />

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-5 w-full custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-5 pb-20">
                    <KeyIdentityForm
                        keyName={form.keyName} setKeyName={form.setKeyName}
                        types={form.types} setTypes={form.setTypes}
                        itemTypes={form.itemTypes} setItemTypes={form.setItemTypes}
                        required={form.required} setRequired={form.setRequired}
                        overrideHint={form.overrideHint} setOverrideHint={form.setOverrideHint}
                        overrideStrategy={form.overrideStrategy} setOverrideStrategy={form.setOverrideStrategy}
                    />

                    {!form.required && (
                        <KeyConditionForm
                            condition={form.condition}
                            setCondition={form.setCondition}
                            availableKeys={availableKeys}
                        />
                    )}

                    <KeyValidationForm
                        types={form.types}
                        regexEnable={form.regexEnable} setRegexEnable={form.setRegexEnable}
                        regexPattern={form.regexPattern} setRegexPattern={form.setRegexPattern}
                        enumValues={form.enumValues} setEnumValues={form.setEnumValues}
                        defaultValue={form.defaultValue} setDefaultValue={form.setDefaultValue}
                        onEditDefaultValue={() => {
                            setTempDefaultValue(form.defaultValue);
                            setIsDefaultValueModalOpen(true);
                        }}
                    />

                    <KeyDocumentationForm
                        description={form.description} setDescription={form.setDescription}
                    />
                </div>
            </div>

            {/* Default Value Modal Overlay */}
            {isDefaultValueModalOpen && (
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
                                    form.setDefaultValue(tempDefaultValue);
                                    setIsDefaultValueModalOpen(false);
                                }}
                                className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-lg hover:shadow-blue-500/20 transition"
                            >
                                Apply Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
