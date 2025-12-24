import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { getDB } from '../services/db';

interface AuthContextType {
  user: User | null;
  login: (username: string, passwordHash: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check session storage for persistence on refresh
    const storedUser = sessionStorage.getItem('pos_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, passwordHash: string) => {
    const db = await getDB();
    const user = await db.getFromIndex('users', 'username', username);
    
    // In production, compare hashed passwords. 
    // Here we compare plain text as per requirements "passwordHash can be plain text for prototype"
    if (user && user.passwordHash === passwordHash) {
      setUser(user);
      sessionStorage.setItem('pos_user', JSON.stringify(user));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('pos_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
