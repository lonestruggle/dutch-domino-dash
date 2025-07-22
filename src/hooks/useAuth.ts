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
      
      // Clear local state
      setSession(null);
      setUser(null);
      
      return { error };
    } catch (error) {
      console.error('useAuth: Sign out exception:', error);
      
      // Still clear local state on error
      setSession(null);
      setUser(null);
      
      return { error: null };
    }
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