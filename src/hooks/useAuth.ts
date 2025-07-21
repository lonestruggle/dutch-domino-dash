import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('useAuth: Setting up auth listener...');
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('useAuth: Auth state changed:', { event, sessionExists: !!session });
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('useAuth: Initial session check:', { sessionExists: !!session });
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInAnonymously = async () => {
    const { error } = await supabase.auth.signInAnonymously();
    return { error };
  };

  const signOut = async () => {
    console.log('useAuth: Starting sign out...');
    
    try {
      const { error } = await supabase.auth.signOut();
      console.log('useAuth: Sign out API result:', { error });
    } catch (error) {
      console.error('useAuth: Sign out API exception:', error);
    }
    
    // Force clear local state regardless of server response
    console.log('useAuth: Forcing local state clear...');
    setSession(null);
    setUser(null);
    
    // Also clear browser storage manually to ensure complete logout
    console.log('useAuth: Clearing browser storage...');
    localStorage.removeItem('sb-zefmabelixpuaelpivjx-auth-token');
    localStorage.clear(); // Clear all localStorage to be sure
    
    // Force a page reload to completely reset the app state
    console.log('useAuth: Reloading page to complete logout...');
    window.location.reload();
    
    return { error: null };
  };

  return {
    user,
    session,
    loading,
    signInAnonymously,
    signOut,
    isAuthenticated: !!user
  };
};