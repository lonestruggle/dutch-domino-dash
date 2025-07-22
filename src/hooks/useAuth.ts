import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('useAuth: Setting up auth listener...');
    console.log('useAuth: Current URL:', window.location.href);
    console.log('useAuth: User agent:', navigator.userAgent);
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('useAuth: Auth state changed:', { 
          event, 
          sessionExists: !!session,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          accessToken: !!session?.access_token
        });
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('useAuth: Initial session check:', { 
        sessionExists: !!session, 
        error,
        userId: session?.user?.id,
        userEmail: session?.user?.email 
      });
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInAnonymously = async () => {
    console.log('useAuth: Attempting anonymous sign in...');
    const { error, data } = await supabase.auth.signInAnonymously();
    console.log('useAuth: Anonymous sign in result:', { error, sessionExists: !!data.session });
    return { error };
  };

  const signOut = async () => {
    console.log('useAuth: Starting sign out...');
    
    try {
      const { error } = await supabase.auth.signOut();
      console.log('useAuth: Sign out API result:', { error });
    } catch (error) {
      console.error('useAuth: Sign out exception:', error);
    }
    
    // Force clear everything
    setSession(null);
    setUser(null);
    
    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Force reload to ensure clean state
    window.location.reload();
    
    return { error: null };
  };

  const forceLogoutAll = async () => {
    console.log('useAuth: Force logout all sessions...');
    
    // Clear all local storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Clear state
    setSession(null);
    setUser(null);
    
    // Try to signout from server
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (error) {
      console.log('Global signout failed, continuing...', error);
    }
    
    // Force reload
    window.location.reload();
  };

  return {
    user,
    session,
    loading,
    signInAnonymously,
    signOut,
    forceLogoutAll,
    isAuthenticated: !!user
  };
};