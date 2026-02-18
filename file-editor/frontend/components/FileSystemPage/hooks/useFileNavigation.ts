import { useSearchParams, useRouter } from 'next/navigation';

export function useFileNavigation() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentPath = searchParams.get('path') || '/';
    const currentKey = searchParams.get('key'); // For Key Editor

    // Helper to determine if path is file or folder
    const isFilePath = (path: string) => {
        const name = path.split('/').pop();
        return !!(name && name.includes('.') && !path.endsWith('/'));
    };

    const activeFolderPath = isFilePath(currentPath)
        ? (currentPath.substring(0, currentPath.lastIndexOf('/')) || '/')
        : currentPath;

    const navigateTo = (path: string, key?: string) => {
        let url = `?path=${encodeURIComponent(path)}`;
        if (key) url += `&key=${encodeURIComponent(key)}`;
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
