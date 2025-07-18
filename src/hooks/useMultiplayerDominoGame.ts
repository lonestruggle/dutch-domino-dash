import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSimpleAuth } from '@/hooks/useSimpleAuth';
import { useToast } from '@/hooks/use-toast';

interface DominoTile {
  id: string;
  leftDots: number;
  rightDots: number;
}

interface GameState {
  players: Array<{
    id: string;
    username: string;
    position: number;
    hand: DominoTile[];
  }>;
  board: DominoTile[];
  boneyard: DominoTile[];
  currentPlayerTurn: number;
  winner: number | null;
  gameStarted: boolean;
}

export const useMultiplayerDominoGame = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useSimpleAuth();
  const { toast } = useToast();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);

  // Generate all domino tiles (double-six set)
  const generateDominoSet = (): DominoTile[] => {
    const tiles: DominoTile[] = [];
    for (let i = 0; i <= 6; i++) {
      for (let j = i; j <= 6; j++) {
        tiles.push({
          id: `${i}-${j}`,
          leftDots: i,
          rightDots: j
        });
      }
    }
    return tiles.sort(() => Math.random() - 0.5); // Shuffle
  };

  const initializeGame = async (players: Array<{ id: string; username: string; position: number }>) => {
    const dominoSet = generateDominoSet();
    const handsSize = 7; // Each player gets 7 tiles
    
    const gameState: GameState = {
      players: players.map((player, index) => ({
        ...player,
        hand: dominoSet.slice(index * handsSize, (index + 1) * handsSize)
      })),
      board: [],
      boneyard: dominoSet.slice(players.length * handsSize),
      currentPlayerTurn: 0,
      winner: null,
      gameStarted: true
    };

    // Save to database
    const { error } = await supabase
      .from('games')
      .update({ 
        game_state: gameState as any,
        current_player_turn: 0,
        status: 'active'
      })
      .eq('lobby_id', gameId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to initialize game",
        variant: "destructive"
      });
      return;
    }

    setGameState(gameState);
  };

  const fetchGameState = async () => {
    if (!gameId) return;

    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('lobby_id', gameId)
      .single();

    if (error) {
      console.error('Error fetching game:', error);
      return;
    }

    if (data && data.game_state) {
      setGameState(data.game_state as any as GameState);
    }
    setLoading(false);
  };

  const makeMove = async (move: { tile: DominoTile; position: string; flipped?: boolean }) => {
    if (!gameState || !user) return;

    const currentPlayer = gameState.players.find(p => p.position === gameState.currentPlayerTurn);
    if (!currentPlayer || currentPlayer.id !== user.id) {
      toast({
        title: "Error", 
        description: "It's not your turn!",
        variant: "destructive"
      });
      return;
    }

    // Update game state
    const newGameState = { ...gameState };
    
    // Remove tile from player's hand
    const playerIndex = newGameState.players.findIndex(p => p.id === user.id);
    newGameState.players[playerIndex].hand = newGameState.players[playerIndex].hand.filter(t => t.id !== move.tile.id);
    
    // Add tile to board
    const tileToAdd = move.flipped ? { ...move.tile, leftDots: move.tile.rightDots, rightDots: move.tile.leftDots } : move.tile;
    
    if (move.position === 'start') {
      newGameState.board.unshift(tileToAdd);
    } else {
      newGameState.board.push(tileToAdd);
    }

    // Check for winner
    if (newGameState.players[playerIndex].hand.length === 0) {
      newGameState.winner = gameState.currentPlayerTurn;
    }

    // Next player's turn
    newGameState.currentPlayerTurn = (gameState.currentPlayerTurn + 1) % gameState.players.length;

    // Update database
    const { error } = await supabase
      .from('games')
      .update({
        game_state: newGameState as any,
        current_player_turn: newGameState.currentPlayerTurn,
        winner_position: newGameState.winner
      })
      .eq('lobby_id', gameId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to make move",
        variant: "destructive"
      });
      return;
    }

    setGameState(newGameState);
  };

  const startNewGame = async () => {
    if (!gameState) return;
    
    await initializeGame(gameState.players.map(p => ({ 
      id: p.id, 
      username: p.username, 
      position: p.position 
    })));
  };

  useEffect(() => {
    fetchGameState();

    // Subscribe to real-time game updates
    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `lobby_id=eq.${gameId}` },
        (payload) => {
          if (payload.new.game_state) {
            setGameState(payload.new.game_state as any as GameState);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  return {
    gameState,
    loading,
    initializeGame,
    makeMove,
    startNewGame,
    currentPlayer: gameState?.players.find(p => p.id === user?.id)
  };
};