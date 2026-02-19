import { useState } from 'react';
import { api, FileInfo } from '@/lib/api';

export function useFileModals(activeFolderPath: string, refresh: () => void) {
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [isFileModalOpen, setIsFileModalOpen] = useState(false);
    const [newItemName, setNewItemName] = useState('');

    const [deletingItem, setDeletingItem] = useState<FileInfo | null>(null);

    const [renamingItem, setRenamingItem] = useState<FileInfo | null>(null);
    const [renameValue, setRenameValue] = useState('');

    const handleCreateFolder = async () => {
        if (!newItemName) return;
        try {
            await api.createFolder(activeFolderPath, newItemName);
            setIsFolderModalOpen(false);
            setNewItemName('');
            refresh();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleCreateFile = async () => {
        if (!newItemName) return;
        try {
            const filePath = activeFolderPath === '/' ? `/${newItemName}` : `${activeFolderPath}/${newItemName}`;
            let content = '';
            if (newItemName.endsWith('.yml.json') || newItemName.endsWith('.ini.json')) {
                content = '[]';
            }
            await api.createFile(filePath, content);
            setIsFileModalOpen(false);
            setNewItemName('');
            refresh();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const confirmDelete = async () => {
        if (!deletingItem) return;
        try {
            const itemPath = activeFolderPath === '/' ? `/${deletingItem.name}` : `${activeFolderPath}/${deletingItem.name}`;
            await api.deleteItem(itemPath);
            setDeletingItem(null);
            refresh();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleRenameClick = (item: FileInfo) => {
        setRenamingItem(item);
        setRenameValue(item.name);
    };

    const handleRename = async () => {
        if (!renamingItem || !renameValue || renameValue === renamingItem.name) {
            setRenamingItem(null);
            return;
        }
        try {
            const itemPath = activeFolderPath === '/' ? `/${renamingItem.name}` : `${activeFolderPath}/${renamingItem.name}`;
            await api.renameItem(itemPath, renameValue);
            setRenamingItem(null);
            setRenameValue('');
            refresh();
        } catch (err: any) {
            alert('Rename failed: ' + err.message);
        }
    };

    return {
        isFolderModalOpen, setIsFolderModalOpen,
        isFileModalOpen, setIsFileModalOpen,
        newItemName, setNewItemName,
        deletingItem, setDeletingItem,
        renamingItem, setRenamingItem,
        renameValue, setRenameValue,
        handleCreateFolder,
        handleCreateFile,
        confirmDelete,
        handleRenameClick,
        handleRename
    };
}
