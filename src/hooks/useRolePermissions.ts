import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type AppRole = 'admin' | 'dev' | 'moderator' | 'user';

export const PERMISSION_KEYS = [
  'manage_glove_skins',
  'assign_glove_skins',
  'manage_table_backgrounds',
  'manage_app_settings',
  'manage_users',
  'view_debug_console',
  'view_boneyard_all',
  'moderate_chat',
  'manage_lobbies',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  manage_glove_skins: 'Handschoen skins beheren',
  assign_glove_skins: 'Skins toewijzen aan spelers',
  manage_table_backgrounds: 'Tafel-achtergronden beheren',
  manage_app_settings: 'App-instellingen beheren',
  manage_users: 'Gebruikersrollen wijzigen',
  view_debug_console: 'Debug console bekijken',
  view_boneyard_all: 'Boneyard van alle spelers zien',
  moderate_chat: 'Chat modereren',
  manage_lobbies: 'Lobbies beheren',
};

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin',
  dev: 'Dev',
  moderator: 'Moderator',
  user: 'Gebruiker',
};

/** Permissies van de huidige ingelogde gebruiker. */
export function useMyPermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!user) {
      setPermissions({});
      setLoading(false);
      return;
    }
    setLoading(true);
    (supabase.rpc as any)('get_my_permissions').then(({ data, error }: any) => {
      if (!active) return;
      if (error) {
        console.error('Failed to load permissions', error);
        setPermissions({});
      } else {
        const map: Record<string, boolean> = {};
        (data || []).forEach((row: { permission_key: string; allowed: boolean }) => {
          map[row.permission_key] = !!row.allowed;
        });
        setPermissions(map);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [user?.id]);

  const can = useCallback((key: PermissionKey) => !!permissions[key], [permissions]);

  return { permissions, can, loading };
}

/** Volledige role_permissions matrix — alleen leesbaar voor admin/dev/moderator (RLS). */
export function useAllRolePermissions() {
  const [rows, setRows] = useState<{ role: AppRole; permission_key: string; allowed: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('role_permissions')
      .select('role, permission_key, allowed');
    if (error) {
      setError(error.message);
      setRows([]);
    } else {
      setError(null);
      setRows(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { rows, loading, error, reload };
}