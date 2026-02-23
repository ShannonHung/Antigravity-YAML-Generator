import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { joinPaths, splitPath, escapeKey } from '@/lib/pathUtils';

export function useKeyData(filePath: string, targetKey: string) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fullContent, setFullContent] = useState<any>(null);
    const [initialData, setInitialData] = useState<any>(null);
    const [availableKeys, setAvailableKeys] = useState<{ path: string, type: string }[]>([]);

    useEffect(() => {
        loadData();
    }, [filePath, targetKey]);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await api.getFileContent(filePath);
            const content = JSON.parse(data.content);
            setFullContent(content);

            const pathParts = splitPath(targetKey).filter(p => p !== 'root');

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

            setInitialData(node);

            // Flatten keys to get available paths for conditions
            const keys: { path: string, type: string }[] = [];
            const flatten = (items: any[], prefix = '') => {
                for (const item of items) {
                    const currentPath = joinPaths(prefix, escapeKey(item.key));
                    // Determine type (use first if multiple, or specific string representation)
                    const type = item.multi_type ? item.multi_type[0] : (item.type || 'string');
                    keys.push({ path: currentPath, type });

                    if (item.children) {
                        flatten(item.children, currentPath);
                    }
                }
            };
            flatten(Array.isArray(content) ? content : [content]);

            // Filter out current key to prevent circular dependency if needed
            setAvailableKeys(keys.filter(k => k.path !== targetKey && k.path !== 'root'));

        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return { loading, error, fullContent, initialData, availableKeys };
}
