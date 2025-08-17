import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface UserPermissions {
  can_hard_slam: boolean;
  can_invite: boolean;
  can_chat: boolean;
  can_create_lobby: boolean;
  can_use_custom_backgrounds: boolean;
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  can_hard_slam: true,
  can_invite: true,
  can_chat: true,
  can_create_lobby: true,
  can_use_custom_backgrounds: true,
};

export const useUserPermissions = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!user?.id) {
        setPermissions(DEFAULT_PERMISSIONS);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_permissions')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching user permissions:', error);
          setPermissions(DEFAULT_PERMISSIONS);
        } else {
          // If no permissions record exists, use defaults
          setPermissions(data || DEFAULT_PERMISSIONS);
        }
      } catch (error) {
        console.error('Error fetching user permissions:', error);
        setPermissions(DEFAULT_PERMISSIONS);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [user?.id]);

  const canHardSlam = permissions.can_hard_slam;
  const canInvite = permissions.can_invite;
  const canChat = permissions.can_chat;
  const canCreateLobby = permissions.can_create_lobby;
  const canUseCustomBackgrounds = permissions.can_use_custom_backgrounds;

  return {
    permissions,
    loading,
    canHardSlam,
    canInvite,
    canChat,
    canCreateLobby,
    canUseCustomBackgrounds,
  };
};