'use client';

import { useEffect } from 'react';
import { AlertTriangle, Folder, Save, FileText } from 'lucide-react';

// Components
import JsonTreeViewer from '@/components/JsonTreeViewerPage/JsonTreeViewer';
import KeyEditor from '@/components/KeyEditorPage/KeyEditor';
import CodeEditor from '@/components/CodeEditorPage/CodeEditor';
import Toast from '@/components/ui/Toast';

// FileSystem Page Components
import FileSystemHeader from '@/components/FileSystemPage/FileSystemHeader';
import FileSystemToolbar from '@/components/FileSystemPage/FileSystemToolbar';
import FileGridView from '@/components/FileSystemPage/FileGridView';
import FileListView from '@/components/FileSystemPage/FileListView';
import FileModals from '@/components/FileSystemPage/FileModals';

// Custom Hooks
import { useTheme } from '@/components/FileSystemPage/hooks/useTheme';
import { useFileNavigation } from '@/components/FileSystemPage/hooks/useFileNavigation';
import { useViewSettings } from '@/components/FileSystemPage/hooks/useViewSettings';
import { useFileSystem } from '@/components/FileSystemPage/hooks/useFileSystem';
import { useEditorState } from '@/components/FileSystemPage/hooks/useEditorState';
import { useFileModals } from '@/components/FileSystemPage/hooks/useFileModals';

export default function FileExplorer() {
  // 1. Navigation & Theme
  const { currentPath, currentKey, activeFolderPath, navigateTo, navigateUp, isFilePath } = useFileNavigation();
  const { darkMode, toggleDarkMode } = useTheme();

  // 2. View Settings
  const {
    viewMode, setViewMode,
    searchQuery, setSearchQuery,
    sortField, setSortField,
    sortOrder, setSortOrder
  } = useViewSettings();

  // 3. File System Data
  const {
    files, processedFiles, loading, error, is404, setIs404, fetchFiles, refresh
  } = useFileSystem(activeFolderPath, searchQuery, sortField, sortOrder);

  // 4. Editor State & Actions
  const {
    editingFile, setEditingFile,
    viewingJson, setViewingJson,
    toast, setToast,
    editorLoading, editorError,
    handleSaveFile, handleCloseEditor, refreshEditor
  } = useEditorState(currentPath, isFilePath, navigateTo);

  // 5. Modals & File Actions
  const {
    isFolderModalOpen, setIsFolderModalOpen,
    isFileModalOpen, setIsFileModalOpen,
    newItemName, setNewItemName,
    deletingItem, setDeletingItem,
    renamingItem, setRenamingItem,
    renameValue, setRenameValue,
    handleCreateFolder, handleCreateFile, confirmDelete, handleRename, handleRenameClick
  } = useFileModals(activeFolderPath, refresh);

  // Sync Data
  useEffect(() => {
    // Only fetch files if we are not 404'd already (or retry logic needed?)
    // Actually simpler to just fetch.
    if (!isFilePath(currentPath)) {
      fetchFiles(activeFolderPath);
    }
  }, [activeFolderPath, currentPath]); // Trigger on path change

  // Sync Editor Errors to global 404 (if editor fails with 404)
  useEffect(() => {
    if (editorError && editorError.includes('404')) {
      setIs404(true);
    }
  }, [editorError]);


  // Handler wrappers for Grid/List views
  const handleFolderClick = (folder: any) => {
    const newPath = activeFolderPath === '/' ? `/${folder.name}` : `${activeFolderPath}/${folder.name}`;
    navigateTo(newPath);
  };

  const handleFileClick = (file: any) => {
    const filePath = activeFolderPath === '/' ? `/${file.name}` : `${activeFolderPath}/${file.name}`;
    navigateTo(filePath);
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-200">

      <FileSystemHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        onNewFolder={() => setIsFolderModalOpen(true)}
        onNewFile={() => setIsFileModalOpen(true)}
      />

      <FileSystemToolbar
        currentPath={currentPath}
        navigateTo={navigateTo}
        navigateUp={navigateUp}
        sortField={sortField}
        setSortField={setSortField}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

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
              <FileGridView
                files={processedFiles}
                handleFolderClick={handleFolderClick}
                handleFileClick={handleFileClick}
                handleRenameClick={handleRenameClick}
                handleDeleteClick={(item) => setDeletingItem(item)}
              />
            ) : (
              <FileListView
                files={processedFiles}
                sortField={sortField}
                setSortField={setSortField}
                sortOrder={sortOrder}
                handleFolderClick={handleFolderClick}
                handleFileClick={handleFileClick}
                handleRenameClick={handleRenameClick}
                handleDeleteClick={(item) => setDeletingItem(item)}
              />
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
                  onClick={() => handleSaveFile(refresh)} // Pass refresh to handler
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
              // Reload content and navigate back
              refreshEditor();
              navigateTo(viewingJson.path);
            }} />
        </div>
      )}

      <FileModals
        isFolderModalOpen={isFolderModalOpen}
        setIsFolderModalOpen={setIsFolderModalOpen}
        isFileModalOpen={isFileModalOpen}
        setIsFileModalOpen={setIsFileModalOpen}
        newItemName={newItemName}
        setNewItemName={setNewItemName}
        handleCreateFolder={handleCreateFolder}
        handleCreateFile={handleCreateFile}
        deletingItem={deletingItem}
        setDeletingItem={setDeletingItem}
        confirmDelete={confirmDelete}
        renamingItem={renamingItem}
        setRenamingItem={setRenamingItem}
        renameValue={renameValue}
        setRenameValue={setRenameValue}
        handleRename={handleRename}
      />

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
