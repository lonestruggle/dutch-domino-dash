import { CSSProperties, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { User, Settings, Trophy, GamepadIcon, LogOut, Home, UserPlus, Shield } from 'lucide-react';
import { InviteUsers } from '@/components/InviteUsers';
import { InvitationHistory } from '@/components/InvitationHistory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useAppSettings } from '@/hooks/useAppSettings';
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
  selected_glove_skin_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ProfileGloveSkin {
  id: string;
  name: string;
  image_url: string;
  overlay_offset_x: number;
  overlay_offset_y: number;
  overlay_scale: number;
  overlay_rotation: number;
}

const BASE_GLOVE_IMAGE = '/glove-hand.svg';
const withCacheBuster = (url: string, version: string) => {
  if (!url) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(version)}`;
};

const Profile = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { getSetting } = useAppSettings();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [availableGloveSkins, setAvailableGloveSkins] = useState<ProfileGloveSkin[]>([]);
  const [selectedGloveSkinId, setSelectedGloveSkinId] = useState<string>('');
  const [savingGloveSkin, setSavingGloveSkin] = useState(false);
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
          title: t('common.error'),
          description: t('profile.toastLoadFail'),
          variant: "destructive",
        });
        return;
      }

      let gamesPlayed = typeof data.games_played === 'number' ? data.games_played : 0;
      let gamesWon = typeof data.games_won === 'number' ? data.games_won : 0;

      const { data: statsRows, error: statsError } = await supabase
        .from('game_player_stats')
        .select('won')
        .eq('user_id', user.id);

      if (!statsError && statsRows) {
        gamesPlayed = statsRows.length;
        gamesWon = statsRows.reduce((count, row) => count + (row.won ? 1 : 0), 0);
      }

      setFormData({
        username: data.username || '',
        status: data.status || 'Beschikbaar',
        bio: data.bio || '',
      });

      setProfile({
        ...data,
        games_played: gamesPlayed,
        games_won: gamesWon,
      });

      await loadAvailableGloveSkins(user.id, data.selected_glove_skin_id || null);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableGloveSkins = async (userId: string, currentSelectedSkinId: string | null) => {
    try {
      const { data: assignedRows, error: assignedError } = await supabase
        .from('user_glove_skins')
        .select('skin_id')
        .eq('user_id', userId)
        .eq('is_enabled', true);

      if (assignedError) throw assignedError;

      const skinIds = Array.from(new Set((assignedRows || []).map((row) => row.skin_id).filter(Boolean)));
      if (skinIds.length === 0) {
        setAvailableGloveSkins([]);
        setSelectedGloveSkinId('');
        return;
      }

      const { data: skinRows, error: skinError } = await supabase
        .from('glove_skins')
        .select('id, name, image_url, is_active, overlay_offset_x, overlay_offset_y, overlay_scale, overlay_rotation')
        .in('id', skinIds)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (skinError) throw skinError;

      const skins = (skinRows || []).map((row) => ({
        id: row.id,
        name: row.name,
        image_url: row.image_url,
        overlay_offset_x: row.overlay_offset_x ?? 0,
        overlay_offset_y: row.overlay_offset_y ?? 0,
        overlay_scale: row.overlay_scale ?? 1,
        overlay_rotation: row.overlay_rotation ?? 0,
      }));
      setAvailableGloveSkins(skins);

      const hasCurrentSelected = Boolean(currentSelectedSkinId && skins.some((skin) => skin.id === currentSelectedSkinId));
      const nextSelected = hasCurrentSelected ? currentSelectedSkinId! : (skins[0]?.id || '');
      setSelectedGloveSkinId(nextSelected);
    } catch (error) {
      console.error('Error loading available glove skins:', error);
      setAvailableGloveSkins([]);
      setSelectedGloveSkinId('');
    }
  };

  const handleSelectGloveSkin = async (skinId: string) => {
    if (!user || !profile || !skinId) return;
    setSavingGloveSkin(true);
    try {
      const { error } = await supabase.rpc('set_selected_glove_skin', {
        _skin_id: skinId,
      });

      if (error) throw error;

      setSelectedGloveSkinId(skinId);
      setProfile((prev) => (prev ? { ...prev, selected_glove_skin_id: skinId } : prev));
      toast({
        title: t('profile.toastSkinSaved'),
        description: t('profile.toastSkinSavedDesc'),
      });
    } catch (error) {
      console.error('Error updating selected glove skin:', error);
      toast({
        title: t('common.error'),
        description: t('profile.toastSkinFail'),
        variant: 'destructive',
      });
    } finally {
      setSavingGloveSkin(false);
    }
  };

  const handleSave = async () => {
    if (!user || !profile) return;

    if (!formData.username.trim()) {
      toast({
        title: t('common.error'),
        description: t('profile.toastUsernameRequired'),
        variant: "destructive",
      });
      return;
    }

    if (formData.username.length < 3) {
      toast({
        title: t('common.error'),
        description: t('profile.toastUsernameShort'),
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
            title: t('common.error'),
            description: t('profile.toastUsernameTaken'),
            variant: "destructive",
          });
        } else {
          toast({
            title: t('common.error'),
            description: t('profile.toastUpdateFail'),
            variant: "destructive",
          });
        }
        return;
      }

      toast({
        title: t('common.success'),
        description: t('profile.toastUpdateOk'),
      });

      setEditing(false);
      loadProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: t('common.error'),
        description: t('auth.toast.somethingWrong'),
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: t('common.error'),
        description: t('profile.toastLogoutFail'),
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
            <div className="text-center">{t('common.loading')}</div>
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
            <div className="text-center">{t('profile.profileNotFound')}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const winRate = profile.games_played > 0 ? Math.round((profile.games_won / profile.games_played) * 100) : 0;
  const selectedGloveSkin = availableGloveSkins.find((skin) => skin.id === selectedGloveSkinId) || null;
  const configuredBaseGloveImageUrl = String(getSetting('global_base_glove_image_url', BASE_GLOVE_IMAGE) || BASE_GLOVE_IMAGE).trim() || BASE_GLOVE_IMAGE;
  const gloveAssetVersion = String(getSetting('global_glove_asset_version', '1') || '1');
  const isStandardGloveSkin = selectedGloveSkin?.name.trim().toLowerCase() === 'standaard';
  const showSelectedGloveOverlay = Boolean(
    selectedGloveSkin && !isStandardGloveSkin && Number(selectedGloveSkin.overlay_scale) > 0.001
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <User className="h-8 w-8 text-primary" />
                {t('profile.myProfile')}
              </h1>
              <p className="text-muted-foreground">{t('profile.manage')}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {!rolesLoading && isAdmin && (
                <Button variant="default" size="sm" onClick={() => navigate('/admin')} className="w-full sm:w-auto">
                  <Shield className="mr-2 h-4 w-4" />
                  {t('profile.adminPage')}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => navigate('/')} className="w-full sm:w-auto">
                <Home className="mr-2 h-4 w-4" />
                {t('profile.home')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut} className="w-full sm:w-auto">
                <LogOut className="mr-2 h-4 w-4" />
                {t('nav.logout')}
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {t('profile.tabProfile')}
            </TabsTrigger>
            <TabsTrigger value="invitations" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              {t('profile.tabInvitations')}
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              {t('profile.tabStats')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Profile Info */}
              <div className="lg:col-span-2">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        {t('profile.profileInfo')}
                      </CardTitle>
                      <CardDescription>
                        {editing ? t('profile.editHint') : t('profile.viewHint')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {editing ? (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="username">{t('auth.username')}</Label>
                            <Input
                              id="username"
                              value={formData.username}
                              onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                              placeholder={t('profile.usernamePh')}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select
                              value={formData.status}
                              onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t('profile.statusPh')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Beschikbaar">🟢 {t('profile.statusAvailable')}</SelectItem>
                                <SelectItem value="Aan het spelen">🎮 {t('profile.statusPlaying')}</SelectItem>
                                <SelectItem value="Afwezig">🟡 {t('profile.statusAway')}</SelectItem>
                                <SelectItem value="Niet storen">🔴 {t('profile.statusDnd')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="bio">Bio</Label>
                            <Textarea
                              id="bio"
                              value={formData.bio}
                              onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                              placeholder={t('profile.bioPh')}
                              rows={4}
                            />
                          </div>

                          <div className="flex gap-2">
                            <Button onClick={handleSave}>
                              {t('common.save')}
                            </Button>
                            <Button variant="outline" onClick={() => setEditing(false)}>
                              {t('common.cancel')}
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
                            <Label>{t('profile.accountCreated')}</Label>
                            <p className="mt-1 text-muted-foreground">
                              {new Date(profile.created_at).toLocaleDateString('nl-NL')}
                            </p>
                          </div>

                          <Button onClick={() => setEditing(true)}>
                            <Settings className="mr-2 h-4 w-4" />
                            {t('profile.editProfile')}
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>{t('profile.gloveSkin')}</CardTitle>
                      <CardDescription>
                        {t('profile.gloveSkinDesc')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {availableGloveSkins.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {t('profile.noSkins')}
                        </p>
                      ) : (
                        <>
                          <Select
                            value={selectedGloveSkinId}
                            onValueChange={(value) => {
                              setSelectedGloveSkinId(value);
                              void handleSelectGloveSkin(value);
                            }}
                            disabled={savingGloveSkin}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t('profile.gloveSkinPh')} />
                            </SelectTrigger>
                            <SelectContent>
                              {availableGloveSkins.map((skin) => (
                                <SelectItem key={skin.id} value={skin.id}>
                                  {skin.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {selectedGloveSkin && (
                            <div className="flex items-center gap-3 rounded border p-3">
                              <div className="relative h-14 w-14 shrink-0 rounded-full bg-muted/60 flex items-center justify-center overflow-hidden border">
                                <img src={withCacheBuster(configuredBaseGloveImageUrl, gloveAssetVersion)} alt="Basis handschoen" className="domino-hand-image fixed-glove-image" />
                                {showSelectedGloveOverlay && (
                                  <span
                                    className="domino-hand-skin-mask"
                                    style={{ '--glove-mask-image': `url("${configuredBaseGloveImageUrl}")` } as CSSProperties}
                                  >
                                    <img
                                      src={withCacheBuster(selectedGloveSkin.image_url, gloveAssetVersion)}
                                      alt={`${selectedGloveSkin.name} overlay`}
                                      className="domino-hand-skin-overlay"
                                      style={{
                                        '--skin-overlay-x': `${selectedGloveSkin.overlay_offset_x}%`,
                                        '--skin-overlay-y': `${selectedGloveSkin.overlay_offset_y}%`,
                                        '--skin-overlay-scale': String(selectedGloveSkin.overlay_scale),
                                        '--skin-overlay-rotation': `${selectedGloveSkin.overlay_rotation}deg`,
                                      } as CSSProperties}
                                    />
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {t('profile.activeSkin')}: <span className="font-medium text-foreground">
                                  {selectedGloveSkin.name}
                                </span>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
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
                    {t('profile.achievements')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">{profile.games_won}</div>
                    <p className="text-sm text-muted-foreground">{t('profile.gamesWon')}</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-3xl font-bold">{profile.games_played}</div>
                    <p className="text-sm text-muted-foreground">{t('profile.gamesPlayed')}</p>
                  </div>

                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-500">{winRate}%</div>
                    <p className="text-sm text-muted-foreground">{t('profile.winRate')}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GamepadIcon className="h-5 w-5" />
                    {t('profile.gameStats')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('profile.bestStreak')}</span>
                      <span className="font-medium">{t('profile.soon')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('profile.favoriteTime')}</span>
                      <span className="font-medium">{t('profile.soon')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('profile.avgTime')}</span>
                      <span className="font-medium">{t('profile.soon')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    {t('profile.referralAchievements')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('profile.invitesSent')}</span>
                      <span className="font-medium">-</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('profile.friendsInvited')}</span>
                      <span className="font-medium">-</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('profile.referralLevel')}</span>
                      <span className="font-medium">{t('profile.referralStarter')}</span>
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