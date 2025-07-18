import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSimpleAuth } from '@/hooks/useSimpleAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { DominoGame } from '@/components/DominoGame';
import { useSyncedDominoGameState } from '@/hooks/useSyncedDominoGameState';
import { useDominoGame } from '@/hooks/useDominoGame';

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

  // Initialize synced game state hook
  const syncedGameHook = useSyncedDominoGameState(
    (gameId && isAuthenticated) ? gameId : '', 
    (user?.id && isAuthenticated) ? user.id : ''
  );

  // Initialize local domino game logic
  const dominoGameHook = useDominoGame();

  // Sync local state with database state when it changes
  useEffect(() => {
    if (syncedGameHook.syncState.gameState && !syncedGameHook.syncState.isLoading) {
      // Update local game state to match database state
      dominoGameHook.setGameState(syncedGameHook.syncState.gameState);
    }
  }, [syncedGameHook.syncState.gameState, syncedGameHook.syncState.isLoading]);

  // Wrap executeMove to also update database immediately
  const wrappedExecuteMove = useCallback(async (move: any) => {
    // Check if it's the current player's turn
    if (syncedGameHook.syncState.currentPlayer !== syncedGameHook.syncState.playerPosition) {
      toast({
        title: "Not your turn",
        description: "Please wait for your turn to play.",
        variant: "destructive"
      });
      return;
    }

    const { index, end, dominoData, flipped, orientation } = move;
    if (index === undefined) return;

    const currentState = dominoGameHook.gameState;
    const dbState = syncedGameHook.syncState.gameState;
    
    if (dbState && (dbState as any).playerHands) {
      // Calculate the new state after the move
      const id = `d${currentState.nextDominoId}`;
      let { x, y } = end;
      let adjustedFlipped = flipped;

      // Adjust position and flipping based on direction
      if (orientation === 'horizontal') {
        if (end.fromDir === 'W') {
          x -= 1;
          adjustedFlipped = !flipped;
        }
      } else {
        if (end.fromDir === 'N') {
          y -= 1;
          adjustedFlipped = !flipped;
        }
      }

      // Create the new domino state
      const dominoState = {
        data: dominoData,
        x,
        y,
        orientation,
        flipped: adjustedFlipped,
        isSpinner: dominoData.value1 === dominoData.value2,
      };

      // Calculate new board state
      const pips = adjustedFlipped ? [dominoData.value2, dominoData.value1] : [dominoData.value1, dominoData.value2];
      const cells = orientation === 'horizontal' ? [[x, y], [x + 1, y]] : [[x, y], [x, y + 1]];

      const newBoard = { ...currentState.board };
      const newDominoes = { ...currentState.dominoes };
      
      newDominoes[id] = dominoState;
      cells.forEach((cell, i) => {
        newBoard[`${cell[0]},${cell[1]}`] = {
          dominoId: id,
          value: pips[i],
        };
      });

      // Update player hand
      const newHand = [...currentState.playerHand];
      newHand.splice(index, 1);

      // Create updated database state
      const updatedDbState = {
        ...dbState,
        dominoes: newDominoes,
        board: newBoard,
        boneyard: currentState.boneyard,
        openEnds: currentState.openEnds,
        forbiddens: currentState.forbiddens,
        nextDominoId: currentState.nextDominoId + 1,
        spinnerId: !currentState.spinnerId && (dominoData.value1 === dominoData.value2) ? id : currentState.spinnerId,
        isGameOver: currentState.isGameOver,
        playerHands: [...(dbState as any).playerHands]
      };
      
      // Update current player's hand with the new state
      updatedDbState.playerHands[syncedGameHook.syncState.playerPosition] = newHand;
      
      // Move to next player
      const nextPlayer = (syncedGameHook.syncState.currentPlayer + 1) % syncedGameHook.syncState.allPlayers.length;
      
      // Update database first, then execute the move locally
      await syncedGameHook.updateGameState(updatedDbState, nextPlayer);
      
      // Execute the move locally
      dominoGameHook.executeMove(move);
    }
  }, [dominoGameHook, syncedGameHook, toast]);

  // Wrap drawFromBoneyard to also update database immediately
  const wrappedDrawFromBoneyard = useCallback(async () => {
    // Check if it's the current player's turn
    if (syncedGameHook.syncState.currentPlayer !== syncedGameHook.syncState.playerPosition) {
      toast({
        title: "Not your turn",
        description: "Please wait for your turn to draw.",
        variant: "destructive"
      });
      return;
    }

    // Draw locally first
    dominoGameHook.drawFromBoneyard();
    
    // Immediately update the database with the new state
    const currentState = dominoGameHook.gameState;
    const dbState = syncedGameHook.syncState.gameState;
    
    if (dbState && (dbState as any).playerHands) {
      // Create updated database state
      const updatedDbState = {
        ...dbState,
        // Update boneyard
        boneyard: currentState.boneyard,
        playerHands: [...(dbState as any).playerHands] // Preserve all player hands
      };
      
      // Update current player's hand with the drawn domino
      updatedDbState.playerHands[syncedGameHook.syncState.playerPosition] = currentState.playerHand;
      
      // Move to next player
      const nextPlayer = (syncedGameHook.syncState.currentPlayer + 1) % syncedGameHook.syncState.allPlayers.length;
      
      // Update database immediately
      await syncedGameHook.updateGameState(updatedDbState, nextPlayer);
    }
  }, [dominoGameHook, syncedGameHook, toast]);

  // Create combined hook for DominoGame component
  const combinedGameHook = {
    ...dominoGameHook,
    executeMove: wrappedExecuteMove,
    drawFromBoneyard: wrappedDrawFromBoneyard,
    syncState: syncedGameHook.syncState,
    startNewGame: syncedGameHook.startNewGame
  };

  const fetchGame = async () => {
    if (!gameId) return;

    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('lobby_id', gameId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

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

        <DominoGame gameHook={combinedGameHook} />
      </div>
    </div>
  );
}