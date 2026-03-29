import { DEFAULT_BACKEND_URL } from '@/config/editorConfig';

let _backendUrl = DEFAULT_BACKEND_URL;

export function setBackendUrl(url: string) {
    _backendUrl = url;
}

function getApiBaseUrl() {
    return `${_backendUrl}/api/files`;
}

export interface FileInfo {
    name: string;
    is_dir: boolean;
    path: string;
    size?: number;
    mtime?: number;
}

export const api = {
    listFiles: async (path: string = '/'): Promise<FileInfo[]> => {
        const res = await fetch(`${getApiBaseUrl()}?path=${encodeURIComponent(path)}&t=${Date.now()}`);
        if (!res.ok) throw new Error('Failed to fetch files');
        return res.json();
    },

    createFolder: async (path: string, name: string) => {
        const res = await fetch(`${getApiBaseUrl()}/folder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, name }),
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || 'Failed to create folder');
        }
        return res.json();
    },

    createFile: async (path: string, content: string) => {
        const res = await fetch(`${getApiBaseUrl()}/file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content }),
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || 'Failed to save file');
        }
        return res.json();
    },

    deleteItem: async (path: string) => {
        const res = await fetch(`${getApiBaseUrl()}?path=${encodeURIComponent(path)}`, {
            method: 'DELETE',
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || 'Failed to delete item');
        }
        return res.json();
    },

    getFileContent: async (path: string): Promise<{ content: string }> => {
        const res = await fetch(`${getApiBaseUrl()}/content?path=${encodeURIComponent(path)}&t=${Date.now()}`);
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || 'Failed to read file');
        }
        return res.json();
    },

    renameItem: async (path: string, newName: string) => {
        const res = await fetch(`${getApiBaseUrl()}/rename`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, new_name: newName }),
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || 'Failed to rename item');
        }
        return res.json();
    },
};
