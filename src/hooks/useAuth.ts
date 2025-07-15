
import { useState, useEffect } from 'react';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  created_at: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check auth on mount
    const checkAuth = async () => {
      try {
        const userData = localStorage.getItem('infosight_user');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          console.log('Found user in localStorage:', parsedUser);
          setUser(parsedUser);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('infosight_user'); // Clean up invalid data
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('Attempting sign in for:', email);
    
    // Mock authentication - in real app, this would use Supabase auth
    const mockUser: User = {
      id: '1',
      email,
      name: email.split('@')[0],
      role: email.includes('admin') ? 'admin' : 'user',
      created_at: new Date().toISOString()
    };
    
    localStorage.setItem('infosight_user', JSON.stringify(mockUser));
    setUser(mockUser);
    console.log('User signed in:', mockUser);
    return mockUser;
  };

  const signUp = async (email: string, password: string, name: string) => {
    console.log('Attempting sign up for:', email);
    
    // Mock registration - in real app, this would use Supabase auth
    const mockUser: User = {
      id: Math.random().toString(36).substring(7),
      email,
      name,
      role: 'user',
      created_at: new Date().toISOString()
    };
    
    localStorage.setItem('infosight_user', JSON.stringify(mockUser));
    setUser(mockUser);
    console.log('User signed up:', mockUser);
    return mockUser;
  };

  const signOut = async () => {
    console.log('Signing out user');
    localStorage.removeItem('infosight_user');
    setUser(null);
  };

  console.log('useAuth state - user:', user, 'loading:', loading);

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut
  };
};
