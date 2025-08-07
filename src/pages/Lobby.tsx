import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Users, Play, LogOut, Copy, Plus, Minus, Bot } from 'lucide-react';
import { BackgroundSelector } from '@/components/BackgroundSelector';
import { TableBackgroundSelector } from '@/components/TableBackgroundSelector';
import { useLobbies } from '@/hooks/useLobbies';

interface LobbyPlayer {
  id: string;
  user_id: string | null;
  username: string;
  player_position: number;
  joined_at: string;
  is_bot?: boolean;
  bot_name?: string | null;
}

interface LobbyDetails {
  id: string;
  name: string;
  created_by: string;
  max_players: number;
  status: string;
  players: LobbyPlayer[];
}

export default function Lobby() {
  const params = useParams();
  const lobbyId = params.lobbyId;
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { addBot, removeBot } = useLobbies();
  const [lobby, setLobby] = useState<LobbyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBackground, setSelectedBackground] = useState<string>('domino-table-2');
  const [selectedTableBackground, setSelectedTableBackground] = useState<string | null>(null);
  
  console.log('Lobby params:', params);
  console.log('Lobby ID extracted:', lobbyId);

  const fetchLobby = async () => {
    if (!lobbyId) return;

    console.log('fetchLobby called with lobbyId:', lobbyId);

    const { data, error } = await supabase
      .from('lobbies')
      .select(`
        *,
        lobby_players(*)
      `)
      .eq('id', lobbyId)
      .single();

    if (error) {
      console.error('Error fetching lobby:', error);
      toast({
        title: "Error",
        description: "Could not load lobby",
        variant: "destructive"
      });
      navigate('/');
      return;
    }

    setLobby({
      ...data,
      players: data.lobby_players || []
    });
    setLoading(false);
  };

  const startGame = async () => {
    if (!lobby || !user) return;

    if (lobby.created_by !== user.id) {
      toast({
        title: "Error",
        description: "Only the lobby creator can start the game",
        variant: "destructive"
      });
      return;
    }

    if (lobby.players.length < 1) {
      toast({
        title: "Error", 
        description: "Need at least 1 player to start",
        variant: "destructive"
      });
      return;
    }

    // Create full domino set and shuffle
    const fullSet = [];
    for (let i = 0; i <= 6; i++) {
      for (let j = i; j <= 6; j++) {
        fullSet.push({ value1: i, value2: j });
      }
    }
    
    // Shuffle the domino set
    for (let i = fullSet.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [fullSet[i], fullSet[j]] = [fullSet[j], fullSet[i]];
    }

    // Create hands for each player
    const playerHands = [];
    const playersCount = lobby.players.length;
    
    for (let p = 0; p < playersCount; p++) {
      playerHands.push(fullSet.slice(p * 7, (p + 1) * 7));
    }
    
    const boneyard = fullSet.slice(playersCount * 7);

    // Het spel begint met een leeg bord - zoek eerste menselijke speler
    let starterPlayerIndex = 0;
    
    // Zoek de eerste menselijke speler (geen bot)
    for (let i = 0; i < playersCount; i++) {
      const player = lobby.players[i];
      if (!player.is_bot) {
        starterPlayerIndex = i;
        break;
      }
    }

    // Create initial game state met LEEG bord
    const initialGameState = {
      dominoes: {}, // VOLLEDIG LEEG
      board: {}, // VOLLEDIG LEEG
      playerHands,
      boneyard,
      openEnds: [], // GEEN OPEN ENDS
      forbiddens: {},
      nextDominoId: 0, // Start bij 0
      spinnerId: null,
      isGameOver: false,
      selectedHandIndex: null,
      currentPlayer: starterPlayerIndex
    };

    // Check if game already exists, if so update it, otherwise create new
    const { data: existingGame } = await supabase
      .from('games')
      .select('id')
      .eq('lobby_id', lobby.id)
      .maybeSingle();

    if (existingGame) {
      // Update existing game
      const { error: updateError } = await supabase
        .from('games')
        .update({
          current_player_turn: starterPlayerIndex,
          game_state: initialGameState,
          status: 'active',
          background_choice: selectedBackground,
          table_background_url: selectedTableBackground
        })
        .eq('id', existingGame.id);

      if (updateError) {
        toast({
          title: "Error",
          description: "Could not start game",
          variant: "destructive"
        });
        return;
      }
    } else {
    // Create new game
      const { error: createError } = await supabase
        .from('games')
        .insert({
          lobby_id: lobby.id,
          current_player_turn: starterPlayerIndex,
          game_state: initialGameState,
          status: 'active',
          background_choice: selectedBackground,
          table_background_url: selectedTableBackground
        });

      if (createError) {
        console.error('Game creation error:', createError);
        toast({
          title: "Error",
          description: `Could not create game: ${createError.message}`,
          variant: "destructive"
        });
        return;
      }
    }

    // Update lobby status to playing
    const { error: updateError } = await supabase
      .from('lobbies')
      .update({ status: 'playing' })
      .eq('id', lobby.id);

    if (updateError) {
      toast({
        title: "Error",
        description: "Could not start game",
        variant: "destructive"
      });
      return;
    }

    // Navigate to game
    navigate(`/game/${lobby.id}`);
  };

  const leaveLobby = async () => {
    if (!user || !lobbyId) return;

    const { error } = await supabase
      .from('lobby_players')
      .delete()
      .eq('lobby_id', lobbyId)
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Could not leave lobby",
        variant: "destructive"
      });
      return;
    }

    navigate('/');
  };

  const copyLobbyLink = async () => {
    const lobbyUrl = `${window.location.origin}/lobby/${lobbyId}`;
    try {
      await navigator.clipboard.writeText(lobbyUrl);
      toast({
        title: "Success",
        description: "Lobby link copied to clipboard!"
      });
    } catch (error) {
      toast({
        title: "Error", 
        description: "Could not copy link",
        variant: "destructive"
      });
    }
  };

  const handleAddBot = async () => {
    if (!user || !lobbyId) return;
    
    const { error } = await addBot(lobbyId, user);
    if (error) {
      toast({
        title: "Error",
        description: typeof error === 'string' ? error : error.message || "Could not add bot",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Bot added to lobby!"
      });
    }
  };

  const handleRemoveBot = async (position: number) => {
    if (!user || !lobbyId) return;
    
    const { error } = await removeBot(lobbyId, position, user);
    if (error) {
      toast({
        title: "Error",
        description: typeof error === 'string' ? error : error.message || "Could not remove bot",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Bot removed from lobby!"
      });
    }
  };

  useEffect(() => {
    console.log('Lobby useEffect - authLoading:', authLoading, 'isAuthenticated:', isAuthenticated, 'user:', user);
    
    // Wait for auth to finish loading
    if (authLoading) return;
    
    if (!isAuthenticated) {
      console.log('Not authenticated, redirecting to lobbies');
      navigate('/lobbies');
      return;
    }

    fetchLobby();

    // Subscribe to lobby changes
    const channel = supabase
      .channel(`lobby-${lobbyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new.status === 'playing') {
            navigate(`/game/${lobbyId}`);
          } else {
            fetchLobby();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lobby_players', filter: `lobby_id=eq.${lobbyId}` },
        () => fetchLobby()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lobbyId, isAuthenticated, authLoading, navigate]);

  if (!isAuthenticated) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading lobby...</p>
        </div>
      </div>
    );
  }

  if (!lobby) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Lobby not found</p>
            <Button onClick={() => navigate('/lobbies')} className="mt-4">
              Back to Lobbies
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLobbyCreator = user?.id === lobby.created_by;
  console.log('Debug lobby creator check:', { userId: user?.id, createdBy: lobby.created_by, isLobbyCreator });
  const playerSlots = Array.from({ length: lobby.max_players }, (_, index) => {
    const player = lobby.players.find(p => p.player_position === index);
    return { position: index, player };
  });

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {lobby.name}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" onClick={copyLobbyLink}>
                  <Copy className="h-4 w-4 mr-2" />
                  Share Link
                </Button>
                <Button variant="outline" onClick={leaveLobby}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Leave
                </Button>
                {isLobbyCreator && (
                  <Button onClick={startGame}>
                    <Play className="h-4 w-4 mr-2" />
                    Start Game
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-2">
              <p className="text-sm text-muted-foreground">
                Players: {lobby.players.length}/{lobby.max_players}
              </p>
              
            <div className="space-y-2">
              {playerSlots.map(({ position, player }) => (
                <div
                  key={position}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      {position + 1}
                    </div>
                    <span>
                      {player ? (
                        <div className="flex items-center gap-2">
                          <span>{player.username}</span>
                          {player.is_bot && (
                            <Bot className="h-4 w-4 text-muted-foreground" />
                          )}
                          {player.user_id === lobby.created_by && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                              Creator
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Waiting for player...</span>
                      )}
                    </span>
                  </div>
                  {isLobbyCreator && (
                    <div>
                      {player && player.is_bot ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleRemoveBot(position)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      ) : !player ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleAddBot}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          <Bot className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Background selectors for lobby creator */}
          {isLobbyCreator && (
            <div className="space-y-4">
              <BackgroundSelector
                selectedBackground={selectedBackground}
                onBackgroundChange={setSelectedBackground}
              />
              <TableBackgroundSelector
                selectedTableBackground={selectedTableBackground}
                onTableBackgroundChange={setSelectedTableBackground}
              />
            </div>
          )}

          {lobby.status === 'waiting' && (
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                {isLobbyCreator 
                  ? "Waiting for players to join. Click 'Start Game' when ready!"
                  : "Waiting for the lobby creator to start the game..."
                }
              </p>
            </div>
          )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}