import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export const useUserRoles = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDev, setIsDev] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRoles = async () => {
      if (!user) {
        setIsAdmin(false);
        setIsDev(false);
        setIsModerator(false);
        setLoading(false);
        return;
      }

      try {
        // Prefer server-side role functions so UI keeps working when direct table
        // visibility differs across environments (e.g. Lovable vs local).
        const [
          { data: adminByRpc, error: adminRpcError },
          { data: devByRpc, error: devRpcError },
          { data: modByRpc, error: modRpcError },
        ] = await Promise.all([
          supabase.rpc('is_admin', { _user_id: user.id }),
          supabase.rpc('is_dev' as any, { _user_id: user.id }),
          supabase.rpc('is_moderator', { _user_id: user.id }),
        ]);

        if (!adminRpcError && !devRpcError && !modRpcError) {
          setIsAdmin(Boolean(adminByRpc));
          setIsDev(Boolean(devByRpc));
          setIsModerator(Boolean(modByRpc));
          return;
        }

        // Fallback: direct roles query.
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) throw error;

        const roles = (data || []).map(r => String(r.role));
        setIsAdmin(roles.includes('admin'));
        setIsDev(roles.includes('dev'));
        setIsModerator(roles.includes('moderator'));
      } catch (error) {
        console.error('Error checking user roles:', error);
        setIsAdmin(false);
        setIsDev(false);
        setIsModerator(false);
      } finally {
        setLoading(false);
      }
    };

    checkRoles();
  }, [user]);

  return {
    isAdmin,
    isDev,
    isModerator,
    canModerate: isAdmin || isModerator,
    canAccessDevTools: isAdmin || isDev,
    loading
  };
};