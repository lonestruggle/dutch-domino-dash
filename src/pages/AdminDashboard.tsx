import { useEffect, useState } from 'react';
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
import { Users, BarChart3, Shield, Activity, UserX, Crown, Search, Calendar } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
}

interface ModerationAction {
  user_id: string;
  action: 'ban' | 'unban' | 'suspend' | 'warn';
  reason: string;
  duration?: string;
}

const AdminDashboard = () => {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [moderationAction, setModerationAction] = useState<ModerationAction>({
    user_id: '',
    action: 'warn',
    reason: '',
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    checkAdminStatus();
  }, [user, navigate]);

  const checkAdminStatus = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking admin status:', error);
        navigate('/');
        return;
      }

      if (data) {
        setIsAdmin(true);
        loadDashboardData();
      } else {
        toast({
          title: "Toegang geweigerd",
          description: "Je hebt geen admin rechten",
          variant: "destructive",
        });
        navigate('/');
      }
    } catch (error) {
      console.error('Error:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async () => {
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
        setUsers(usersData);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

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

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Overzicht
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Gebruikers
            </TabsTrigger>
            <TabsTrigger value="moderation" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Moderatie
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Analytics
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
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Gebruikers Beheer</CardTitle>
                <CardDescription>
                  Bekijk en beheer alle gebruikersaccounts
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
              <CardContent>
                <div className="space-y-4">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                          {user.username[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{user.username}</p>
                          <p className="text-sm text-muted-foreground">{user.status}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">
                          {user.games_played} games
                        </Badge>
                        <Badge variant="outline">
                          {user.games_won} gewonnen
                        </Badge>
                      </div>
                    </div>
                  ))}
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
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;