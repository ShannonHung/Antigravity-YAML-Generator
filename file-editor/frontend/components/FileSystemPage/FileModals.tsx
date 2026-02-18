import { Modal } from '@/components/ui/modal';
import { FileInfo } from '@/lib/api';

interface FileModalsProps {
    isFolderModalOpen: boolean;
    setIsFolderModalOpen: (open: boolean) => void;
    isFileModalOpen: boolean;
    setIsFileModalOpen: (open: boolean) => void;
    newItemName: string;
    setNewItemName: (name: string) => void;
    handleCreateFolder: () => void;
    handleCreateFile: () => void;
    deletingItem: FileInfo | null;
    setDeletingItem: (item: FileInfo | null) => void;
    confirmDelete: () => void;
    renamingItem: FileInfo | null;
    setRenamingItem: (item: FileInfo | null) => void;
    renameValue: string;
    setRenameValue: (name: string) => void;
    handleRename: () => void;
}

export default function FileModals({
    isFolderModalOpen,
    setIsFolderModalOpen,
    isFileModalOpen,
    setIsFileModalOpen,
    newItemName,
    setNewItemName,
    handleCreateFolder,
    handleCreateFile,
    deletingItem,
    setDeletingItem,
    confirmDelete,
    renamingItem,
    setRenamingItem,
    renameValue,
    setRenameValue,
    handleRename
}: FileModalsProps) {
    return (
        <>
            <Modal isOpen={isFolderModalOpen} onClose={() => setIsFolderModalOpen(false)} title="New Folder">
                <div className="flex flex-col space-y-4">
                    <input
                        type="text"
                        placeholder="Folder Name"
                        className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-zinc-500 outline-none transition"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        autoFocus
                    />
                    <div className="flex justify-end space-x-2">
                        <button onClick={() => setIsFolderModalOpen(false)} className="px-4 py-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition">Cancel</button>
                        <button onClick={handleCreateFolder} className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:opacity-90 font-medium transition">Create</button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isFileModalOpen} onClose={() => setIsFileModalOpen(false)} title="New File">
                <div className="flex flex-col space-y-4">
                    <input
                        type="text"
                        placeholder="File Name (e.g., notes.txt)"
                        className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-zinc-500 outline-none transition"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
                    />
                    <div className="flex justify-end space-x-2">
                        <button onClick={() => setIsFileModalOpen(false)} className="px-4 py-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition">Cancel</button>
                        <button onClick={handleCreateFile} className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:opacity-90 font-medium transition">Create</button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={!!deletingItem} onClose={() => setDeletingItem(null)} title="Delete Item">
                <div className="flex flex-col space-y-4">
                    <p className="text-zinc-600 dark:text-zinc-300">
                        Are you sure you want to delete <span className="font-semibold">{deletingItem?.name}</span>? This action cannot be undone.
                    </p>
                    <div className="flex justify-end space-x-2">
                        <button onClick={() => setDeletingItem(null)} className="px-4 py-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition">Cancel</button>
                        <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition">Delete</button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={!!renamingItem} onClose={() => setRenamingItem(null)} title="Rename Item">
                <div className="flex flex-col space-y-4">
                    <input
                        type="text"
                        className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-zinc-500 outline-none transition"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                    />
                    <div className="flex justify-end space-x-2">
                        <button onClick={() => setRenamingItem(null)} className="px-4 py-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition">Cancel</button>
                        <button onClick={handleRename} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition">Rename</button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
