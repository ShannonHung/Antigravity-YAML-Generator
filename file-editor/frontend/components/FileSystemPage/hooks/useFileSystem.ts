import { useState, useMemo } from 'react';
import { api, FileInfo } from '@/lib/api';
import { SortField, SortOrder } from './useViewSettings';

export function useFileSystem(
    activeFolderPath: string,
    searchQuery: string,
    sortField: SortField,
    sortOrder: SortOrder
) {
    const [files, setFiles] = useState<FileInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [is404, setIs404] = useState(false);

    const fetchFiles = async (path: string) => {
        try {
            setLoading(true);
            setError(null);
            setIs404(false);
            const data = await api.listFiles(path);
            setFiles(data);
        } catch (err: any) {
            if (err.message.includes('No such file')) {
                setIs404(true);
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const refresh = () => fetchFiles(activeFolderPath);

    // Filter and Sort
    const processedFiles = useMemo(() => {
        let result = [...files];

        if (searchQuery) {
            result = result.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }

        result.sort((a, b) => {
            if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;

            let aValue: any = a[sortField];
            let bValue: any = b[sortField];
            if (aValue === undefined) aValue = '';
            if (bValue === undefined) bValue = '';

            if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [files, searchQuery, sortField, sortOrder]);

    return {
        files,
        processedFiles,
        loading,
        error,
        setError,
        is404, // Added is404 to return
        setIs404, // Added setIs404
        fetchFiles,
        refresh
    };
}
