import { useState, useEffect } from 'react';

export interface User {
  id: string;
  username: string;
}

export const useSimpleAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored user on mount
    const storedUser = localStorage.getItem('domino_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem('domino_user');
      }
    }
    setLoading(false);
  }, []);

  const signInWithUsername = async (username: string) => {
    if (!username.trim()) {
      return { error: 'Username is required' };
    }

    if (username.trim().length < 2) {
      return { error: 'Username must be at least 2 characters' };
    }

    if (username.trim().length > 20) {
      return { error: 'Username must be less than 20 characters' };
    }

    const user: User = {
      id: generateUserId(),
      username: username.trim()
    };

    setUser(user);
    localStorage.setItem('domino_user', JSON.stringify(user));
    return { error: null };
  };

  const signOut = async () => {
    setUser(null);
    localStorage.removeItem('domino_user');
    return { error: null };
  };

  const generateUserId = () => {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  return {
    user,
    loading,
    signInWithUsername,
    signOut,
    isAuthenticated: !!user
  };
};