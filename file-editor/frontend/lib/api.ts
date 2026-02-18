const API_BASE_URL = 'http://localhost:8000/api/files';

export interface FileInfo {
    name: string;
    is_dir: boolean;
    path: string;
    size?: number;
    mtime?: number;
}

export const api = {
    listFiles: async (path: string = '/'): Promise<FileInfo[]> => {
        const res = await fetch(`${API_BASE_URL}?path=${encodeURIComponent(path)}`);
        if (!res.ok) throw new Error('Failed to fetch files');
        return res.json();
    },

    createFolder: async (path: string, name: string) => {
        const res = await fetch(`${API_BASE_URL}/folder`, {
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
        const res = await fetch(`${API_BASE_URL}/file`, {
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
        const res = await fetch(`${API_BASE_URL}?path=${encodeURIComponent(path)}`, {
            method: 'DELETE',
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || 'Failed to delete item');
        }
        return res.json();
    },

    getFileContent: async (path: string): Promise<{ content: string }> => {
        const res = await fetch(`${API_BASE_URL}/content?path=${encodeURIComponent(path)}`);
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || 'Failed to read file');
        }
        return res.json();
    },

    renameItem: async (path: string, newName: string) => {
        const res = await fetch(`${API_BASE_URL}/rename`, {
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
