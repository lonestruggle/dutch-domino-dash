import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User, Settings, Trophy, GamepadIcon, LogOut, Home, UserPlus } from 'lucide-react';
import { InviteUsers } from '@/components/InviteUsers';
import { InvitationHistory } from '@/components/InvitationHistory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const Profile = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    status: '',
    bio: '',
  });

  useEffect(() => {
    if (authLoading) return; // Wait for auth to load
    if (!user) {
      navigate('/auth');
      return;
    }
    loadProfile();
  }, [user, navigate, authLoading]);

  const loadProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error loading profile:', error);
        toast({
          title: "Error",
          description: "Kon profiel niet laden",
          variant: "destructive",
        });
        return;
      }

      setProfile(data);
      setFormData({
        username: data.username || '',
        status: data.status || 'Beschikbaar',
        bio: data.bio || '',
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !profile) return;

    if (!formData.username.trim()) {
      toast({
        title: "Error",
        description: "Gebruikersnaam is verplicht",
        variant: "destructive",
      });
      return;
    }

    if (formData.username.length < 3) {
      toast({
        title: "Error",
        description: "Gebruikersnaam moet minstens 3 karakters zijn",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: formData.username.trim(),
          status: formData.status,
          bio: formData.bio.trim(),
        })
        .eq('user_id', user.id);

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Error",
            description: "Deze gebruikersnaam is al in gebruik",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: "Kon profiel niet bijwerken",
            variant: "destructive",
          });
        }
        return;
      }

      toast({
        title: "Succes",
        description: "Profiel succesvol bijgewerkt",
      });

      setEditing(false);
      loadProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Er is iets misgegaan",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Kon niet uitloggen",
        variant: "destructive",
      });
    } else {
      navigate('/');
    }
  };

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

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Profiel niet gevonden</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const winRate = profile.games_played > 0 ? Math.round((profile.games_won / profile.games_played) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <User className="h-8 w-8 text-primary" />
                Mijn Profiel
              </h1>
              <p className="text-muted-foreground">Beheer je account en statistieken</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/')}>
                <Home className="mr-2 h-4 w-4" />
                Home
              </Button>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Uitloggen
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profiel
            </TabsTrigger>
            <TabsTrigger value="invitations" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Uitnodigingen
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Statistieken
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Profile Info */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Profiel Informatie
                    </CardTitle>
                    <CardDescription>
                      {editing ? 'Bewerk je profielgegevens' : 'Je account informatie'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {editing ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="username">Gebruikersnaam</Label>
                          <Input
                            id="username"
                            value={formData.username}
                            onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                            placeholder="Je gebruikersnaam"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="status">Status</Label>
                          <Select
                            value={formData.status}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecteer status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Beschikbaar">🟢 Beschikbaar</SelectItem>
                              <SelectItem value="Aan het spelen">🎮 Aan het spelen</SelectItem>
                              <SelectItem value="Afwezig">🟡 Afwezig</SelectItem>
                              <SelectItem value="Niet storen">🔴 Niet storen</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="bio">Bio</Label>
                          <Textarea
                            id="bio"
                            value={formData.bio}
                            onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                            placeholder="Vertel iets over jezelf..."
                            rows={4}
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button onClick={handleSave}>
                            Opslaan
                          </Button>
                          <Button variant="outline" onClick={() => setEditing(false)}>
                            Annuleren
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-2xl font-bold text-primary">
                              {profile.username[0].toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold">{profile.username}</h3>
                            <Badge variant="outline" className="mt-1">
                              {profile.status}
                            </Badge>
                          </div>
                        </div>

                        {profile.bio && (
                          <div>
                            <Label>Bio</Label>
                            <p className="mt-1 text-muted-foreground">{profile.bio}</p>
                          </div>
                        )}

                        <div>
                          <Label>Account aangemaakt</Label>
                          <p className="mt-1 text-muted-foreground">
                            {new Date(profile.created_at).toLocaleDateString('nl-NL')}
                          </p>
                        </div>

                        <Button onClick={() => setEditing(true)}>
                          <Settings className="mr-2 h-4 w-4" />
                          Bewerk Profiel
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Quick Stats in Profile Tab */}
              <div>
                <InvitationHistory />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="invitations">
            <InviteUsers />
          </TabsContent>

          <TabsContent value="stats">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Prestaties
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">{profile.games_won}</div>
                    <p className="text-sm text-muted-foreground">Games gewonnen</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-3xl font-bold">{profile.games_played}</div>
                    <p className="text-sm text-muted-foreground">Games gespeeld</p>
                  </div>

                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-500">{winRate}%</div>
                    <p className="text-sm text-muted-foreground">Win percentage</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GamepadIcon className="h-5 w-5" />
                    Game Statistieken
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Beste winstreak:</span>
                      <span className="font-medium">Binnenkort</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Favoriete tijd:</span>
                      <span className="font-medium">Binnenkort</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gemiddelde game tijd:</span>
                      <span className="font-medium">Binnenkort</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Referral Prestaties
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Uitnodigingen verstuurd:</span>
                      <span className="font-medium">-</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vrienden geworven:</span>
                      <span className="font-medium">-</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Referral niveau:</span>
                      <span className="font-medium">Starter</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Profile;