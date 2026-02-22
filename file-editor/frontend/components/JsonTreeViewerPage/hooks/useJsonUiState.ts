import { useState, useEffect, useCallback } from 'react';
import { JsonNode } from '../types';

const STORAGE_KEY = 'json_tree_expansion_preference';

export function useJsonUiState(nodes: JsonNode[]) {
    // Helper to get all keys with children
    const getAllExpandableKeys = useCallback((list: JsonNode[]): Set<string> => {
        const keys = new Set<string>();
        const traverse = (items: JsonNode[], prefix = '') => {
            items.forEach(n => {
                const currentPath = prefix ? `${prefix}>${n.key}` : n.key;
                if (n.children && n.children.length > 0) {
                    keys.add(currentPath);
                    traverse(n.children, currentPath);
                }
            });
        };
        traverse(list);
        return keys;
    }, []);

    // Load initial preference or default to 'expanded'
    const [expansionMode, setExpansionMode] = useState<'expanded' | 'collapsed'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY);
            return (saved === 'collapsed') ? 'collapsed' : 'expanded';
        }
        return 'expanded';
    });

    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
    const [isAddKeyModalOpen, setIsAddKeyModalOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ node: JsonNode, parentPath: string } | null>(null);

    // Synchronize expandedKeys when nodes change or expansionMode changes
    useEffect(() => {
        if (!nodes || nodes.length === 0) return;

        if (expansionMode === 'expanded') {
            setExpandedKeys(getAllExpandableKeys(nodes));
        } else {
            setExpandedKeys(new Set());
        }
    }, [nodes, expansionMode, getAllExpandableKeys]);

    const toggleExpand = (key: string) => {
        const newSet = new Set(expandedKeys);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        setExpandedKeys(newSet);

        // Note: Toggling individual nodes doesn't change the "Global" preference 
        // as per user request which specifically mentioned Expand All or Collapse All buttons.
    };

    const expandAll = () => {
        const allKeys = getAllExpandableKeys(nodes);
        setExpandedKeys(allKeys);
        setExpansionMode('expanded');
        localStorage.setItem(STORAGE_KEY, 'expanded');
    };

    const collapseAll = () => {
        setExpandedKeys(new Set());
        setExpansionMode('collapsed');
        localStorage.setItem(STORAGE_KEY, 'collapsed');
    };

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
