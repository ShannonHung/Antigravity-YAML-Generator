import React from 'react';
import { InfoLabel } from './InfoLabel';

export default function KeyDocumentationForm({ description, setDescription }: any) {
    return (
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
    );
}
