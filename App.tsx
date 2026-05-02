import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FileSystemItem, FileType, ViewMode, BreadcrumbItem, User } from './types';
import { authService } from './services/authService';
import { storageService } from './services/storageService';
import { AuthPage } from './components/AuthPage';
import { FriendManager, ShareModal } from './components/SocialModals';
import {
  FolderIcon, SharedFolderIcon, FileTextIcon, FileCodeIcon, ImageIcon,
  SearchIcon, GridIcon, ListIcon, StarIcon, UploadIcon, DownloadIcon,
  ChevronRightIcon, HomeIcon, PlusIcon, TrashIcon, XIcon, EditIcon, SaveIcon, LogOutIcon, UserIcon, UsersIcon, ShareIcon, BellIcon
} from './components/Icons';

// --- HELPERS ---
const parseSize = (sizeStr: string | undefined): number => {
  if (!sizeStr) return 0;
  // Handles formats like "1.5KB", "100B", "10 MB"
  const match = sizeStr.match(/^([\d.]+)\s*([a-zA-Z]+)$/);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers: {[key: string]: number} = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024
  };
  return value * (multipliers[unit] || 1);
};

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  // Limit index to avoid overflow if huge number
  const safeIndex = Math.min(i, sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, safeIndex)).toFixed(1)) + ' ' + sizes[safeIndex];
};

const MAX_QUOTA_BYTES = 50 * 1024 * 1024; // 50MB Dummy Quota

const App: React.FC = () => {
  // --- AUTH STATE ---
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // --- APP STATE ---
  const [files, setFiles] = useState<FileSystemItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // View Filters
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showSharedOnly, setShowSharedOnly] = useState(false);
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  // New File Form State
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState<FileType>(FileType.FOLDER);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      // Migration logic for demo: If global files empty, try to migrate old user files
      const globalFiles = storageService.getAllFiles();
      if (globalFiles.length === 0) {
         const oldFiles = localStorage.getItem(`gestio_files_${currentUser.id}`);
         if (oldFiles) {
             const parsed = JSON.parse(oldFiles).map((f: any) => ({
                 ...f,
                 ownerId: currentUser.id,
                 sharedWith: []
             }));
             storageService.saveAllFiles(parsed);
         }
      }
    }
    setIsInitializing(false);
  }, []);

  // Refresh files whenever user changes or we need to reload
  const refreshFiles = () => {
      if (user) {
          const userFiles = storageService.getUserFiles(user.id);
          setFiles(userFiles);
      }
  };

  useEffect(() => {
    refreshFiles();
    setCurrentFolderId(null);
    setSearchQuery('');
    setShowFavoritesOnly(false);
    setShowSharedOnly(false);
  }, [user]);

  // --- DERIVED STATE ---
  const currentFiles = useMemo(() => {
    let filtered = files;

    if (!user) return [];

    // Filter by Shared
    if (showSharedOnly) {
        // Show files shared WITH me (not owned by me)
        filtered = filtered.filter(f => f.sharedWith.includes(user.id) && f.ownerId !== user.id);
    } else if (showFavoritesOnly) {
        filtered = filtered.filter(f => f.isFavorite);
    } else {
        // Standard Navigation
        if (!searchQuery) {
            // Show files in current folder that are either Owned by me OR Shared with me (if in root or if parent is visible)
            filtered = filtered.filter(f => f.parentId === currentFolderId);
        }
    }

    // Filter by Search
    if (searchQuery) {
        filtered = filtered.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    return filtered;
  }, [files, currentFolderId, searchQuery, showFavoritesOnly, showSharedOnly, user]);

  const totalSize = useMemo(() => {
    return currentFiles.reduce((acc, file) => acc + parseSize(file.size), 0);
  }, [currentFiles]);

  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    if (showFavoritesOnly) return [{ id: 'fav', name: 'Favoris' }];
    if (showSharedOnly) return [{ id: 'shared', name: 'Partagés avec moi' }];
    if (searchQuery) return [{ id: 'search', name: 'Recherche' }];

    const path: BreadcrumbItem[] = [];
    let currentId = currentFolderId;
    let safeCount = 0;
    while (currentId && safeCount < 10) {
      const folder = files.find(f => f.id === currentId);
      if (folder) {
        path.unshift({ id: folder.id, name: folder.name });
        currentId = folder.parentId;
      } else {
        break;
      }
      safeCount++;
    }
    return [{ id: 'root', name: 'Accueil' }, ...path];
  }, [files, currentFolderId, showFavoritesOnly, showSharedOnly, searchQuery]);

  const selectedFile = useMemo(() => files.find(f => f.id === selectedFileId), [files, selectedFileId]);

  // --- ACTIONS ---

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    setFiles([]);
  };

  const handleNavigate = (folderId: string | null) => {
    if (folderId === 'root') folderId = null;
    setCurrentFolderId(folderId);
    setSearchQuery('');
    setShowFavoritesOnly(false);
    setShowSharedOnly(false);
    setSelectedFileId(null);
  };

  const handleDelete = (id: string) => {
    storageService.deleteFile(id);
    refreshFiles();
    if (selectedFileId === id) setSelectedFileId(null);
  };

  const handleCreate = () => {
    if (!newFileName || !user) return;

    const newFile: FileSystemItem = {
      id: Math.random().toString(36).substr(2, 9),
      ownerId: user.id,
      parentId: (showFavoritesOnly || showSharedOnly) ? null : currentFolderId,
      name: newFileName,
      type: newFileType,
      content: "",
      createdAt: Date.now(),
      size: newFileType === FileType.FOLDER ? undefined : '0B',
      isFavorite: false,
      sharedWith: []
    };

    storageService.saveFile(newFile);
    refreshFiles();
    setShowCreateModal(false);
    setNewFileName('');
    setNewFileType(FileType.FOLDER);
  };

  const handleSaveEdit = () => {
      if (selectedFile) {
          const updated = { ...selectedFile, content: editContent, size: `${editContent.length}B` };
          storageService.saveFile(updated);
          refreshFiles();
          setIsEditing(false);
      }
  };

  const handleToggleFavorite = (e: React.MouseEvent, file: FileSystemItem) => {
      e.stopPropagation();
      const updated = { ...file, isFavorite: !file.isFavorite };
      storageService.saveFile(updated);
      refreshFiles();
  };

  const handleShare = (fileId: string, targetUserId: string) => {
      const file = files.find(f => f.id === fileId);
      if (!file) return;

      const updatedSharedWith = file.sharedWith.includes(targetUserId)
        ? file.sharedWith.filter(id => id !== targetUserId)
        : [...file.sharedWith, targetUserId];

      const updatedFile = { ...file, sharedWith: updatedSharedWith };
      storageService.saveFile(updatedFile);
      refreshFiles();
  };

  const handleDownload = (e: React.MouseEvent, file: FileSystemItem) => {
    e.stopPropagation();
    const element = document.createElement("a");
    const isImage = file.type === FileType.IMAGE;
    
    if (isImage && file.content) {
       element.href = file.content;
    } else {
       const fileContent = file.content || "";
       const fileType = file.type === FileType.CODE ? "text/javascript" : "text/plain";
       const blob = new Blob([fileContent], {type: fileType});
       element.href = URL.createObjectURL(blob);
    }
    
    element.download = file.name;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !user) return;

      const reader = new FileReader();
      const isImage = file.type.startsWith('image/');

      reader.onload = (event) => {
          const result = event.target?.result as string;
          const newFile: FileSystemItem = {
              id: Math.random().toString(36).substr(2, 9),
              ownerId: user.id,
              parentId: (showFavoritesOnly || showSharedOnly) ? null : currentFolderId,
              name: file.name,
              type: isImage ? FileType.IMAGE : (file.name.endsWith('.js') || file.name.endsWith('.ts') ? FileType.CODE : FileType.TEXT),
              content: result,
              createdAt: Date.now(),
              size: `${(file.size / 1024).toFixed(1)}KB`,
              isFavorite: false,
              sharedWith: []
          };
          storageService.saveFile(newFile);
          refreshFiles();
      };
      if (isImage) reader.readAsDataURL(file);
      else reader.readAsText(file);
      e.target.value = '';
  };

  // --- RENDER HELPERS ---
  const getIcon = (file: FileSystemItem, className?: string) => {
    // If it's a folder shared with me or by me, maybe give a visual cue?
    if (file.type === FileType.FOLDER) {
         if (file.sharedWith.length > 0 || (user && file.ownerId !== user.id)) return <SharedFolderIcon className={className} />;
         return <FolderIcon className={className} />;
    }
    switch(file.type) {
      case FileType.TEXT: return <FileTextIcon className={className} />;
      case FileType.CODE: return <FileCodeIcon className={className} />;
      case FileType.IMAGE: return <ImageIcon className={className} />;
      default: return <FileTextIcon className={className} />;
    }
  };

  // --- RENDER ---

  if (isInitializing) return null;
  if (!user) return <AuthPage onLogin={setUser} />;

  return (
    <div className="flex h-screen w-full text-slate-800 bg-slate-50">
      
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />

      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                <GridIcon className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">GestIO</h1>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
           <button 
             onClick={() => handleNavigate(null)}
             className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${!showFavoritesOnly && !showSharedOnly && currentFolderId === null ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
           >
             <HomeIcon className="w-4 h-4" />
             <span>Accueil</span>
           </button>

           <button 
             onClick={() => { setShowFavoritesOnly(true); setShowSharedOnly(false); setCurrentFolderId(null); setSearchQuery(''); }}
             className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${showFavoritesOnly ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
           >
             <StarIcon className="w-4 h-4" />
             <span>Favoris</span>
           </button>

           <button 
             onClick={() => { setShowSharedOnly(true); setShowFavoritesOnly(false); setCurrentFolderId(null); setSearchQuery(''); }}
             className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${showSharedOnly ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
           >
             <ShareIcon className="w-4 h-4" />
             <span>Partagés avec moi</span>
           </button>
           
           <div className="pt-4 pb-2">
             <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Social</p>
           </div>

           <button 
             onClick={() => setShowFriendsModal(true)}
             className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
           >
              <div className="flex items-center space-x-3">
                  <UsersIcon className="w-4 h-4 text-slate-400" />
                  <span>Amis</span>
              </div>
              {user.friendRequests.length > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{user.friendRequests.length}</span>
              )}
           </button>
           
           <div className="pt-4 pb-2">
             <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</p>
           </div>
           
           <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              <UploadIcon className="w-4 h-4 text-slate-400" />
              <span>Importer un fichier</span>
           </button>
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
             <div className="flex items-center space-x-3 mb-4">
                 <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                     <UserIcon className="w-5 h-5" />
                 </div>
                 <div className="flex-1 min-w-0">
                     <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
                     <p className="text-xs text-slate-500 truncate">{user.email}</p>
                 </div>
             </div>
             <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors">
                 <LogOutIcon className="w-4 h-4" />
                 <span>Déconnexion</span>
             </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* TOP BAR */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10">
           <div className="flex items-center space-x-2 overflow-hidden mr-4">
              {breadcrumbs.map((crumb, index) => (
                <div key={crumb.id} className="flex items-center">
                  {index > 0 && <ChevronRightIcon className="w-4 h-4 text-slate-400 mx-1" />}
                  <button 
                    onClick={() => {
                        if (crumb.id === 'fav') { setShowFavoritesOnly(true); setShowSharedOnly(false); }
                        else if (crumb.id === 'shared') { setShowSharedOnly(true); setShowFavoritesOnly(false); }
                        else if (crumb.id !== 'search') handleNavigate(crumb.id);
                    }}
                    className={`text-sm font-medium whitespace-nowrap hover:text-blue-600 transition-colors ${index === breadcrumbs.length - 1 ? 'text-slate-900' : 'text-slate-500'}`}
                  >
                    {crumb.name}
                  </button>
                </div>
              ))}
           </div>

           <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <SearchIcon className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500" />
                  </div>
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher..." 
                    className="pl-9 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-lg text-sm w-64 transition-all outline-none"
                  />
                  {searchQuery && (
                      <button 
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute inset-y-0 right-0 pr-2 flex items-center"
                      >
                          <XIcon className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                      </button>
                  )}
              </div>
              
              <div className="h-6 w-px bg-slate-200 mx-2"></div>

              {/* View Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-lg">
                 <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                    <GridIcon />
                 </button>
                 <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                    <ListIcon />
                 </button>
              </div>

              <button 
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center shadow-sm shadow-blue-200 transition-colors"
              >
                 <PlusIcon className="w-4 h-4 mr-1.5" />
                 Nouveau
              </button>
           </div>
        </header>
        
        {/* SIZE PROGRESS BAR */}
        <div className="bg-white/50 backdrop-blur border-b border-slate-200 px-6 py-2 flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Stockage (Vue actuelle)</span>
            <div className="flex items-center space-x-3 flex-1 mx-6 max-w-sm">
                <div className="h-2 flex-1 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500 ease-out" 
                        style={{ width: `${Math.min((totalSize / MAX_QUOTA_BYTES) * 100, 100)}%` }}
                    />
                </div>
                <span className="text-xs font-medium text-slate-700 whitespace-nowrap min-w-[60px] text-right">
                    {formatSize(totalSize)}
                </span>
            </div>
        </div>

        {/* FILE LIST AREA */}
        <div className="flex-1 overflow-y-auto p-6" onClick={() => setSelectedFileId(null)}>
           {currentFiles.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                   <div className="bg-slate-100 p-6 rounded-full mb-4">
                       <FolderIcon className="w-12 h-12 text-slate-300" />
                   </div>
                   <p className="text-lg font-medium">Aucun élément</p>
                   {showSharedOnly ? (
                       <p className="text-sm mt-1">Personne n'a encore partagé de fichiers avec vous.</p>
                   ) : (
                       <div className="text-center">
                           <p className="text-sm mt-1">Créez un dossier ou importez un fichier.</p>
                           <button onClick={() => fileInputRef.current?.click()} className="mt-4 text-blue-600 hover:underline text-sm font-medium">Importer maintenant</button>
                       </div>
                   )}
               </div>
           ) : (
               <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4' : 'flex flex-col space-y-2'}>
                   {currentFiles.map(file => {
                       const isSharedWithMe = file.ownerId !== user.id;
                       return (
                           <div 
                             key={file.id}
                             onClick={(e) => { 
                                 e.stopPropagation(); 
                                 if (file.type === FileType.FOLDER) handleNavigate(file.id);
                                 else {
                                    setSelectedFileId(file.id);
                                    setIsEditing(false);
                                    setEditContent(file.content || '');
                                    setShowPreviewModal(true);
                                 }
                             }}
                             className={`
                               group relative cursor-pointer rounded-xl border transition-all duration-200
                               ${selectedFileId === file.id ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md'}
                               ${viewMode === 'grid' ? 'flex flex-col items-center p-6 text-center aspect-square justify-center' : 'flex items-center p-3'}
                             `}
                           >
                               {/* Icon */}
                               <div className={`${viewMode === 'grid' ? 'mb-4' : 'mr-4'} relative`}>
                                   {getIcon(file, viewMode === 'grid' ? "w-12 h-12" : "w-8 h-8")}
                                   {isSharedWithMe && (
                                       <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-slate-100">
                                            <ShareIcon className="w-3 h-3 text-indigo-500" />
                                       </div>
                                   )}
                               </div>
                               
                               {/* Info */}
                               <div className={`flex-1 min-w-0 ${viewMode === 'grid' ? 'w-full' : ''}`}>
                                   <p className="text-sm font-medium text-slate-700 truncate w-full group-hover:text-blue-700">
                                       {file.name}
                                   </p>
                                   <div className="flex items-center justify-between mt-1">
                                       <p className="text-xs text-slate-400">
                                           {file.type === FileType.FOLDER ? `${files.filter(f => f.parentId === file.id).length} éléments` : file.size}
                                           {isSharedWithMe && <span className="ml-2 text-indigo-400 text-[10px] border border-indigo-100 px-1 rounded bg-indigo-50">Partagé</span>}
                                       </p>
                                       {file.isFavorite && viewMode === 'list' && <StarIcon className="w-3 h-3 text-yellow-400" filled />}
                                   </div>
                               </div>

                               {/* Actions */}
                               <div className="absolute top-2 right-2 flex space-x-1">
                                    <button 
                                        onClick={(e) => handleToggleFavorite(e, file)}
                                        className={`p-1.5 rounded-full transition-colors ${file.isFavorite ? 'text-yellow-400 opacity-100' : 'text-slate-300 hover:text-yellow-400 opacity-0 group-hover:opacity-100'}`}
                                    >
                                        <StarIcon className="w-4 h-4" filled={file.isFavorite} />
                                    </button>
                                    
                                    {/* Download Action */}
                                    {file.type !== FileType.FOLDER && (
                                        <button 
                                            onClick={(e) => handleDownload(e, file)}
                                            className="p-1.5 rounded-full text-slate-300 hover:text-green-600 hover:bg-green-50 transition-colors opacity-0 group-hover:opacity-100"
                                            title="Télécharger"
                                        >
                                            <DownloadIcon className="w-4 h-4" />
                                        </button>
                                    )}

                                    {!isSharedWithMe && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setSelectedFileId(file.id); setShowShareModal(true); }}
                                            className="p-1.5 rounded-full text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors opacity-0 group-hover:opacity-100"
                                            title="Partager"
                                        >
                                            <ShareIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                    {/* Only owner can delete */}
                                    {!isSharedWithMe && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDelete(file.id); }}
                                            className="p-1.5 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    )}
                               </div>
                           </div>
                       );
                   })}
               </div>
           )}
        </div>
      </main>

      {/* MODALS */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-lg font-bold text-slate-800">Nouvel élément</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600"><XIcon /></button>
            </div>
            <div className="p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                    <div className="flex space-x-2">
                        <button onClick={() => setNewFileType(FileType.FOLDER)} className={`flex-1 py-2 rounded-lg text-sm border ${newFileType === FileType.FOLDER ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Dossier</button>
                        <button onClick={() => setNewFileType(FileType.TEXT)} className={`flex-1 py-2 rounded-lg text-sm border ${newFileType === FileType.TEXT ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Texte</button>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nom</label>
                    <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500" placeholder="Nom..." value={newFileName} onChange={(e) => setNewFileName(e.target.value)} />
                </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end space-x-3">
                <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-slate-600">Annuler</button>
                <button onClick={handleCreate} disabled={!newFileName} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">Créer</button>
            </div>
          </div>
        </div>
      )}

      {showPreviewModal && selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowPreviewModal(false)}>
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
               <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                   <div className="flex items-center space-x-3">
                       {getIcon(selectedFile, "w-6 h-6")}
                       <div>
                           <div className="flex items-center gap-2">
                               <h3 className="text-lg font-bold text-slate-800">{selectedFile.name}</h3>
                               <button onClick={(e) => handleToggleFavorite(e, selectedFile)}>
                                   <StarIcon className={`w-4 h-4 ${selectedFile.isFavorite ? 'text-yellow-400' : 'text-slate-300 hover:text-yellow-400'}`} filled={selectedFile.isFavorite} />
                               </button>
                           </div>
                           <p className="text-xs text-slate-400">
                               {(selectedFile.size || '0B')} • {new Date(selectedFile.createdAt).toLocaleDateString()}
                               {selectedFile.ownerId !== user.id && " • Partagé avec vous"}
                           </p>
                       </div>
                   </div>
                   <button onClick={() => setShowPreviewModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><XIcon className="text-slate-500" /></button>
               </div>
               
               <div className="flex-1 overflow-auto bg-slate-50 p-6">
                   {selectedFile.type === FileType.IMAGE ? (
                       <div className="flex items-center justify-center h-full">
                           <img src={selectedFile.content} alt={selectedFile.name} className="max-w-full max-h-full object-contain rounded shadow-sm border border-slate-200 bg-white" />
                       </div>
                   ) : (
                       <div className="h-full">
                           {isEditing ? (
                               <textarea className="w-full h-full p-4 font-mono text-sm bg-white border border-blue-300 rounded-lg outline-none resize-none" value={editContent} onChange={(e) => setEditContent(e.target.value)} />
                           ) : (
                               <pre className="whitespace-pre-wrap font-mono text-sm text-slate-700 bg-white p-6 rounded-lg border border-slate-200 shadow-sm min-h-full">{selectedFile.content || "(Vide)"}</pre>
                           )}
                       </div>
                   )}
               </div>

               <div className="p-4 border-t border-slate-100 bg-white flex justify-end space-x-3">
                   {selectedFile.type !== FileType.IMAGE && selectedFile.type !== FileType.FOLDER && (
                       <button onClick={(e) => handleDownload(e, selectedFile)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg flex items-center mr-auto">
                           <DownloadIcon className="w-4 h-4 mr-1.5" />
                           Télécharger
                       </button>
                   )}
                   
                   {/* Can edit only if owner (for simplicity in this demo) */}
                   {selectedFile.type !== FileType.IMAGE && selectedFile.ownerId === user.id && (
                       isEditing ? (
                           <>
                               <button onClick={() => { setIsEditing(false); setEditContent(selectedFile.content || ''); }} className="px-4 py-2 text-sm text-slate-600">Annuler</button>
                               <button onClick={handleSaveEdit} className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg flex items-center"><SaveIcon className="w-4 h-4 mr-1.5" />Enregistrer</button>
                           </>
                       ) : (
                           <button onClick={() => setIsEditing(true)} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg flex items-center"><EditIcon className="w-4 h-4 mr-1.5" />Modifier</button>
                       )
                   )}
               </div>
           </div>
        </div>
      )}

      {showFriendsModal && (
          <FriendManager 
              currentUser={user} 
              onUpdateUser={setUser} 
              onClose={() => setShowFriendsModal(false)} 
          />
      )}

      {showShareModal && selectedFile && (
          <ShareModal 
              file={selectedFile} 
              currentUser={user} 
              onClose={() => setShowShareModal(false)} 
              onShare={handleShare}
          />
      )}

    </div>
  );
};

export default App;