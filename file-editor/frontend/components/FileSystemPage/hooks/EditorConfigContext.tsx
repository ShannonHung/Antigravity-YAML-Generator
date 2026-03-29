'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import {
    DATA_TYPES,
    ITEM_DATA_TYPES,
    DEFAULT_PLUGINS,
    UNIQUENESS_OPTIONS,
    DEFAULT_BACKEND_URL,
} from '@/config/editorConfig';
import { setBackendUrl } from '@/lib/api';

// Type definition for what the context will hold
export interface EditorConfig {
    DATA_TYPES: string[];
    ITEM_DATA_TYPES: string[];
    DEFAULT_PLUGINS: string[];
    UNIQUENESS_OPTIONS: string[];
    BACKEND_URL: string;
}

// Ensure defaults are available in case the provider is missing or errors
const defaultConfig: EditorConfig = {
    DATA_TYPES,
    ITEM_DATA_TYPES,
    DEFAULT_PLUGINS,
    UNIQUENESS_OPTIONS,
    BACKEND_URL: DEFAULT_BACKEND_URL,
};

const EditorConfigContext = createContext<EditorConfig>(defaultConfig);

export function EditorConfigProvider({
    children,
    config
}: {
    children: ReactNode,
    config?: Partial<EditorConfig>
}) {
    // Merge provided config with defaults, falling back to defaults for missing keys
    const mergedConfig: EditorConfig = {
        DATA_TYPES: config?.DATA_TYPES && config.DATA_TYPES.length > 0 ? config.DATA_TYPES : defaultConfig.DATA_TYPES,
        ITEM_DATA_TYPES: config?.ITEM_DATA_TYPES && config.ITEM_DATA_TYPES.length > 0 ? config.ITEM_DATA_TYPES : defaultConfig.ITEM_DATA_TYPES,
        DEFAULT_PLUGINS: config?.DEFAULT_PLUGINS && config.DEFAULT_PLUGINS.length > 0 ? config.DEFAULT_PLUGINS : defaultConfig.DEFAULT_PLUGINS,
        UNIQUENESS_OPTIONS: config?.UNIQUENESS_OPTIONS && config.UNIQUENESS_OPTIONS.length > 0 ? config.UNIQUENESS_OPTIONS : defaultConfig.UNIQUENESS_OPTIONS,
        BACKEND_URL: config?.BACKEND_URL || defaultConfig.BACKEND_URL,
    };

    // Synchronously set the backend URL so it's available before any child useEffect runs
    setBackendUrl(mergedConfig.BACKEND_URL);

    return (
        <EditorConfigContext.Provider value={mergedConfig}>
            {children}
        </EditorConfigContext.Provider>
    );
}

export function useEditorConfig() {
    return useContext(EditorConfigContext);
}
