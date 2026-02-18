import { useState } from 'react';

export type ViewMode = 'grid' | 'list';
export type SortField = 'name' | 'mtime' | 'size';
export type SortOrder = 'asc' | 'desc';

export function useViewSettings() {
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<SortField>('name');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

    return {
        viewMode,
        setViewMode,
        searchQuery,
        setSearchQuery,
        sortField,
        setSortField,
        sortOrder,
        setSortOrder
    };
}
