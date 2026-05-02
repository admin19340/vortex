import React, { useState } from 'react';
import { User, FileSystemItem } from '../types';
import { storageService } from '../services/storageService';
import { XIcon, UsersIcon, CheckIcon, ShareIcon, SearchIcon, UserIcon } from './Icons';

interface FriendManagerProps {
  currentUser: User;
  onUpdateUser: (user: User) => void;
  onClose: () => void;
}

export const FriendManager: React.FC<FriendManagerProps> = ({ currentUser, onUpdateUser, onClose }) => {
  const [searchEmail, setSearchEmail] = useState('');
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const handleSendRequest = () => {
    setMessage(null);
    if (searchEmail === currentUser.email) {
      setMessage({ type: 'error', text: "Vous ne pouvez pas vous ajouter vous-même." });
      return;
    }

    const targetUser = storageService.getUserByEmail(searchEmail);
    if (!targetUser) {
      setMessage({ type: 'error', text: "Utilisateur non trouvé." });
      return;
    }

    if (currentUser.friends.includes(targetUser.id)) {
      setMessage({ type: 'error', text: "Déjà dans vos amis." });
      return;
    }

    if (targetUser.friendRequests.includes(currentUser.id)) {
        setMessage({ type: 'error', text: "Demande déjà envoyée." });
        return;
    }

    // Update target user
    targetUser.friendRequests.push(currentUser.id);
    storageService.saveUser(targetUser);
    setMessage({ type: 'success', text: "Demande envoyée !" });
    setSearchEmail('');
  };

  const handleAccept = (requesterId: string) => {
    // 1. Add to my friends
    const updatedMe = { ...currentUser };
    updatedMe.friends.push(requesterId);
    updatedMe.friendRequests = updatedMe.friendRequests.filter(id => id !== requesterId);
    
    // 2. Add me to their friends
    const requester = storageService.getUserById(requesterId);
    if (requester) {
        requester.friends.push(currentUser.id);
        storageService.saveUser(requester);
    }

    // 3. Save me
    storageService.saveUser(updatedMe);
    onUpdateUser(updatedMe);
  };

  const handleReject = (requesterId: string) => {
    const updatedMe = { ...currentUser };
    updatedMe.friendRequests = updatedMe.friendRequests.filter(id => id !== requesterId);
    storageService.saveUser(updatedMe);
    onUpdateUser(updatedMe);
  };

  const friendsList = currentUser.friends.map(id => storageService.getUserById(id)).filter(u => u !== undefined) as User[];
  const requestsList = currentUser.friendRequests.map(id => storageService.getUserById(id)).filter(u => u !== undefined) as User[];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center">
            <UsersIcon className="w-5 h-5 mr-2 text-blue-600" />
            Amis & Requêtes
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XIcon />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Add Friend */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Ajouter un ami</h4>
            <div className="flex space-x-2">
              <input 
                type="email" 
                placeholder="Email de l'utilisateur" 
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
              />
              <button 
                onClick={handleSendRequest}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium"
              >
                Envoyer
              </button>
            </div>
            {message && (
                <p className={`text-xs mt-1 ${message.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                    {message.text}
                </p>
            )}
          </div>

          {/* Requests */}
          {requestsList.length > 0 && (
            <div>
               <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center">
                   Demandes reçues
                   <span className="ml-2 bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">{requestsList.length}</span>
               </h4>
               <div className="space-y-2">
                   {requestsList.map(req => (
                       <div key={req.id} className="flex items-center justify-between bg-orange-50 p-2 rounded-lg border border-orange-100">
                           <div className="flex items-center space-x-2">
                               <div className="w-8 h-8 bg-orange-200 rounded-full flex items-center justify-center text-orange-700 font-bold text-xs">
                                   {req.name.charAt(0)}
                               </div>
                               <div>
                                   <p className="text-sm font-medium text-slate-800">{req.name}</p>
                                   <p className="text-xs text-slate-500">{req.email}</p>
                               </div>
                           </div>
                           <div className="flex space-x-1">
                               <button onClick={() => handleAccept(req.id)} className="p-1.5 bg-green-100 text-green-600 rounded hover:bg-green-200"><CheckIcon className="w-4 h-4" /></button>
                               <button onClick={() => handleReject(req.id)} className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200"><XIcon className="w-4 h-4" /></button>
                           </div>
                       </div>
                   ))}
               </div>
            </div>
          )}

          {/* List */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Mes Amis ({friendsList.length})</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
                {friendsList.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">Aucun ami pour le moment.</p>
                ) : (
                    friendsList.map(friend => (
                        <div key={friend.id} className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-lg transition-colors">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
                                {friend.name.charAt(0)}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-slate-800">{friend.name}</p>
                                <p className="text-xs text-slate-500">{friend.email}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ShareModalProps {
  file: FileSystemItem;
  currentUser: User;
  onClose: () => void;
  onShare: (fileId: string, userId: string) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ file, currentUser, onClose, onShare }) => {
  const friendsList = currentUser.friends.map(id => storageService.getUserById(id)).filter(u => u !== undefined) as User[];
  const [sharedWith, setSharedWith] = useState<string[]>(file.sharedWith || []);

  const toggleShare = (friendId: string) => {
      onShare(file.id, friendId);
      if (sharedWith.includes(friendId)) {
          setSharedWith(prev => prev.filter(id => id !== friendId));
      } else {
          setSharedWith(prev => [...prev, friendId]);
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center">
            <ShareIcon className="w-5 h-5 mr-2 text-indigo-600" />
            Partager "{file.name}"
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XIcon />
          </button>
        </div>
        
        <div className="p-4">
            <p className="text-sm text-slate-600 mb-4">Sélectionnez les amis avec qui partager ce fichier.</p>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
                {friendsList.length === 0 ? (
                    <div className="text-center py-4 text-slate-400">
                        <p>Vous n'avez pas encore d'amis.</p>
                        <p className="text-xs">Ajoutez des amis via le menu latéral.</p>
                    </div>
                ) : (
                    friendsList.map(friend => {
                        const isShared = sharedWith.includes(friend.id);
                        return (
                            <button 
                                key={friend.id}
                                onClick={() => toggleShare(friend.id)}
                                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${isShared ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
                            >
                                <div className="flex items-center space-x-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isShared ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                                        {friend.name.charAt(0)}
                                    </div>
                                    <div className="text-left">
                                        <p className={`text-sm font-medium ${isShared ? 'text-indigo-900' : 'text-slate-800'}`}>{friend.name}</p>
                                    </div>
                                </div>
                                {isShared && <CheckIcon className="w-5 h-5 text-indigo-600" />}
                            </button>
                        );
                    })
                )}
            </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
             <button onClick={onClose} className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900">Terminer</button>
        </div>
      </div>
    </div>
  );
};