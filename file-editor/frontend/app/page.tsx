'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, FileInfo } from '@/lib/api';
import {
  Folder, FileText, ChevronRight, Plus, Trash2, Save,
  Search, Grid, List, ArrowUpDown, LayoutGrid, Moon, Sun, Monitor
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import clsx from 'clsx';

type ViewMode = 'grid' | 'list';
type SortField = 'name' | 'mtime' | 'size';
type SortOrder = 'asc' | 'desc';

export default function FileExplorer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPath = searchParams.get('path') || '/';

  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [darkMode, setDarkMode] = useState(false);

  // Modals state
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');

  // Delete state
  const [deletingItem, setDeletingItem] = useState<FileInfo | null>(null);

  // Editor state
  const [editingFile, setEditingFile] = useState<{ path: string; content: string } | null>(null);

  useEffect(() => {
    // Initial fetch
    fetchFiles(currentPath);

    // Check system preference for dark mode initially
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    fetchFiles(currentPath);
  }, [currentPath]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const fetchFiles = async (path: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listFiles(path);
      setFiles(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const navigateTo = (path: string) => {
    router.push(`?path=${encodeURIComponent(path)}`);
    setSearchQuery('');
  };

  const handleFolderClick = (folder: FileInfo) => {
    const newPath = currentPath === '/' ? `/${folder.name}` : `${currentPath}/${folder.name}`;
    navigateTo(newPath);
  };

  const handleFileClick = async (file: FileInfo) => {
    try {
      const filePath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
      const data = await api.getFileContent(filePath);
      setEditingFile({ path: filePath, content: data.content });
    } catch (err: any) {
      alert(`Failed to open file: ${err.message}`);
    }
  };

  const handleCreateFolder = async () => {
    if (!newItemName) return;
    try {
      await api.createFolder(currentPath, newItemName);
      setIsFolderModalOpen(false);
      setNewItemName('');
      fetchFiles(currentPath);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateFile = async () => {
    if (!newItemName) return;
    try {
      const filePath = currentPath === '/' ? `/${newItemName}` : `${currentPath}/${newItemName}`;
      await api.createFile(filePath, '');
      setIsFileModalOpen(false);
      setNewItemName('');
      fetchFiles(currentPath);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteClick = (item: FileInfo) => {
    setDeletingItem(item);
  };

  const confirmDelete = async () => {
    if (!deletingItem) return;
    try {
      const itemPath = currentPath === '/' ? `/${deletingItem.name}` : `${currentPath}/${deletingItem.name}`;
      await api.deleteItem(itemPath);
      setDeletingItem(null);
      fetchFiles(currentPath);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveFile = async () => {
    if (!editingFile) return;
    try {
      await api.createFile(editingFile.path, editingFile.content);
      alert('Saved!');
      fetchFiles(currentPath);
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    }
  };

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

  const breadcrumbs = currentPath.split('/').filter(Boolean);

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
    <div className="flex flex-col h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-200">

      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
            <Monitor className="w-5 h-5" />
          </div>
          <span className="font-semibold text-lg tracking-tight">File Editor</span>
        </div>

        {/* Search Bar - Center */}
        <div className="flex-1 max-w-xl mx-6">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-600 dark:group-focus-within:text-zinc-200 transition-colors" />
            <input
              type="text"
              placeholder="Search files..."
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-zinc-700 transition"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Actions - Right */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsFolderModalOpen(true)}
            className="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-300"
            title="New Folder"
          >
            <Folder className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsFileModalOpen(true)}
            className="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-300"
            title="New File"
          >
            <Plus className="w-5 h-5" />
          </button>
          <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-800 mx-1"></div>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-300"
            title="Toggle Theme"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Toolbar & Breadcrumbs */}
      <div className="h-12 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-sm">
        <div className="flex items-center text-sm text-zinc-500 dark:text-zinc-400 overflow-hidden">
          <button onClick={() => navigateTo('/')} className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors px-1 rounded">Home</button>
          {breadcrumbs.map((segment, index) => (
            <div key={index} className="flex items-center">
              <ChevronRight className="w-3 h-3 mx-1 text-zinc-300 dark:text-zinc-600" />
              <button onClick={() => navigateTo('/' + breadcrumbs.slice(0, index + 1).join('/'))} className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors px-1 rounded font-medium">{segment}</button>
            </div>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          {/* Sort Toggle */}
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-1.5 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 rounded-md text-zinc-500 transition-colors"
            title="Sort Order"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>

          {/* View Toggle */}
          <div className="flex items-center bg-zinc-200/50 dark:bg-zinc-800 rounded-md p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={clsx("p-1.5 rounded-sm transition-all", viewMode === 'list' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-400 hover:text-zinc-600")}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={clsx("p-1.5 rounded-sm transition-all", viewMode === 'grid' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-400 hover:text-zinc-600")}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main View */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex justify-center mt-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-zinc-900 dark:border-zinc-100"></div>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-lg border border-red-100 dark:border-red-900/20">
            Error: {error}
          </div>
        ) : processedFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-24 text-zinc-300 dark:text-zinc-700">
            <Folder className="w-16 h-16 mb-4 stroke-1" />
            <p className="text-sm">Empty directory</p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {processedFiles.map(file => (
              <div
                key={file.name}
                className="group relative flex flex-col p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-sm cursor-pointer transition-all duration-200 select-none"
                onClick={() => file.is_dir ? handleFolderClick(file) : handleFileClick(file)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={file.is_dir ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-800 dark:text-zinc-200"}>
                    {file.is_dir ? <Folder className="w-8 h-8 fill-zinc-100 dark:fill-zinc-800 stroke-1" /> : <FileText className="w-8 h-8 stroke-1" />}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteClick(file); }}
                    className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate tracking-tight">{file.name}</span>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
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
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {processedFiles.map(file => (
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
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteClick(file); }}
                        className="text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {editingFile && (
        <div className="fixed inset-0 z-50 flex flex-col animate-in slide-in-from-bottom duration-300">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm" onClick={() => setEditingFile(null)} />

          {/* Content */}
          <div className="relative flex-1 m-4 md:m-12 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col">
            <div className="border-b border-zinc-100 dark:border-zinc-800 px-6 py-4 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-zinc-400" />
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{editingFile.path.split('/').pop()}</span>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setEditingFile(null)}
                  className="px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg transition text-sm font-medium"
                >
                  Close
                </button>
                <button
                  onClick={handleSaveFile}
                  className="flex items-center px-4 py-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-lg shadow-sm transition text-sm font-medium"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </button>
              </div>
            </div>
            <div className="flex-1 p-0 overflow-hidden relative">
              <textarea
                className="absolute inset-0 w-full h-full p-8 font-mono text-sm bg-transparent border-none focus:ring-0 resize-none outline-none leading-relaxed text-zinc-800 dark:text-zinc-300"
                value={editingFile.content}
                onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <Modal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        title="New Folder"
      >
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
            <button
              onClick={() => setIsFolderModalOpen(false)}
              className="px-4 py-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateFolder}
              className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:opacity-90 font-medium transition"
            >
              Create
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isFileModalOpen}
        onClose={() => setIsFileModalOpen(false)}
        title="New File"
      >
        <div className="flex flex-col space-y-4">
          <input
            type="text"
            placeholder="File Name (e.g., notes.txt)"
            className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-zinc-500 outline-none transition"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            autoFocus
          />
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setIsFileModalOpen(false)}
              className="px-4 py-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateFile}
              className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:opacity-90 font-medium transition"
            >
              Create
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        title="Delete Item"
      >
        <div className="flex flex-col space-y-4">
          <p className="text-zinc-600 dark:text-zinc-300">
            Are you sure you want to delete <span className="font-semibold">{deletingItem?.name}</span>? This action cannot be undone.
          </p>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setDeletingItem(null)}
              className="px-4 py-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
