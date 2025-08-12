import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Crown, Key, LogOut, RotateCcw, Shield, ShieldCheck, UserCheck, Users } from "lucide-react";

interface UserProfile {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  status: string;
  bio: string | null;
  games_played: number;
  games_won: number;
  created_at: string;
  updated_at: string;
  user_roles?: { role: string }[];
  email?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
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

export function ManageUserDialog({ open, onOpenChange, user }: Props) {
  const { toast } = useToast();
  const userId = user?.user_id || "";

  // Profile state
  const [username, setUsername] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [bio, setBio] = useState<string>("");
  const [role, setRole] = useState<"user" | "moderator" | "admin">("user");

  // Permissions state
  const [perms, setPerms] = useState<UserPermissionsRecord>(defaultPerms(userId));
  const [loadingPerms, setLoadingPerms] = useState(false);

  // Security actions
  const [newPassword, setNewPassword] = useState("");

  const isAdmin = useMemo(() => user?.user_roles?.some(r => r.role === "admin") ?? false, [user]);
  const isModerator = useMemo(() => user?.user_roles?.some(r => r.role === "moderator") ?? false, [user]);

  useEffect(() => {
    if (!open || !user) return;
    // Initialize profile fields
    setUsername(user.username || "");
    setStatus(user.status || "");
    setBio(user.bio || "");
    if (isAdmin) setRole("admin"); else if (isModerator) setRole("moderator"); else setRole("user");

    // Load permissions
    let active = true;
    (async () => {
      setLoadingPerms(true);
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', user.user_id)
        .maybeSingle();

      if (!active) return;
      if (error && (error as any).code !== 'PGRST116') {
        toast({ title: 'Fout', description: 'Kon bevoegdheden niet laden', variant: 'destructive' });
      }
      setPerms(data ? (data as unknown as UserPermissionsRecord) : defaultPerms(user.user_id));
      setLoadingPerms(false);
    })();

    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.user_id]);

  const saveProfile = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ username, status, bio })
      .eq('user_id', user.user_id);
    if (error) {
      toast({ title: 'Fout', description: 'Kon profiel niet opslaan', variant: 'destructive' });
      return;
    }
    toast({ title: 'Opgeslagen', description: 'Profiel bijgewerkt' });
  };

  const updateRole = async () => {
    if (!user) return;
    // Remove existing roles then insert new
    await supabase.from('user_roles').delete().eq('user_id', user.user_id);
    const { error } = await supabase.from('user_roles').insert({ user_id: user.user_id, role });
    if (error) {
      toast({ title: 'Fout', description: 'Kon rol niet wijzigen', variant: 'destructive' });
      return;
    }
    toast({ title: 'Rol gewijzigd', description: `Nieuwe rol: ${role}` });
  };

  const savePermissions = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('user_permissions')
      .upsert({
        user_id: user.user_id,
        can_hard_slam: perms.can_hard_slam,
        can_invite: perms.can_invite,
        can_chat: perms.can_chat,
        can_create_lobby: perms.can_create_lobby,
        can_use_custom_backgrounds: perms.can_use_custom_backgrounds,
      }, { onConflict: 'user_id' });
    if (error) {
      toast({ title: 'Fout', description: 'Opslaan mislukt', variant: 'destructive' });
      return;
    }
    toast({ title: 'Opgeslagen', description: 'Bevoegdheden bijgewerkt' });
  };

  const resetStats = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ games_played: 0, games_won: 0 })
      .eq('user_id', user.user_id);
    if (error) { toast({ title: 'Fout', description: 'Kon stats niet resetten', variant: 'destructive' }); return; }
    toast({ title: 'Stats gereset', description: 'Games en wins op 0 gezet' });
  };

  const generateSecurePassword = () => {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%&*';
    let pwd = '';
    pwd += letters[Math.floor(Math.random()*letters.length)];
    pwd += numbers[Math.floor(Math.random()*numbers.length)];
    pwd += symbols[Math.floor(Math.random()*symbols.length)];
    const all = letters + numbers + symbols;
    for (let i=3;i<10;i++) pwd += all[Math.floor(Math.random()*all.length)];
    return pwd.split('').sort(()=>Math.random()-0.5).join('');
  };

  const resetPassword = async () => {
    if (!user || !newPassword.trim()) { toast({ title: 'Fout', description: 'Voer een wachtwoord in', variant: 'destructive' }); return; }
    const { data, error } = await supabase.functions.invoke('reset-user-password', {
      body: { userId: user.user_id, newPassword }
    });
    if (error || (data as any)?.error) {
      toast({ title: 'Fout', description: (error as any)?.message || (data as any)?.error || 'Kon wachtwoord niet resetten', variant: 'destructive' });
      return;
    }
    toast({ title: 'Wachtwoord gereset', description: `Voor ${user.username}` });
    setNewPassword('');
  };

  const forceLogout = async () => {
    if (!user) return;
    const { data, error } = await supabase.functions.invoke('force-logout', {
      body: { userId: user.user_id }
    });
    if (error || (data as any)?.error) {
      toast({ title: 'Fout', description: (error as any)?.message || (data as any)?.error || 'Kon gebruiker niet uitloggen', variant: 'destructive' });
      return;
    }
    toast({ title: 'Force logout', description: `${user.username} uitgelogd` });
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Gebruiker beheren: {user.username}</DialogTitle>
          <DialogDescription>Bekijk en beheer profiel, bevoegdheden en acties in één scherm.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-lg font-semibold">
              {user.username?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{user.username}</span>
                {isAdmin ? (
                  <Badge className="bg-red-100 text-red-800"><Crown className="h-3 w-3 mr-1" />Admin</Badge>
                ) : isModerator ? (
                  <Badge className="bg-blue-100 text-blue-800"><ShieldCheck className="h-3 w-3 mr-1" />Moderator</Badge>
                ) : (
                  <Badge variant="outline"><Users className="h-3 w-3 mr-1" />Gebruiker</Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground">Lid sinds: {new Date(user.created_at).toLocaleDateString('nl-NL')}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">{user.games_played} games</Badge>
            <Badge variant="secondary">{user.games_won} gewonnen</Badge>
          </div>
        </div>

        <Tabs defaultValue="profile" className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Profiel</TabsTrigger>
            <TabsTrigger value="permissions">Bevoegdheden</TabsTrigger>
            <TabsTrigger value="actions">Acties</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gebruikersnaam</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Beschikbaar, Bezig, ..." />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={saveProfile}><UserCheck className="h-4 w-4 mr-2" />Opslaan</Button>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Rol</Label>
                <Select value={role} onValueChange={(v: any) => setRole(v)}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Gebruiker</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={updateRole}><ShieldCheck className="h-4 w-4 mr-2" />Wijzig rol</Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="permissions" className="space-y-3">
            <div className="text-sm text-muted-foreground">Beheer wat deze gebruiker mag doen.</div>
            <div className="flex items-center justify-between py-2">
              <Label className="mr-4 text-sm">Hard Slam toestaan</Label>
              <Switch checked={perms.can_hard_slam} onCheckedChange={(v) => setPerms(p => ({ ...p, can_hard_slam: v }))} />
            </div>
            <div className="flex items-center justify-between py-2">
              <Label className="mr-4 text-sm">Uitnodigingen sturen</Label>
              <Switch checked={perms.can_invite} onCheckedChange={(v) => setPerms(p => ({ ...p, can_invite: v }))} />
            </div>
            <div className="flex items-center justify-between py-2">
              <Label className="mr-4 text-sm">Chatten toestaan</Label>
              <Switch checked={perms.can_chat} onCheckedChange={(v) => setPerms(p => ({ ...p, can_chat: v }))} />
            </div>
            <div className="flex items-center justify-between py-2">
              <Label className="mr-4 text-sm">Lobbies aanmaken</Label>
              <Switch checked={perms.can_create_lobby} onCheckedChange={(v) => setPerms(p => ({ ...p, can_create_lobby: v }))} />
            </div>
            <div className="flex items-center justify-between py-2">
              <Label className="mr-4 text-sm">Custom achtergronden</Label>
              <Switch checked={perms.can_use_custom_backgrounds} onCheckedChange={(v) => setPerms(p => ({ ...p, can_use_custom_backgrounds: v }))} />
            </div>
            <div className="pt-2">
              <Button onClick={savePermissions}><Shield className="h-4 w-4 mr-2" />Opslaan</Button>
            </div>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 p-3 rounded-md border">
                <Label>Reset statistieken</Label>
                <p className="text-sm text-muted-foreground">Zet games en gewonnen terug naar 0.</p>
                <Button variant="outline" onClick={resetStats}><RotateCcw className="h-4 w-4 mr-2" />Reset Stats</Button>
              </div>
              <div className="space-y-2 p-3 rounded-md border">
                <Label>Reset wachtwoord</Label>
                <div className="flex items-center gap-2">
                  <Input placeholder="Nieuw wachtwoord" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  <Button variant="outline" onClick={() => setNewPassword(generateSecurePassword())}>Genereer</Button>
                </div>
                <Button onClick={resetPassword}><Key className="h-4 w-4 mr-2" />Reset Wachtwoord</Button>
              </div>
              <div className="space-y-2 p-3 rounded-md border">
                <Label>Force Logout</Label>
                <p className="text-sm text-muted-foreground">Log deze gebruiker uit van alle sessies.</p>
                <Button variant="destructive" onClick={forceLogout}><LogOut className="h-4 w-4 mr-2" />Force Logout</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
