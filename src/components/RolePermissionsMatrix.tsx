import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  useAllRolePermissions,
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  type AppRole,
  type PermissionKey,
} from '@/hooks/useRolePermissions';

const ROLES: AppRole[] = ['admin', 'dev', 'moderator', 'user'];

interface Props {
  /** Alleen admins mogen wijzigen; voor mods/devs alleen-lezen. */
  readOnly?: boolean;
}

export function RolePermissionsMatrix({ readOnly = false }: Props) {
  const { toast } = useToast();
  const { rows, loading, error, reload } = useAllRolePermissions();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const matrix = useMemo(() => {
    const m: Record<string, boolean> = {};
    rows.forEach((r) => {
      m[`${r.role}:${r.permission_key}`] = !!r.allowed;
    });
    return m;
  }, [rows]);

  const toggle = async (role: AppRole, key: PermissionKey, next: boolean) => {
    if (readOnly) return;
    const cellKey = `${role}:${key}`;
    setSavingKey(cellKey);
    const { error } = await (supabase as any)
      .from('role_permissions')
      .upsert(
        { role, permission_key: key, allowed: next, updated_at: new Date().toISOString() },
        { onConflict: 'role,permission_key' }
      );
    setSavingKey(null);
    if (error) {
      toast({ title: 'Opslaan mislukt', description: error.message, variant: 'destructive' });
      return;
    }
    await reload();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Rollen & rechten
        </CardTitle>
        <CardDescription>
          {readOnly
            ? 'Overzicht van wat elke rol mag. Alleen admins kunnen dit aanpassen.'
            : 'Vink aan/uit welke acties elke rol mag uitvoeren. Wijzigingen werken direct.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Laden...</p>
        ) : error ? (
          <p className="text-sm text-destructive">Kon rechten niet laden: {error}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-4 text-left font-medium">Permissie</th>
                  {ROLES.map((r) => (
                    <th key={r} className="py-2 px-3 text-center font-medium">
                      <Badge variant="outline">{ROLE_LABELS[r]}</Badge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_KEYS.map((key) => (
                  <tr key={key} className="border-b last:border-0">
                    <td className="py-2 pr-4">{PERMISSION_LABELS[key]}</td>
                    {ROLES.map((role) => {
                      const cellKey = `${role}:${key}`;
                      const checked = !!matrix[cellKey];
                      const disabled =
                        readOnly ||
                        savingKey === cellKey ||
                        (role === 'admin' && key === 'manage_users');
                      return (
                        <td key={role} className="py-2 px-3 text-center">
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={(v) => toggle(role, key, !!v)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">
              Tip: admins behouden altijd "Gebruikersrollen wijzigen" om jezelf niet buiten te sluiten.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}