import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSimpleAuth } from '@/hooks/useSimpleAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { DominoGame } from '@/components/DominoGame';
import { useSyncedDominoGame } from '@/hooks/useSyncedDominoGame';

interface GameData {
  id: string;
  lobby_id: string;
  status: string;
  current_player_turn: number;
  game_state: any;
  winner_position: number | null;
}

export default function Game() {
  const params = useParams();
  const gameId = params.gameId;
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useSimpleAuth();
  const { toast } = useToast();
  const [game, setGame] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);

  console.log('Game params:', params);
  console.log('Game ID extracted:', gameId);

  // Only use the synced game hook when we have valid params and auth
  const syncedGameHook = useSyncedDominoGame(
    (gameId && isAuthenticated) ? gameId : '', 
    (user?.id && isAuthenticated) ? user.id : ''
  );

  const fetchGame = async () => {
    if (!gameId) return;

    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('lobby_id', gameId)
      .single();

    if (error) {
      console.error('Error fetching game:', error);
      toast({
        title: "Error",
        description: "Failed to load game",
        variant: "destructive"
      });
      return;
    }

    setGame(data);
    setLoading(false);
  };

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;
    
    if (!isAuthenticated) {
      navigate('/lobbies');
      return;
    }

    fetchGame();
  }, [gameId, isAuthenticated, authLoading, navigate]);

  if (!isAuthenticated || authLoading) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading game...</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Game Not Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              The game you're looking for doesn't exist or hasn't started yet.
            </p>
            <Button onClick={() => navigate('/lobbies')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Lobbies
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate(`/lobby/${gameId}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Lobby
          </Button>
          <h1 className="text-3xl font-bold">Multiplayer Domino Game</h1>
        </div>

        <DominoGame gameHook={syncedGameHook} />
      </div>
    </div>
  );
}