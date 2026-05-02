import { User } from "../types";
import { storageService } from "./storageService";

export const authService = {
  register: (name: string, email: string, password: string): Promise<User> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (storageService.getUserByEmail(email)) {
          reject("Cet email est déjà utilisé.");
          return;
        }

        const newUser: User = {
          id: Math.random().toString(36).substr(2, 9),
          name,
          email,
          password,
          friends: [],
          friendRequests: []
        };

        storageService.saveUser(newUser);
        localStorage.setItem('gestio_current_user', JSON.stringify(newUser));
        resolve(newUser);
      }, 500);
    });
  },

  login: (email: string, password: string): Promise<User> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const user = storageService.getUserByEmail(email);
        
        if (user && user.password === password) {
          const safeUser = { ...user };
          delete safeUser.password;
          localStorage.setItem('gestio_current_user', JSON.stringify(safeUser));
          resolve(safeUser);
        } else {
          reject("Email ou mot de passe incorrect.");
        }
      }, 500);
    });
  },

  logout: () => {
    localStorage.removeItem('gestio_current_user');
  },

  getCurrentUser: (): User | null => {
    const data = localStorage.getItem('gestio_current_user');
    if (!data) return null;
    const basicUser = JSON.parse(data);
    // Always fetch fresh data from storage to get latest friends/requests
    return storageService.getUserById(basicUser.id) || null;
  }
};