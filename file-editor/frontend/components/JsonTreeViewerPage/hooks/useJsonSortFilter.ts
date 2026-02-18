import { useState, useMemo } from 'react';
import { JsonNode } from '../types';

export type SortField = 'key' | 'type' | 'required' | 'description';
export type SortOrder = 'asc' | 'desc';

export function useJsonSortFilter(nodes: JsonNode[]) {
    const [filterText, setFilterText] = useState('');
    const [sortField, setSortField] = useState<SortField>('key');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

    const filterNodesRecursive = (nodesList: JsonNode[], text: string): JsonNode[] => {
        let filtered = nodesList.reduce((acc: JsonNode[], node) => {
            const matchesKey = node.key.toLowerCase().includes(text.toLowerCase());
            const matchesDesc = node.description?.toLowerCase().includes(text.toLowerCase());
            let childrenMatches: JsonNode[] = [];
            if (node.children) {
                childrenMatches = filterNodesRecursive(node.children, text);
            }
            if (matchesKey || matchesDesc || childrenMatches.length > 0) {
                acc.push({ ...node, children: childrenMatches.length > 0 ? childrenMatches : (matchesKey || matchesDesc ? node.children : []) });
            }
            return acc;
        }, []);

        filtered.sort((a, b) => {
            let aVal: any = '', bVal: any = '';
            switch (sortField) {
                case 'key': aVal = a.key; bVal = b.key; break;
                case 'type': aVal = a.multi_type?.[0] || ''; bVal = b.multi_type?.[0] || ''; break;
                case 'required': aVal = a.required ? 1 : 0; bVal = b.required ? 1 : 0; break;
                case 'description': aVal = a.description || ''; bVal = b.description || ''; break;
            }
            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        return filtered;
    };

    const filteredNodes = useMemo(() => {
        const nodesCopy = JSON.parse(JSON.stringify(nodes));
        return filterNodesRecursive(nodesCopy, filterText);
    }, [nodes, filterText, sortField, sortOrder]);

    const handleSort = (field: SortField) => {
        if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortOrder('asc'); }
    };

    return {
        filterText, setFilterText,
        sortField, setSortField,
        sortOrder, setSortOrder,
        filteredNodes,
        handleSort
    };
}
