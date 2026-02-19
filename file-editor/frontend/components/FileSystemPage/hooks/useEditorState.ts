import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface FileContentState {
    path: string;
    content: string;
}

export function useEditorState(
    currentPath: string,
    isFilePath: (path: string) => boolean | null,
    navigateTo: (path: string) => void
) {
    const [editingFile, setEditingFile] = useState<FileContentState | null>(null);
    const [viewingJson, setViewingJson] = useState<FileContentState | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    // We need to trigger loading state in useFileSystem, OR handle it here. 
    // Actually, loading state for FILE opening is specific to editor.
    const [editorLoading, setEditorLoading] = useState(false);
    const [editorError, setEditorError] = useState<string | null>(null);

    // Effect to load file content when path changes and it is a file
    useEffect(() => {
        if (isFilePath(currentPath)) {
            loadContent(currentPath);
        } else {
            setViewingJson(null);
            setEditingFile(null);
            setEditorError(null);
        }
    }, [currentPath]);

    const loadContent = async (path: string) => {
        try {
            setEditorLoading(true);
            setEditorError(null);
            const data = await api.getFileContent(path);

            if (path.endsWith('.yml.json') || path.endsWith('.ini.json')) {
                setViewingJson({ path, content: data.content });
                setEditingFile(null);
            } else {
                setEditingFile({ path, content: data.content });
                setViewingJson(null);
            }
        } catch (e: any) {
            console.error("Failed to open file:", e);
            if (e.message.includes('404') || e.message.includes('No such file')) {
                setEditorError('404 - Not Found'); // Simplified error handling for now, or bubble up
            } else {
                setEditorError(`Failed to open file: ${e.message}`);
            }
            setViewingJson(null);
            setEditingFile(null);
        } finally {
            setEditorLoading(false);
        }
    };

    const handleSaveFile = async (refreshFileSystem: () => void) => {
        if (!editingFile) return;
        try {
            let contentToSave = editingFile.content;
            // Auto-format JSON if standard json file
            if (editingFile.path.endsWith('.json') && !editingFile.path.endsWith('.yml.json')) {
                try {
                    const parsed = JSON.parse(contentToSave);
                    contentToSave = JSON.stringify(parsed, null, 4);
                } catch (e) {
                    // Ignore format errors
                }
            }

            await api.createFile(editingFile.path, contentToSave);
            setToast({ message: 'Saved successfully!', type: 'success' });

            // Update state
            setEditingFile({ ...editingFile, content: contentToSave });
            refreshFileSystem();
        } catch (err: any) {
            setToast({ message: `Failed to save: ${err.message}`, type: 'error' });
        }
    };

    const handleCloseEditor = () => {
        // Navigate "up" to parent folder
        if (editingFile) {
            const parent = editingFile.path.substring(0, editingFile.path.lastIndexOf('/')) || '/';
            navigateTo(parent);
        }
    };

    return {
        editingFile,
        setEditingFile,
        viewingJson,
        setViewingJson,
        toast,
        setToast,
        editorLoading,
        editorError,
        handleSaveFile,
        handleCloseEditor,
        refreshEditor: () => {
            if (isFilePath(currentPath)) {
                loadContent(currentPath);
            }
        }
    };
}
