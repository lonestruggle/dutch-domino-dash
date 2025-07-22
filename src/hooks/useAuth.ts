import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Chrome-specific fix: detect Chrome and add extra logging
  const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);

  useEffect(() => {
    console.log('useAuth: Setting up auth listener...');
    console.log('useAuth: Current URL:', window.location.href);
    console.log('useAuth: User agent:', navigator.userAgent);
    console.log('useAuth: Is Chrome:', isChrome);
    console.log('useAuth: LocalStorage available:', !!window.localStorage);
    console.log('useAuth: SessionStorage available:', !!window.sessionStorage);
    
    // Chrome-specific: check existing tokens in storage
    if (isChrome) {
      console.log('useAuth: Chrome detected - checking storage...');
      const existingToken = localStorage.getItem('sb-auth-token');
      console.log('useAuth: Existing token in localStorage:', !!existingToken);
    }
    
    let mounted = true;
    
    // First get existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return;
      
      console.log('useAuth: Initial session check:', { 
        sessionExists: !!session, 
        error,
        userId: session?.user?.id,
        userEmail: session?.user?.email 
      });
      
      if (session) {
        setSession(session);
        setUser(session.user);
      }
      setLoading(false);
    });

    // Then set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        console.log('useAuth: Auth state changed:', { 
          event, 
          sessionExists: !!session,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          accessToken: !!session?.access_token
        });
        
        // Only update state if there's actually a change
        if (event === 'SIGNED_IN' && session) {
          setSession(session);
          setUser(session.user);
        } else if (event === 'SIGNED_OUT' || !session) {
          setSession(null);
          setUser(null);
        } else if (event === 'TOKEN_REFRESHED' && session) {
          setSession(session);
          setUser(session.user);
        }
        
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
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
    
    // Chrome-specific: clear any residual auth data
    if (isChrome) {
      console.log('useAuth: Chrome detected - clearing all auth-related storage...');
      // Clear specific Supabase keys that might be cached
      const keysToRemove = [
        'sb-auth-token',
        'supabase.auth.token',
        'sb-zefmabelixpuaelpivjx-auth-token',
        'supabase-auth-token'
      ];
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
    }
    
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

  const clearChromeStorage = async () => {
    console.log('useAuth: Clearing Chrome storage specifically...');
    
    if (isChrome) {
      // Clear all possible Supabase auth keys
      const authKeys = [
        'sb-auth-token',
        'supabase.auth.token', 
        'sb-zefmabelixpuaelpivjx-auth-token',
        'supabase-auth-token',
        'supabase.session'
      ];
      
      authKeys.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
        console.log(`Removed ${key} from storage`);
      });
      
      // Also clear any cookies that might interfere
      document.cookie.split(";").forEach(function(c) { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
      });
      
      console.log('Chrome storage cleared, refreshing page...');
      window.location.reload();
    }
  };

  return {
    user,
    session,
    loading,
    signInAnonymously,
    signOut,
    forceLogoutAll,
    clearChromeStorage,
    isAuthenticated: !!user,
    isChrome
  };
};