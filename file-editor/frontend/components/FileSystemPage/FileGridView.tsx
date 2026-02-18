import { FileInfo } from '@/lib/api';
import { Folder, FileText, Pencil, Trash2 } from 'lucide-react';

interface FileGridViewProps {
    files: FileInfo[];
    handleFolderClick: (folder: FileInfo) => void;
    handleFileClick: (file: FileInfo) => void;
    handleRenameClick: (file: FileInfo) => void;
    handleDeleteClick: (file: FileInfo) => void;
}

export default function FileGridView({
    files,
    handleFolderClick,
    handleFileClick,
    handleRenameClick,
    handleDeleteClick
}: FileGridViewProps) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {files.map(file => (
                <div
                    key={file.name}
                    className="group relative flex flex-col p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-sm cursor-pointer transition-all duration-200 select-none items-center text-center"
                    onClick={() => file.is_dir ? handleFolderClick(file) : handleFileClick(file)}
                >
                    <div className="flex w-full items-start justify-between absolute top-2 px-2 opacity-40 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleRenameClick(file); }}
                            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(file); }}
                            className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-zinc-400 hover:text-red-500"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className={`mt-2 mb-3 ${file.is_dir ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-800 dark:text-zinc-200"}`}>
                        {file.is_dir ? <Folder className="w-10 h-10 fill-zinc-50 dark:fill-zinc-800 stroke-1" /> : <FileText className="w-10 h-10 stroke-1" />}
                    </div>

                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate w-full tracking-tight px-1">{file.name}</span>
                </div>
            ))}
        </div>
    );
}
