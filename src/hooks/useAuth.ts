
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
    // Simulate auth check - in real app, this would check Supabase auth
    const checkAuth = async () => {
      try {
        const userData = localStorage.getItem('infosight_user');
        if (userData) {
          setUser(JSON.parse(userData));
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
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
    return mockUser;
  };

  const signUp = async (email: string, password: string, name: string) => {
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
    return mockUser;
  };

  const signOut = async () => {
    localStorage.removeItem('infosight_user');
    setUser(null);
  };

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut
  };
};
