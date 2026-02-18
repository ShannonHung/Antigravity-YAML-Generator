'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, FileInfo } from '@/lib/api';
import {
  Folder, FileText, ChevronRight, Plus, Trash2, Save,
  Search, List, LayoutGrid, Moon, Sun, Monitor, ArrowLeft, AlertTriangle, Edit2, Pencil, ArrowUpDown
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import clsx from 'clsx';
import JsonTreeViewer from '@/components/JsonTreeViewer';
import KeyEditor from '@/components/KeyEditor';
import CodeEditor from '@/components/CodeEditor';
import Toast from '@/components/ui/Toast';

type ViewMode = 'grid' | 'list';
type SortField = 'name' | 'mtime' | 'size';
type SortOrder = 'asc' | 'desc';

export default function FileExplorer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPath = searchParams.get('path') || '/';
  const currentKey = searchParams.get('key'); // For Key Editor

  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>('list'); // Default to list
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

  // Rename state
  const [renamingItem, setRenamingItem] = useState<FileInfo | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Editor state
  const [editingFile, setEditingFile] = useState<{ path: string; content: string } | null>(null);
  const [viewingJson, setViewingJson] = useState<{ path: string; content: string } | null>(null);

  // 404 State
  const [is404, setIs404] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Derived state for what folder content to show
  const isFilePath = (path: string) => {
    const name = path.split('/').pop();
    return name && name.includes('.') && !path.endsWith('/');
  };

  const activeFolderPath = isFilePath(currentPath)
    ? (currentPath.substring(0, currentPath.lastIndexOf('/')) || '/')
    : currentPath;

  useEffect(() => {
    handlePathChange(currentPath);

    // Check system preference for dark mode initially
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    handlePathChange(currentPath);
  }, [currentPath, currentKey]); // Added currentKey dependency to refresh when closing editor

  const handlePathChange = async (path: string) => {
    const isFile = isFilePath(path);
    const folderPath = isFile ? (path.substring(0, path.lastIndexOf('/')) || '/') : path;

    // Reset States
    setError(null);
    setIs404(false);

    // Always fetch folder content for background or list
    fetchFiles(folderPath);

    if (isFile) {
      try {
        setLoading(true);
        // It's a file, try to open it
        const data = await api.getFileContent(path);
        if (path.endsWith('.yml.json')) {
          setViewingJson({ path, content: data.content });
          setEditingFile(null);
        } else {
          setEditingFile({ path, content: data.content });
          setViewingJson(null);
        }
      } catch (e: any) {
        console.error("Failed to open file:", e);
        if (e.message.includes('404') || e.message.includes('No such file')) {
          setIs404(true);
        } else {
          setError(`Failed to open file: ${e.message}`);
        }
        setViewingJson(null);
        setEditingFile(null);
      } finally {
        setLoading(false);
      }
    } else {
      // It's a folder, ensure modals are closed
      setViewingJson(null);
      setEditingFile(null);
    }
  };

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
      const data = await api.listFiles(path);
      setFiles(data);
    } catch (err: any) {
      // If folder read fails, it might be 404 or perm
      if (err.message.includes('No such file')) {
        setIs404(true);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const navigateTo = (path: string, key?: string) => {
    let url = `?path=${encodeURIComponent(path)}`;
    if (key) url += `&key=${encodeURIComponent(key)}`;
    router.push(url);
    setSearchQuery('');
  };

  const navigateUp = () => {
    const current = currentPath;
    if (current === '/') return;
    const parent = current.substring(0, current.lastIndexOf('/')) || '/';
    navigateTo(parent);
  };

  const handleFolderClick = (folder: FileInfo) => {
    const newPath = activeFolderPath === '/' ? `/${folder.name}` : `${activeFolderPath}/${folder.name}`;
    navigateTo(newPath);
  };

  const handleFileClick = async (file: FileInfo) => {
    const filePath = activeFolderPath === '/' ? `/${file.name}` : `${activeFolderPath}/${file.name}`;
    navigateTo(filePath);
  };

  const handleCreateFolder = async () => {
    if (!newItemName) return;
    try {
      await api.createFolder(activeFolderPath, newItemName);
      setIsFolderModalOpen(false);
      setNewItemName('');
      fetchFiles(activeFolderPath);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateFile = async () => {
    if (!newItemName) return;
    try {
      const filePath = activeFolderPath === '/' ? `/${newItemName}` : `${activeFolderPath}/${newItemName}`;
      await api.createFile(filePath, '');
      setIsFileModalOpen(false);
      setNewItemName('');
      fetchFiles(activeFolderPath);
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
      const itemPath = activeFolderPath === '/' ? `/${deletingItem.name}` : `${activeFolderPath}/${deletingItem.name}`;
      await api.deleteItem(itemPath);
      setDeletingItem(null);
      fetchFiles(activeFolderPath);
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
      fetchFiles(activeFolderPath);
    } catch (err: any) {
      alert('Rename failed: ' + err.message);
    }
  };

  const handleSaveFile = async () => {
    if (!editingFile) return;
    try {
      let contentToSave = editingFile.content;
      // Auto-format JSON if standard json file
      if (editingFile.path.endsWith('.json') && !editingFile.path.endsWith('.yml.json')) {
        try {
          const parsed = JSON.parse(contentToSave);
          contentToSave = JSON.stringify(parsed, null, 4);
        } catch (e) {
          // Ignore format errors, just save as is
        }
      }

      await api.createFile(editingFile.path, contentToSave);
      setToast({ message: 'Saved successfully!', type: 'success' });

      // Update local state to show formatted content immediately
      setEditingFile({ ...editingFile, content: contentToSave });
      fetchFiles(activeFolderPath);
    } catch (err: any) {
      setToast({ message: `Failed to save: ${err.message}`, type: 'error' });
    }
  };

  const handleCloseEditor = () => {
    // Navigate "up" to parent folder
    const parent = editingFile?.path.substring(0, editingFile.path.lastIndexOf('/')) || '/';
    navigateTo(parent);
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

  const breadcrumbs = activeFolderPath.split('/').filter(Boolean);

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
          <button
            onClick={navigateUp}
            className="mr-2 p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
            title="Go Back"
          >
            <ArrowLeft className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
          </button>
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

      {/* Main View + Error Handling */}
      <div className="flex-1 overflow-y-auto p-6 relative">

        {/* 404 / Error State */}
        {is404 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-400 dark:text-zinc-600 animate-in fade-in zoom-in-95">
            <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-10 h-10 text-zinc-400" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-200 mb-2">404 - Not Found</h2>
            <p className="max-w-md text-center mb-8">
              The requested path <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{currentPath}</span> could not be found.
              It may have been moved or deleted.
            </p>
            <button onClick={() => navigateTo('/')} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium transition-colors">
              Go to Home
            </button>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-lg border border-red-100 dark:border-red-900/20 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0" />
            {error}
          </div>
        ) : (
          <>
            {processedFiles.length === 0 && !loading ? (
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
                      <th className="px-4 py-3 w-24 text-right">Actions</th>
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
            )}
          </>
        )}
      </div>

      {/* Editor Modal */}
      {editingFile && (
        <div className="fixed inset-0 z-50 flex flex-col animate-in slide-in-from-bottom duration-300">
          <div className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm" onClick={handleCloseEditor} />
          <div className="relative flex-1 m-4 md:m-12 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col">
            <div className="border-b border-zinc-100 dark:border-zinc-800 px-6 py-4 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-zinc-400" />
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{editingFile.path.split('/').pop()}</span>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleCloseEditor}
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
            <div className="flex-1 p-0 overflow-hidden relative bg-white dark:bg-zinc-950">
              {editingFile.path.endsWith('.json') ? (
                <CodeEditor
                  content={editingFile.content}
                  filePath={editingFile.path}
                  onChange={(newContent) => setEditingFile({ ...editingFile, content: newContent })}
                />
              ) : (
                <textarea
                  className="absolute inset-0 w-full h-full p-8 font-mono text-sm bg-transparent border-none focus:ring-0 resize-none outline-none leading-relaxed text-zinc-800 dark:text-zinc-300"
                  value={editingFile.content}
                  onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
                  spellCheck={false}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* JSON Tree Viewer */}
      {viewingJson && !currentKey && (
        <JsonTreeViewer
          content={viewingJson.content}
          fileName={viewingJson.path.split('/').pop() || ''}
          filePath={viewingJson.path}
          onClose={() => {
            const parent = viewingJson.path.substring(0, viewingJson.path.lastIndexOf('/')) || '/';
            navigateTo(parent);
          }}
          onBack={() => {
            const parent = viewingJson.path.substring(0, viewingJson.path.lastIndexOf('/')) || '/';
            navigateTo(parent);
          }}
          onHome={() => navigateTo('/')}
          onEditKey={(key) => {
            // Deep link to key editor
            navigateTo(viewingJson.path, key);
          }}
        />
      )}

      {/* Key Editor (Overlay on top of or replacing viewer) */}
      {viewingJson && currentKey && (
        <div className="fixed inset-0 z-[60] bg-white dark:bg-zinc-950">
          <KeyEditor
            filePath={viewingJson.path}
            targetKey={currentKey}
            onClose={() => {
              navigateTo(viewingJson.path);
              // handlePathChange will be triggered by useEffect when key param is removed
            }}
            onSave={() => {
              // Reload content by navigating successfully back
              navigateTo(viewingJson.path);
            }} />
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
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
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

      {/* Rename Modal */}
      <Modal
        isOpen={!!renamingItem}
        onClose={() => setRenamingItem(null)}
        title="Rename Item"
      >
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
            <button
              onClick={() => setRenamingItem(null)}
              className="px-4 py-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleRename}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
            >
              Rename
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
