import { useState } from 'react';
import { JsonNode } from '../types';

export function useJsonUiState(nodes: JsonNode[]) {
    // Helper to get all keys with children
    const getAllExpandableKeys = (list: JsonNode[]): Set<string> => {
        const keys = new Set<string>();
        const traverse = (items: JsonNode[]) => {
            items.forEach(n => {
                if (n.children && n.children.length > 0) {
                    keys.add(n.key);
                    traverse(n.children);
                }
            });
        };
        traverse(list);
        return keys;
    };

    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => getAllExpandableKeys(nodes));
    const [isAddKeyModalOpen, setIsAddKeyModalOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ node: JsonNode, parentPath: string } | null>(null);

    const toggleExpand = (key: string) => {
        const newSet = new Set(expandedKeys);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        setExpandedKeys(newSet);
    };

    const expandAll = () => {
        const allKeys = new Set<string>();
        const traverse = (list: JsonNode[]) => {
            list.forEach(n => {
                if (n.children && n.children.length > 0) {
                    allKeys.add(n.key);
                    traverse(n.children);
                }
            });
        };
        traverse(nodes);
        setExpandedKeys(allKeys);
    };

    const collapseAll = () => setExpandedKeys(new Set());

    return {
        expandedKeys,
        toggleExpand,
        expandAll,
        collapseAll,
        isAddKeyModalOpen,
        setIsAddKeyModalOpen,
        deleteTarget,
        setDeleteTarget
    };
}
