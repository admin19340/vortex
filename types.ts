export enum FileType {
  FOLDER = 'folder',
  TEXT = 'text',
  IMAGE = 'image',
  CODE = 'code',
  UNKNOWN = 'unknown'
}

export interface FileSystemItem {
  id: string;
  ownerId: string; // ID de l'utilisateur qui a créé le fichier
  parentId: string | null;
  name: string;
  type: FileType;
  content?: string;
  createdAt: number;
  size?: string;
  isFavorite: boolean;
  sharedWith: string[]; // Liste des IDs des utilisateurs avec qui le fichier est partagé
}

export interface User {
  id: string;
  email: string;
  name: string;
  password?: string;
  friends: string[]; // IDs des amis confirmés
  friendRequests: string[]; // IDs des utilisateurs ayant envoyé une demande
}

export type ViewMode = 'grid' | 'list';

export interface BreadcrumbItem {
  id: string;
  name: string;
}