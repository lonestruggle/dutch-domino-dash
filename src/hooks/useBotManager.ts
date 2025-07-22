import { useEffect, useCallback } from 'react';
import { useBotAI } from './useBotAI';
import { DominoData, LegalMove } from '@/types/domino';

interface BotPlayer {
  position: number;
  name: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface BotManagerProps {
  currentPlayer: number;
  players: Array<{ 
    player_position: number; 
    is_bot?: boolean; 
    bot_name?: string | null; 
    username: string; 
  }>;
  gameState: any;
  executeMove: (move: LegalMove) => void;
  drawFromBoneyard: () => void;
  findLegalMoves: (dominoData: DominoData) => LegalMove[];
  passMove: () => void;
  isGameOver: boolean;
}

export const useBotManager = ({
  currentPlayer,
  players,
  gameState,
  executeMove,
  drawFromBoneyard,
  findLegalMoves,
  passMove,
  isGameOver
}: BotManagerProps) => {
  const { makeBotMove } = useBotAI();

  const getBotDifficulty = useCallback((botName: string): 'easy' | 'medium' | 'hard' => {
    // Simple difficulty assignment based on bot name
    if (botName.includes('Dave') || botName.includes('Betty')) return 'easy';
    if (botName.includes('Raja') || botName.includes('Sam')) return 'hard';
    return 'medium'; // Default
  }, []);

  const processBotTurn = useCallback(async () => {
    if (isGameOver || !gameState) return;

    // Find current player
    const currentPlayerData = players.find(p => p.player_position === currentPlayer);
    
    if (!currentPlayerData || !currentPlayerData.is_bot) {
      return; // Not a bot's turn
    }

    console.log(`🤖 Bot ${currentPlayerData.username} is thinking...`);

    // Get bot's hand
    const botHand = gameState.playerHands?.[currentPlayer] || [];
    
    if (!botHand || botHand.length === 0) {
      console.log('❌ Bot has no dominoes');
      return;
    }

    // Find all possible legal moves for all dominoes in hand
    let allLegalMoves: LegalMove[] = [];
    
    botHand.forEach((domino: DominoData, index: number) => {
      const moves = findLegalMoves(domino);
      // Add the hand index to each move
      moves.forEach(move => {
        move.index = index;
      });
      allLegalMoves = allLegalMoves.concat(moves);
    });

    const boneyardSize = gameState.boneyard?.length || 0;
    const difficulty = getBotDifficulty(currentPlayerData.bot_name || currentPlayerData.username);

    try {
      await makeBotMove(
        botHand,
        allLegalMoves,
        boneyardSize,
        executeMove,
        drawFromBoneyard,
        passMove,
        { difficulty, thinkingTime: 1500 } // 1.5 second thinking time
      );
    } catch (error) {
      console.error('❌ Bot move error:', error);
    }
  }, [
    currentPlayer,
    players,
    gameState,
    isGameOver,
    executeMove,
    drawFromBoneyard,
    findLegalMoves,
    makeBotMove,
    getBotDifficulty
  ]);

  // Auto-execute bot moves when it's a bot's turn
  useEffect(() => {
    if (isGameOver) return;
    
    const currentPlayerData = players.find(p => p.player_position === currentPlayer);
    
    if (currentPlayerData?.is_bot) {
      // Small delay to make the bot move feel more natural
      const timer = setTimeout(() => {
        processBotTurn();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [currentPlayer, players, processBotTurn, isGameOver]);

  return {
    processBotTurn
  };
};