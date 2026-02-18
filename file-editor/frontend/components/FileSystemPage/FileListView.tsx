import { FileInfo } from '@/lib/api';
import { Folder, FileText, Pencil, Trash2 } from 'lucide-react';

interface FileListViewProps {
    files: FileInfo[];
    sortField: 'name' | 'mtime' | 'size';
    setSortField: (field: 'name' | 'mtime' | 'size') => void;
    sortOrder: 'asc' | 'desc';
    handleFolderClick: (folder: FileInfo) => void;
    handleFileClick: (file: FileInfo) => void;
    handleRenameClick: (file: FileInfo) => void;
    handleDeleteClick: (file: FileInfo) => void;
}

export default function FileListView({
    files,
    sortField,
    setSortField,
    sortOrder,
    handleFolderClick,
    handleFileClick,
    handleRenameClick,
    handleDeleteClick
}: FileListViewProps) {
    const formatSize = (bytes?: number) => {
        if (bytes === undefined || bytes === null) return '-';
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const formatDate = (ts?: number) => {
        if (ts === undefined || ts === null) return '-';
        return new Date(ts * 1000).toLocaleString();
    };

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 text-zinc-500 font-medium">
                    <tr>
                        <th className="px-4 py-3 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors" onClick={() => setSortField('name')}>
                            Name {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-4 py-3 w-48 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors" onClick={() => setSortField('mtime')}>
                            Modified {sortField === 'mtime' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-4 py-3 w-32 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors" onClick={() => setSortField('size')}>
                            Size {sortField === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-4 py-3 w-24 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {files.map(file => (
                        <tr
                            key={file.name}
                            className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 group cursor-pointer transition-colors"
                            onClick={() => file.is_dir ? handleFolderClick(file) : handleFileClick(file)}
                        >
                            <td className="px-4 py-3 flex items-center">
                                {file.is_dir ? <Folder className="w-4 h-4 text-zinc-400 mr-3" /> : <FileText className="w-4 h-4 text-zinc-500 mr-3" />}
                                <span className="font-medium text-zinc-700 dark:text-zinc-300">{file.name}</span>
                            </td>
                            <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{formatDate(file.mtime)}</td>
                            <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 font-mono text-xs">{formatSize(file.size)}</td>
                            <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end space-x-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRenameClick(file); }}
                                        className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                                        title="Rename"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteClick(file); }}
                                        className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
