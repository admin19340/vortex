import { FileSystemItem, User } from "../types";

const FILES_KEY = 'gestio_global_files';
const USERS_KEY = 'gestio_users';

export const storageService = {
  // --- FILES ---
  getAllFiles: (): FileSystemItem[] => {
    const data = localStorage.getItem(FILES_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveAllFiles: (files: FileSystemItem[]) => {
    localStorage.setItem(FILES_KEY, JSON.stringify(files));
  },

  // Get files accessible by user (owned or shared)
  getUserFiles: (userId: string): FileSystemItem[] => {
    const allFiles = storageService.getAllFiles();
    return allFiles.filter(f => f.ownerId === userId || f.sharedWith.includes(userId));
  },

  // Save/Update a single file
  saveFile: (file: FileSystemItem) => {
    const allFiles = storageService.getAllFiles();
    const index = allFiles.findIndex(f => f.id === file.id);
    if (index >= 0) {
      allFiles[index] = file;
    } else {
      allFiles.push(file);
    }
    storageService.saveAllFiles(allFiles);
  },

  deleteFile: (fileId: string) => {
    let allFiles = storageService.getAllFiles();
    // Recursively delete children
    const toDelete = [fileId];
    const gatherChildren = (pid: string) => {
        allFiles.forEach(f => {
            if(f.parentId === pid) {
                toDelete.push(f.id);
                gatherChildren(f.id);
            }
        });
    };
    gatherChildren(fileId);
    allFiles = allFiles.filter(f => !toDelete.includes(f.id));
    storageService.saveAllFiles(allFiles);
  },

  // --- USERS ---
  getAllUsers: (): User[] => {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  },

  getUserById: (id: string): User | undefined => {
    return storageService.getAllUsers().find(u => u.id === id);
  },

  getUserByEmail: (email: string): User | undefined => {
    return storageService.getAllUsers().find(u => u.email === email);
  },

  saveUser: (user: User) => {
    const users = storageService.getAllUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
};