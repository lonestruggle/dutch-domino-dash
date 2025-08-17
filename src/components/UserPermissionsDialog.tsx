import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface UserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  username: string;
}

interface UserPermissionsRecord {
  id?: string;
  user_id: string;
  can_hard_slam: boolean;
  can_invite: boolean;
  can_chat: boolean;
  can_create_lobby: boolean;
  can_use_custom_backgrounds: boolean;
}

const defaultPerms = (userId: string): UserPermissionsRecord => ({
  user_id: userId,
  can_hard_slam: true,
  can_invite: true,
  can_chat: true,
  can_create_lobby: true,
  can_use_custom_backgrounds: true,
});

export function UserPermissionsDialog({ open, onOpenChange, userId, username }: UserPermissionsDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [perms, setPerms] = useState<UserPermissionsRecord>(defaultPerms(userId));

  useEffect(() => {
    if (!open || !userId) return;
    let active = true;
    const fetchPerms = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (!active) return;
      if (error && error.code !== 'PGRST116') {
        toast({ title: 'Fout', description: 'Kon bevoegdheden niet laden', variant: 'destructive' });
      }
      setPerms(data ? (data as unknown as UserPermissionsRecord) : defaultPerms(userId));
      setLoading(false);
    };
    fetchPerms();
    return () => { active = false };
  }, [open, userId, toast]);

  const save = async () => {
    if (!userId) return;
    setLoading(true);
    const { error } = await supabase
      .from('user_permissions')
      .upsert({
        user_id: userId,
        can_hard_slam: perms.can_hard_slam,
        can_invite: perms.can_invite,
        can_chat: perms.can_chat,
        can_create_lobby: perms.can_create_lobby,
        can_use_custom_backgrounds: perms.can_use_custom_backgrounds,
      }, { onConflict: 'user_id' });

    setLoading(false);
    if (error) {
      toast({ title: 'Fout', description: 'Opslaan mislukt', variant: 'destructive' });
      return;
    }
    toast({ title: 'Opgeslagen', description: `Bevoegdheden bijgewerkt voor ${username}` });
    onOpenChange(false);
  };

  const Row = ({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between py-2">
      <Label className="mr-4 text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bevoegdheden: {username}</DialogTitle>
          <DialogDescription>Schakel specifieke rechten voor deze gebruiker in/uit.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Row label="Hard Slam toestaan" checked={perms.can_hard_slam} onCheckedChange={(v) => setPerms(p => ({ ...p, can_hard_slam: v }))} />
          <Row label="Uitnodigingen sturen" checked={perms.can_invite} onCheckedChange={(v) => setPerms(p => ({ ...p, can_invite: v }))} />
          <Row label="Chatten toestaan" checked={perms.can_chat} onCheckedChange={(v) => setPerms(p => ({ ...p, can_chat: v }))} />
          <Row label="Lobbies aanmaken" checked={perms.can_create_lobby} onCheckedChange={(v) => setPerms(p => ({ ...p, can_create_lobby: v }))} />
          <Row label="Custom achtergronden gebruiken" checked={perms.can_use_custom_backgrounds} onCheckedChange={(v) => setPerms(p => ({ ...p, can_use_custom_backgrounds: v }))} />
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annuleren</Button>
          <Button onClick={save} disabled={loading}>Opslaan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
