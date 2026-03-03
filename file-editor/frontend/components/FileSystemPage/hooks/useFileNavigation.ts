import { useSearchParams, useRouter } from 'next/navigation';

export function useFileNavigation() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentPath = searchParams.get('path') || '/';
    const currentKey = searchParams.get('key'); // For Key Editor

    // Helper to determine if path is file or folder
    // A path is a file if:
    //  1. The last segment contains a dot (has extension), OR
    //  2. The URL has isFile=1 (set explicitly when clicking a file without extension)
    const isFilePath = (path: string) => {
        if (searchParams.get('isFile') === '1') return true;
        const name = path.split('/').pop();
        return !!(name && name.includes('.') && !path.endsWith('/'));
    };

    const activeFolderPath = isFilePath(currentPath)
        ? (currentPath.substring(0, currentPath.lastIndexOf('/')) || '/')
        : currentPath;

    const navigateTo = (path: string, key?: string, isFile?: boolean) => {
        let url = `?path=${encodeURIComponent(path)}`;
        if (key) url += `&key=${encodeURIComponent(key)}`;
        if (isFile) url += `&isFile=1`;
        router.push(url);
    };

    const navigateUp = () => {
        const current = currentPath;
        if (current === '/') return;
        const parent = current.substring(0, current.lastIndexOf('/')) || '/';
        navigateTo(parent);
    };

    const breadcrumbs = activeFolderPath.split('/').filter(Boolean);

    return {
        currentPath,
        currentKey,
        activeFolderPath,
        breadcrumbs,
        navigateTo,
        navigateUp,
        isFilePath
    };
}
