import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useLobbies } from '@/hooks/useLobbies';
import { useAppSettings } from '@/hooks/useAppSettings';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, LogIn, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Coins } from 'lucide-react';

export default function Lobbies() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { lobbies, loading, createLobby, joinLobby, deleteLobby } = useLobbies();
  const { getSetting } = useAppSettings();
  const wegaEnabled = getSetting('wega_di_sen_enabled') !== false;
  const { toast } = useToast();
  const { t } = useTranslation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showUsernameDialog, setShowUsernameDialog] = useState(false);
  const [username, setUsername] = useState('');
  const [displayUsername, setDisplayUsername] = useState('');
  const [lobbyName, setLobbyName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [gameMode, setGameMode] = useState<'classic' | 'wega_di_sen'>('classic');
  const [wegaStake, setWegaStake] = useState<number>(10);

  useEffect(() => {
    if (!wegaEnabled && gameMode === 'wega_di_sen') {
      setGameMode('classic');
    }
  }, [wegaEnabled, gameMode]);
  const [myCoins, setMyCoins] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUsername();
    }
  }, [user]);

  // Set default lobby name based on username when dialog opens
  useEffect(() => {
    if (showCreateDialog && displayUsername && !lobbyName.trim()) {
      setLobbyName(`${displayUsername}'s lobby`);
    }
  }, [showCreateDialog, displayUsername]);

  const fetchUsername = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('username, coins')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setDisplayUsername(data.username);
      setMyCoins((data as any).coins ?? 0);
    }
  };


  const handleCreateLobby = async () => {
    if (!user) return;
    
    if (!lobbyName.trim()) {
      toast({
        title: t('common.error'),
        description: t('lobbies.toastEnterName'),
        variant: "destructive"
      });
      return;
    }

    setCreating(true);
    const { data, error } = await createLobby(
      lobbyName.trim(),
      user,
      maxPlayers,
      gameMode,
      gameMode === 'wega_di_sen' ? Math.max(1, wegaStake) : 10,
    );
    
    if (error) {
      toast({
        title: t('common.error'),
        description: t('lobbies.toastCreateFail'),
        variant: "destructive"
      });
    } else if (data) {
      setShowCreateDialog(false);
      setLobbyName('');
      navigate(`/lobby/${data.id}`);
    }
    
    setCreating(false);
  };

  const handleJoinLobby = async (lobbyId: string) => {
    if (!user) return;
    
    const { error } = await joinLobby(lobbyId, user);
    
    if (error) {
      toast({
        title: t('common.error'),
        description: typeof error === 'string' ? error : error.message || t('lobbies.toastJoinFail'),
        variant: "destructive"
      });
    } else {
      // Use window.location to force navigation
      window.location.href = `/lobby/${lobbyId}`;
    }
  };

  const handleDeleteLobby = async (lobbyId: string) => {
    if (!user) return;
    
    const { error } = await deleteLobby(lobbyId, user);
    
    if (error) {
      toast({
        title: t('common.error'),
        description: typeof error === 'string' ? error : error.message || t('lobbies.toastDeleteFail'),
        variant: "destructive"
      });
    } else {
      toast({
        title: t('common.success'),
        description: t('lobbies.toastDeleteOk')
      });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">{t('lobbies.authRequired')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              {t('lobbies.authRequiredDesc')}
            </p>
            <Button onClick={() => navigate('/auth')} className="w-full">
              <LogIn className="h-4 w-4 mr-2" />
              {t('lobbies.goToLogin')}
            </Button>
            <Button variant="outline" onClick={() => navigate('/')} className="w-full">
              {t('common.backHome')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen p-4">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: "url('/lovable-uploads/07b47c70-696f-408c-9981-c04375940eea.png')" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 -z-10 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">{t('lobbies.title')}</h1>
            <p className="text-white/80 flex items-center gap-2">
              {t('lobbies.welcome', { name: displayUsername || user?.email })}
              {myCoins !== null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-yellow-100 text-xs">
                  <Coins className="h-3 w-3" /> {myCoins}
                </span>
              )}
            </p>
          </div>
          <div className="flex w-full sm:w-auto gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => navigate('/')} className="w-full sm:w-auto border-white/30 bg-white/10 text-white hover:bg-white/20">
              {t('common.backHome')}
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto bg-primary hover:bg-primary/80 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('lobbies.createLobby')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('lobbies.createLobbyTitle')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="lobbyName">{t('lobbies.lobbyName')}</Label>
                    <Input
                      id="lobbyName"
                      value={lobbyName}
                      onChange={(e) => setLobbyName(e.target.value)}
                      placeholder={t('lobbies.lobbyNamePh')}
                      className="bg-white text-black placeholder:text-black/50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxPlayers">{t('lobbies.maxPlayers')}</Label>
                    <Input
                      id="maxPlayers"
                      type="number"
                      min="1"
                      max="4"
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(parseInt(e.target.value) || 4)}
                      className="bg-white text-black"
                    />
                  </div>
                  <div>
                    <Label>{t('lobbies.gameMode')}</Label>
                    <Select value={gameMode} onValueChange={(v) => setGameMode(v as 'classic' | 'wega_di_sen')}>
                      <SelectTrigger className="bg-white text-black border-input">
                        <SelectValue placeholder={t('lobbies.gameModePh')} />
                      </SelectTrigger>
                      <SelectContent className="bg-white text-black">
                        <SelectItem value="classic" className="text-black focus:bg-black/10 focus:text-black">{t('lobbies.classic')}</SelectItem>
                        {wegaEnabled && (
                          <SelectItem value="wega_di_sen" className="text-black focus:bg-black/10 focus:text-black">{t('lobbies.wega')}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  {gameMode === 'wega_di_sen' && (
                    <div>
                      <Label htmlFor="wegaStake">{t('lobbies.stakeLabel')}</Label>
                      <Input
                        id="wegaStake"
                        type="number"
                        min={1}
                        value={wegaStake}
                        onChange={(e) => setWegaStake(parseInt(e.target.value) || 1)}
                        className="bg-white text-black"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('lobbies.yourBalance', { coins: myCoins ?? 0 })}
                      </p>
                    </div>
                  )}
                  <Button 
                    onClick={handleCreateLobby} 
                    disabled={creating}
                    className="w-full"
                  >
                    {creating ? t('lobbies.creating') : t('lobbies.createLobby')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-white/80">{t('lobbies.loadingLobbies')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lobbies.length === 0 ? (
              <div className="col-span-full text-center py-8">
                <p className="text-white/80">{t('lobbies.noLobbies')}</p>
                <p className="text-sm text-white/70 mt-1">{t('lobbies.noLobbiesHint')}</p>
              </div>
            ) : (
              lobbies.map((lobby) => (
                <Card key={lobby.id} className="hover:shadow-lg transition-all duration-200 hover:scale-105 bg-white/10 backdrop-blur-md border-white/20 text-white">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="truncate">{lobby.name}</span>
                      <div className="flex items-center gap-1 text-sm">
                        <Users className="h-4 w-4" />
                        {lobby.player_count}/{lobby.max_players}
                      </div>
                    </CardTitle>
                    {lobby.game_mode === 'wega_di_sen' && (
                      <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-yellow-100 text-xs w-fit">
                        <Coins className="h-3 w-3" /> Wega di sen · {lobby.wega_stake} coins
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-white/80">
                        {t('lobbies.status', { status: lobby.status })}
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        {user?.id === lobby.created_by && (
                          <Button
                            onClick={() => handleDeleteLobby(lobby.id)}
                            variant="destructive"
                            size="sm"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          onClick={() => handleJoinLobby(lobby.id)}
                          disabled={lobby.player_count >= lobby.max_players}
                          size="sm"
                          className="w-full sm:w-auto bg-primary hover:bg-primary/80 text-white"
                        >
                          {lobby.player_count >= lobby.max_players ? t('lobbies.full') : t('lobbies.join')}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}