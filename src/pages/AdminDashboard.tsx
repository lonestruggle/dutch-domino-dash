import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, BarChart3, Shield, Activity, UserX, Crown, Search, Calendar, Mail, 
  Settings, Edit, RotateCcw, Key, UserCheck, UserMinus, ShieldCheck, Star, Zap, Copy
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AnalyticsData {
  total_page_views: number;
  total_users: number;
  total_games: number;
  active_users_today: number;
  new_registrations_today: number;
}

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

interface ModerationAction {
  user_id: string;
  action: 'ban' | 'unban' | 'suspend' | 'warn';
  reason: string;
  duration?: string;
}

interface Invitation {
  id: string;
  code: string;
  invited_email: string;
  status: string;
  created_at: string;
  expires_at: string;
  accepted_at?: string;
  inviter: { username: string };
  accepter?: { username: string };
}

interface Lobby {
  id: string;
  name: string;
  created_by: string;
  created_by_username: string;
  max_players: number;
  status: string;
  created_at: string;
  player_count: number;
  hard_slam_enabled?: boolean;
  hard_slam_uses_per_player?: number;
}

const AdminDashboard = () => {
  const { user, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [moderationAction, setModerationAction] = useState<ModerationAction>({
    user_id: '',
    action: 'warn',
    reason: '',
  });
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [selectedUserForRole, setSelectedUserForRole] = useState<string>('');
  const [newRole, setNewRole] = useState<'user' | 'moderator' | 'admin'>('user');
  const [passwordResetUser, setPasswordResetUser] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');
  const [showGeneratedPassword, setShowGeneratedPassword] = useState<boolean>(false);

  const checkAdminStatus = useCallback(async () => {
    if (!user) return;
    
    console.log('Checking admin status for user:', user.id);
    
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      console.log('Admin query result:', { data, error });

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking admin status:', error);
        navigate('/');
        return;
      }

      if (data) {
        console.log('User is admin, setting isAdmin to true');
        setIsAdmin(true);
        loadDashboardData();
      } else {
        console.log('User is not admin, redirecting to home');
        toast({
          title: "Toegang geweigerd",
          description: "Je hebt geen admin rechten",
          variant: "destructive",
        });
        navigate('/');
      }
    } catch (error) {
      console.error('Exception in checkAdminStatus:', error);
      navigate('/');
    } finally {
      setDashboardLoading(false);
    }
  }, [user, navigate, toast]);

  useEffect(() => {
    console.log('AdminDashboard useEffect - user:', user, 'authLoading:', authLoading);
    
    if (authLoading) {
      console.log('Auth still loading, waiting...');
      return;
    }
    
    if (!user) {
      console.log('No user found, redirecting to auth');
      navigate('/auth?returnUrl=/admin');
      return;
    }
    
    console.log('User found, checking admin status');
    checkAdminStatus();
  }, [user, navigate, authLoading, checkAdminStatus]);


  const loadDashboardData = useCallback(async () => {
    try {
      // Load analytics data
      const { data: analyticsData, error: analyticsError } = await supabase
        .from('analytics')
        .select('event_type, created_at, user_id');

      if (!analyticsError && analyticsData) {
        const today = new Date().toISOString().split('T')[0];
        const analytics: AnalyticsData = {
          total_page_views: analyticsData.filter(a => a.event_type === 'page_view').length,
          total_users: new Set(analyticsData.map(a => a.user_id)).size,
          total_games: analyticsData.filter(a => a.event_type === 'game_started').length,
          active_users_today: analyticsData.filter(a => 
            a.created_at.startsWith(today)
          ).length,
          new_registrations_today: analyticsData.filter(a => 
            a.event_type === 'user_registered' && a.created_at.startsWith(today)
          ).length,
        };
        setAnalytics(analytics);
      }

      // Load users data
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!usersError && usersData) {
        // Get user roles separately
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('user_id, role');

        // Combine users with their roles
        const usersWithRoles = usersData.map(profile => {
          const userRoles = rolesData?.filter(role => role.user_id === profile.user_id) || [];
          return {
            ...profile,
            email: 'Email laden...', // Placeholder
            user_roles: userRoles.map(r => ({ role: r.role }))
          };
        });

        setUsers(usersWithRoles);
      }

      // Load invitations data (simplified query to avoid relation errors)
      const { data: invitationsData, error: invitationsError } = await supabase
        .from('invitations')
        .select('*')
        .order('created_at', { ascending: false });

      if (!invitationsError && invitationsData) {
        // Transform data to match interface
        const transformedInvitations = invitationsData.map(inv => ({
          ...inv,
          inviter: { username: 'Laden...' },
          accepter: inv.accepted_by ? { username: 'Laden...' } : undefined
        }));
        setInvitations(transformedInvitations as any);
      }

      // Load lobbies data
      const { data: lobbiesData, error: lobbiesError } = await supabase
        .from('lobbies')
        .select(`
          *,
          lobby_players(count)
        `)
        .order('created_at', { ascending: false });

      if (!lobbiesError && lobbiesData) {
        const lobbiesWithCount: Lobby[] = lobbiesData.map(lobby => ({
          id: lobby.id,
          name: lobby.name,
          created_by: lobby.created_by,
          created_by_username: lobby.created_by_username || 'Onbekend',
          max_players: lobby.max_players,
          status: lobby.status,
          created_at: lobby.created_at,
          player_count: lobby.lobby_players?.length || 0,
          hard_slam_enabled: lobby.hard_slam_enabled ?? true,
          hard_slam_uses_per_player: lobby.hard_slam_uses_per_player ?? -1
        }));
        setLobbies(lobbiesWithCount);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  }, []);

  const handleModerationAction = async () => {
    if (!moderationAction.user_id || !moderationAction.reason) {
      toast({
        title: "Error",
        description: "Vul alle velden in",
        variant: "destructive",
      });
      return;
    }

    try {
      // Log the moderation action
      const { error: logError } = await supabase
        .from('moderation_logs')
        .insert({
          moderator_id: user!.id,
          target_user_id: moderationAction.user_id,
          action: moderationAction.action,
          reason: moderationAction.reason,
        });

      if (logError) {
        toast({
          title: "Error",
          description: "Kon moderatie actie niet uitvoeren",
          variant: "destructive",
        });
        return;
      }

      // If it's a ban, add to user_bans table
      if (moderationAction.action === 'ban') {
        const { error: banError } = await supabase
          .from('user_bans')
          .upsert({
            user_id: moderationAction.user_id,
            banned_by: user!.id,
            reason: moderationAction.reason,
            is_permanent: !moderationAction.duration,
            expires_at: moderationAction.duration ? 
              new Date(Date.now() + parseInt(moderationAction.duration) * 24 * 60 * 60 * 1000).toISOString() : 
              null,
          });

        if (banError) {
          toast({
            title: "Error",
            description: "Kon ban niet toepassen",
            variant: "destructive",
          });
          return;
        }
      }

      // If it's an unban, remove from user_bans table
      if (moderationAction.action === 'unban') {
        await supabase
          .from('user_bans')
          .delete()
          .eq('user_id', moderationAction.user_id);
      }

      toast({
        title: "Succes",
        description: `${moderationAction.action} actie succesvol uitgevoerd`,
      });

      // Reset form
      setModerationAction({
        user_id: '',
        action: 'warn',
        reason: '',
      });
    } catch (error) {
      console.error('Error performing moderation action:', error);
      toast({
        title: "Error",
        description: "Er is iets misgegaan",
        variant: "destructive",
      });
    }
  };

  const handleDeleteLobby = async (lobbyId: string) => {
    try {
      // First delete all lobby players
      const { error: playersError } = await supabase
        .from('lobby_players')
        .delete()
        .eq('lobby_id', lobbyId);

      if (playersError) {
        toast({
          title: "Error",
          description: "Kon lobby spelers niet verwijderen",
          variant: "destructive",
        });
        return;
      }

      // Then delete the lobby
      const { error: lobbyError } = await supabase
        .from('lobbies')
        .delete()
        .eq('id', lobbyId);

      if (lobbyError) {
        toast({
          title: "Error", 
          description: "Kon lobby niet verwijderen",
          variant: "destructive",
        });
        return;
      }

      // Update local state
      setLobbies(prevLobbies => prevLobbies.filter(lobby => lobby.id !== lobbyId));
      
      toast({
        title: "Succes",
        description: "Lobby succesvol verwijderd",
      });
    } catch (error) {
      console.error('Error deleting lobby:', error);
      toast({
        title: "Error",
        description: "Er is iets misgegaan",
        variant: "destructive",
      });
    }
  };

  const handleUpdateLobbyHardSlamSettings = async (lobbyId: string, enabled: boolean, usesPerPlayer: number) => {
    try {
      const { error } = await supabase
        .from('lobbies')
        .update({ 
          hard_slam_enabled: enabled,
          hard_slam_uses_per_player: usesPerPlayer
        })
        .eq('id', lobbyId);

      if (error) {
        toast({
          title: "Error",
          description: "Kon Hard Slam instellingen niet bijwerken",
          variant: "destructive",
        });
        return;
      }

      // Update local state
      setLobbies(prevLobbies => 
        prevLobbies.map(lobby => 
          lobby.id === lobbyId 
            ? { ...lobby, hard_slam_enabled: enabled, hard_slam_uses_per_player: usesPerPlayer }
            : lobby
        )
      );

      toast({
        title: "Succes",
        description: "Hard Slam instellingen bijgewerkt",
      });
    } catch (error) {
      console.error('Error updating lobby settings:', error);
      toast({
        title: "Error",
        description: "Er is iets misgegaan",
        variant: "destructive",
      });
    }
  };

  // User management functions
  const handleUpdateUserRole = async (userId: string, newRole: 'user' | 'moderator' | 'admin') => {
    try {
      // Remove existing roles
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Add new role
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: newRole,
          assigned_by: user!.id
        });

      if (error) throw error;

      toast({
        title: "Succes",
        description: `Rol succesvol gewijzigd naar ${newRole}`,
      });

      // Refresh users data
      loadDashboardData();
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: "Error",
        description: "Kon rol niet wijzigen",
        variant: "destructive",
      });
    }
  };

  const handleUpdateUserProfile = async (userId: string, updates: Partial<UserProfile>) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Succes",
        description: "Profiel succesvol bijgewerkt",
      });

      // Refresh users data
      loadDashboardData();
      setEditingUser(null);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Kon profiel niet bijwerken",
        variant: "destructive",
      });
    }
  };

  const generateSecurePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleGeneratePassword = () => {
    const generatedPassword = generateSecurePassword();
    setNewPassword(generatedPassword);
    setShowGeneratedPassword(true);
    
    toast({
      title: "Wachtwoord gegenereerd",
      description: "Er is een veilig wachtwoord gegenereerd",
    });
  };

  const handleResetPassword = async () => {
    if (!passwordResetUser || !newPassword.trim()) {
      toast({
        title: "Error",
        description: "Selecteer een gebruiker en voer een wachtwoord in",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error", 
        description: "Wachtwoord moet minimaal 6 karakters lang zijn",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: {
          userId: passwordResetUser.user_id,
          newPassword: newPassword,
          adminId: user!.id
        }
      });

      if (error) {
        console.error('Error resetting password:', error);
        toast({
          title: "Error",
          description: error.message || "Kon wachtwoord niet resetten",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Succes",
        description: `Wachtwoord succesvol gereset voor ${passwordResetUser.username}`,
      });

      // Reset form
      setPasswordResetUser(null);
      setNewPassword('');
      setShowGeneratedPassword(false);

    } catch (error) {
      console.error('Exception resetting password:', error);
      toast({
        title: "Error",
        description: "Er is een onverwachte fout opgetreden",
        variant: "destructive",
      });
    }
  };

  const handleSyncDisplayNames = async () => {
    try {
      console.log('Starting display name sync...');
      
      const { data, error } = await supabase.functions.invoke('sync-display-names', {
        body: {}
      });

      console.log('Sync response:', { data, error });

      if (error) {
        console.error('Error syncing display names:', error);
        toast({
          title: "Error",
          description: error.message || "Kon display names niet syncen",
          variant: "destructive",
        });
        return;
      }

      console.log('Sync successful:', data);
      
      toast({
        title: "Succes",
        description: data?.message || "Display names succesvol gesynced",
      });

    } catch (error) {
      console.error('Exception syncing display names:', error);
      toast({
        title: "Error", 
        description: "Er is een onverwachte fout opgetreden bij het syncen",
        variant: "destructive",
      });
    }
  };

  const handleResetGameStats = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ games_played: 0, games_won: 0 })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Succes",
        description: "Game statistieken gereset",
      });

      // Refresh users data
      loadDashboardData();
    } catch (error) {
      console.error('Error resetting game stats:', error);
      toast({
        title: "Error",
        description: "Kon statistieken niet resetten",
        variant: "destructive",
      });
    }
  };

  const getRoleBadge = (roles: { role: string }[]) => {
    if (roles.some(r => r.role === 'admin')) {
      return <Badge className="bg-red-100 text-red-800"><Crown className="h-3 w-3 mr-1" />Admin</Badge>;
    }
    if (roles.some(r => r.role === 'moderator')) {
      return <Badge className="bg-blue-100 text-blue-800"><ShieldCheck className="h-3 w-3 mr-1" />Moderator</Badge>;
    }
    return <Badge variant="outline"><Users className="h-3 w-3 mr-1" />Gebruiker</Badge>;
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || dashboardLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Crown className="h-8 w-8 text-yellow-500" />
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground">Wegi Domino Beheer</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/')}>
              Terug naar Site
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Overzicht
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Gebruikers
            </TabsTrigger>
            <TabsTrigger value="lobbies" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Lobbies
            </TabsTrigger>
            <TabsTrigger value="moderation" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Moderatie
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="invitations" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Uitnodigingen
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Totaal Gebruikers</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.total_users || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {analytics?.new_registrations_today || 0} nieuw vandaag
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Totaal Games</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.total_games || 0}</div>
                  <p className="text-xs text-muted-foreground">Games gespeeld</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Page Views</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.total_page_views || 0}</div>
                  <p className="text-xs text-muted-foreground">Totaal bezoeken</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Actief Vandaag</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.active_users_today || 0}</div>
                  <p className="text-xs text-muted-foreground">Activiteit vandaag</p>
                </CardContent>
              </Card>
            </div>
            
            {/* Admin Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Admin Acties
                </CardTitle>
                <CardDescription>
                  Systeem onderhoud en configuratie
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleSyncDisplayNames}
                  className="flex items-center gap-2"
                  variant="outline"
                >
                  <Users className="h-4 w-4" />
                  Sync Display Names
                </Button>
                <p className="text-sm text-muted-foreground mt-2">
                  Synchroniseert gebruikersnamen naar Supabase auth display names
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <div className="space-y-6">
              {/* User Management Header */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Gebruikers Beheer
                  </CardTitle>
                  <CardDescription>
                    Beheer gebruikersaccounts, rollen en profiel instellingen
                  </CardDescription>
                  <div className="flex items-center space-x-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Zoek gebruikers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>
                </CardHeader>
              </Card>

              {/* Quick Role Assignment */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5" />
                    Snel Rol Toewijzen
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Select
                      value={selectedUserForRole}
                      onValueChange={setSelectedUserForRole}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Selecteer gebruiker" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.user_id} value={user.user_id}>
                            {user.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select
                      value={newRole}
                      onValueChange={(value: 'user' | 'moderator' | 'admin') => setNewRole(value)}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Gebruiker
                          </div>
                        </SelectItem>
                        <SelectItem value="moderator">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4" />
                            Moderator
                          </div>
                        </SelectItem>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Crown className="h-4 w-4" />
                            Admin
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Button 
                      onClick={() => selectedUserForRole && handleUpdateUserRole(selectedUserForRole, newRole)}
                      disabled={!selectedUserForRole}
                    >
                      <Crown className="mr-2 h-4 w-4" />
                      Rol Toewijzen
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Users List */}
              <Card>
                <CardHeader>
                  <CardTitle>Alle Gebruikers ({users.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {filteredUsers.map((user) => (
                      <div key={user.id} className="p-4 border rounded-lg space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center">
                              {user.username[0].toUpperCase()}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-lg">{user.username}</p>
                                {getRoleBadge(user.user_roles || [])}
                              </div>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                                  {user.status}
                                </span>
                                <span>•</span>
                                <span>Lid sinds: {new Date(user.created_at).toLocaleDateString('nl-NL')}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {user.games_played} games
                            </Badge>
                            <Badge variant="secondary">  
                              {user.games_won} gewonnen
                            </Badge>
                          </div>
                        </div>

                        {/* User Bio */}
                        {user.bio && (
                          <div className="px-4 py-2 bg-muted/50 rounded-md">
                            <p className="text-sm text-muted-foreground">{user.bio}</p>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setEditingUser(user)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Profiel
                            </Button>
                            
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleResetGameStats(user.user_id)}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Reset Stats
                            </Button>
                            
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setPasswordResetUser(user)}
                            >
                              <Key className="h-4 w-4 mr-1" />
                              Reset Wachtwoord
                            </Button>
                          </div>

                          <div className="flex gap-2">
                            {user.user_roles?.some(r => r.role === 'admin') ? (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleUpdateUserRole(user.user_id, 'user')}
                              >
                                <UserMinus className="h-4 w-4 mr-1" />
                                Degradeer
                              </Button>
                            ) : user.user_roles?.some(r => r.role === 'moderator') ? (
                              <>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleUpdateUserRole(user.user_id, 'admin')}
                                >
                                  <Crown className="h-4 w-4 mr-1" />
                                  Promoveer
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleUpdateUserRole(user.user_id, 'user')}
                                >
                                  <UserMinus className="h-4 w-4 mr-1" />
                                  Degradeer
                                </Button>
                              </>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleUpdateUserRole(user.user_id, 'moderator')}
                              >
                                <ShieldCheck className="h-4 w-4 mr-1" />
                                Maak Moderator
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Edit User Dialog */}
              {editingUser && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Edit className="h-5 w-5" />
                      Profiel Bewerken: {editingUser.username}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Gebruikersnaam</Label>
                        <Input
                          value={editingUser.username}
                          onChange={(e) => setEditingUser(prev => prev ? {...prev, username: e.target.value} : null)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Input
                          value={editingUser.status}
                          onChange={(e) => setEditingUser(prev => prev ? {...prev, status: e.target.value} : null)}
                          placeholder="Beschikbaar, Bezig, Offline..."
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Bio</Label>
                      <Textarea
                        value={editingUser.bio || ''}
                        onChange={(e) => setEditingUser(prev => prev ? {...prev, bio: e.target.value} : null)}
                        placeholder="Gebruiker bio..."
                        rows={3}
                      />
                    </div>
                    
                    <div className="flex items-center gap-2 pt-4">
                      <Button 
                        onClick={() => handleUpdateUserProfile(editingUser.user_id, {
                          username: editingUser.username,
                          status: editingUser.status,
                          bio: editingUser.bio
                        })}
                      >
                        <UserCheck className="mr-2 h-4 w-4" />
                        Opslaan
                      </Button>
                      
                      <Button variant="outline" onClick={() => setEditingUser(null)}>
                        Annuleren
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="lobbies">
            <Card>
              <CardHeader>
                <CardTitle>Lobby Beheer</CardTitle>
                <CardDescription>
                  Bekijk en beheer alle actieve lobbies
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {lobbies.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Geen lobbies gevonden</p>
                    </div>
                  ) : (
                    lobbies.map((lobby) => (
                      <div key={lobby.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                            <Users className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{lobby.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Gemaakt door: {lobby.created_by_username} • 
                              {new Date(lobby.created_at).toLocaleDateString('nl-NL')}
                            </p>
                          </div>
                        </div>
                         <div className="flex items-center space-x-2">
                           <Badge variant="outline">
                             {lobby.player_count}/{lobby.max_players} spelers
                           </Badge>
                           <Badge variant={lobby.status === 'waiting' ? 'secondary' : 'default'}>
                             {lobby.status === 'waiting' ? 'Wachtend' : 
                              lobby.status === 'playing' ? 'Bezig' : 'Voltooid'}
                           </Badge>
                           <Badge variant={lobby.hard_slam_enabled ? 'default' : 'destructive'}>
                             <Zap className="h-3 w-3 mr-1" />
                             {lobby.hard_slam_enabled ? 'Hard Slam ✓' : 'Hard Slam ✗'}
                           </Badge>
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => {
                               const newEnabled = !lobby.hard_slam_enabled;
                               handleUpdateLobbyHardSlamSettings(lobby.id, newEnabled, lobby.hard_slam_uses_per_player || -1);
                             }}
                           >
                             <Zap className="h-4 w-4" />
                           </Button>
                           <Button
                             variant="destructive"
                             size="sm"
                             onClick={() => handleDeleteLobby(lobby.id)}
                           >
                             <UserX className="h-4 w-4" />
                           </Button>
                         </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="moderation">
            <Card>
              <CardHeader>
                <CardTitle>Moderatie Acties</CardTitle>
                <CardDescription>
                  Voer moderatie acties uit op gebruikers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Gebruiker</Label>
                    <Select
                      value={moderationAction.user_id}
                      onValueChange={(value) => setModerationAction(prev => ({ ...prev, user_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecteer gebruiker" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.user_id} value={user.user_id}>
                            {user.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Actie</Label>
                    <Select
                      value={moderationAction.action}
                      onValueChange={(value: 'ban' | 'unban' | 'suspend' | 'warn') => 
                        setModerationAction(prev => ({ ...prev, action: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="warn">Waarschuwen</SelectItem>
                        <SelectItem value="suspend">Opschorten</SelectItem>
                        <SelectItem value="ban">Bannen</SelectItem>
                        <SelectItem value="unban">Ontbannen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Reden</Label>
                  <Textarea
                    placeholder="Beschrijf de reden voor deze actie..."
                    value={moderationAction.reason}
                    onChange={(e) => setModerationAction(prev => ({ ...prev, reason: e.target.value }))}
                  />
                </div>

                <Button onClick={handleModerationAction} className="w-full">
                  <UserX className="mr-2 h-4 w-4" />
                  Voer Actie Uit
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Gedetailleerde Analytics</CardTitle>
                <CardDescription>
                  Uitgebreide statistieken over websitegebruik
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center p-8">
                  <Activity className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Gedetailleerde analytics komen binnenkort beschikbaar</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invitations">
            <div className="space-y-6">
              {/* Invitation Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Totaal Uitnodigingen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{invitations.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Geaccepteerd</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {invitations.filter(inv => inv.status === 'accepted').length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">In Afwachting</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">
                      {invitations.filter(inv => inv.status === 'pending').length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Verlopen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {invitations.filter(inv => inv.status === 'expired').length}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Invitations List */}
              <Card>
                <CardHeader>
                  <CardTitle>Alle Uitnodigingen</CardTitle>
                  <CardDescription>
                    Overzicht van alle uitnodigingen in het systeem
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {invitations.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Geen uitnodigingen gevonden</p>
                      </div>
                    ) : (
                      invitations.map((invitation) => (
                        <div
                          key={invitation.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{invitation.invited_email}</span>
                              <Badge 
                                variant={
                                  invitation.status === 'accepted' ? 'default' : 
                                  invitation.status === 'pending' ? 'secondary' : 
                                  'destructive'
                                }
                              >
                                {invitation.status === 'accepted' ? 'Geaccepteerd' :
                                 invitation.status === 'pending' ? 'In Afwachting' :
                                 'Verlopen'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Code: {invitation.code} • 
                              Uitgenodigd door: {(invitation as any).inviter?.username || 'Onbekend'} • 
                              Verstuurd: {new Date(invitation.created_at).toLocaleDateString('nl-NL')}
                            </p>
                            {invitation.status === 'accepted' && invitation.accepted_at && (
                              <p className="text-sm text-green-600">
                                Geaccepteerd: {new Date(invitation.accepted_at).toLocaleDateString('nl-NL')} door {(invitation as any).accepter?.username || 'Onbekend'}
                              </p>
                            )}
                            {invitation.status === 'pending' && (
                              <p className="text-sm text-muted-foreground">
                                Verloopt: {new Date(invitation.expires_at).toLocaleDateString('nl-NL')}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
        
        {/* Password Reset Dialog */}
        <Dialog open={!!passwordResetUser} onOpenChange={() => setPasswordResetUser(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Wachtwoord Resetten voor {passwordResetUser?.username}
              </DialogTitle>
              <DialogDescription>
                Kies een nieuw tijdelijk wachtwoord voor deze gebruiker. De gebruiker moet dit wachtwoord bij de volgende login wijzigen.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nieuw Wachtwoord (min. 6 karakters)</Label>
                <div className="flex gap-2">
                  <Input
                    id="newPassword"
                    type={showGeneratedPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Voer nieuw wachtwoord in..."
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGeneratePassword}
                    className="whitespace-nowrap"
                  >
                    <Star className="h-4 w-4 mr-1" />
                    Genereer
                  </Button>
                </div>
                {showGeneratedPassword && newPassword && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded">
                    <span className="text-sm font-mono">{newPassword}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigator.clipboard.writeText(newPassword)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              
              {newPassword.length > 0 && newPassword.length < 6 && (
                <p className="text-sm text-destructive">
                  Wachtwoord moet minimaal 6 karakters lang zijn
                </p>
              )}
            </div>
            
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setPasswordResetUser(null)}>
                Annuleren
              </Button>
              <Button 
                onClick={handleResetPassword}
                disabled={!newPassword || newPassword.length < 6}
              >
                <Key className="h-4 w-4 mr-1" />
                Reset Wachtwoord
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminDashboard;