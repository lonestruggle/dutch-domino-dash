import { useCallback } from 'react';
import { DominoData, LegalMove } from '@/types/domino';

interface BotAIConfig {
  difficulty: 'easy' | 'medium' | 'hard';
  thinkingTime: number; // milliseconds
}

export const useBotAI = () => {
  
  const calculateBestMove = useCallback((
    hand: DominoData[],
    legalMoves: LegalMove[],
    config: BotAIConfig = { difficulty: 'medium', thinkingTime: 1000 }
  ): LegalMove | null => {
    if (!legalMoves || legalMoves.length === 0) {
      return null;
    }

    switch (config.difficulty) {
      case 'easy':
        // Easy bot: just picks a random legal move
        return legalMoves[Math.floor(Math.random() * legalMoves.length)];
      
      case 'medium':
        // Medium bot: prefers doubles and high-value dominoes
        const preferredMoves = legalMoves.filter(move => {
          if (move.index === undefined) return false;
          const domino = hand[move.index];
          return domino.value1 === domino.value2; // doubles
        });
        
        if (preferredMoves.length > 0) {
          return preferredMoves[Math.floor(Math.random() * preferredMoves.length)];
        }
        
        // If no doubles, pick highest value domino
        const sortedMoves = legalMoves
          .filter(move => move.index !== undefined)
          .sort((a, b) => {
            const dominoA = hand[a.index!];
            const dominoB = hand[b.index!];
            const sumA = dominoA.value1 + dominoA.value2;
            const sumB = dominoB.value1 + dominoB.value2;
            return sumB - sumA;
          });
        
        return sortedMoves[0] || legalMoves[0];
      
      case 'hard':
        // Hard bot: strategic play
        // Prefers moves that block opponents or set up future plays
        const strategicMoves = legalMoves
          .filter(move => move.index !== undefined)
          .map(move => {
            const domino = hand[move.index!];
            const value = domino.value1 + domino.value2;
            const isDouble = domino.value1 === domino.value2;
            
            let score = value;
            if (isDouble) score += 5; // bonus for doubles
            
            // Prefer moves that leave common numbers
            const commonNumbers = [6, 5, 4]; // most common in set
            if (commonNumbers.includes(domino.value1) || commonNumbers.includes(domino.value2)) {
              score += 3;
            }
            
            return { move, score };
          });
        
        if (strategicMoves.length > 0) {
          const bestStrategicMove = strategicMoves.reduce((best, current) => 
            current.score > best.score ? current : best
          );
          return bestStrategicMove.move;
        }
        
        return legalMoves[0];
      
      default:
        return legalMoves[Math.floor(Math.random() * legalMoves.length)];
    }
  }, []);

  const shouldDrawFromBoneyard = useCallback((
    hand: DominoData[],
    legalMoves: LegalMove[],
    boneyardSize: number,
    config: BotAIConfig = { difficulty: 'medium', thinkingTime: 1000 }
  ): boolean => {
    // If no legal moves and boneyard has dominoes, bot should draw
    if (legalMoves.length === 0 && boneyardSize > 0) {
      return true;
    }
    
    // Easy bots always play if they can
    if (config.difficulty === 'easy') {
      return false;
    }
    
    // Medium/Hard bots might strategically draw in some situations
    // For now, keep it simple - only draw when no moves available
    return false;
  }, []);

  const makeBotMove = useCallback(async (
    hand: DominoData[],
    legalMoves: LegalMove[],
    boneyardSize: number,
    executeMove: (move: LegalMove) => void,
    drawFromBoneyard: () => void,
    passMove: () => void,
    config: BotAIConfig = { difficulty: 'medium', thinkingTime: 1000 }
  ) => {
    // Add thinking time for more realistic behavior
    await new Promise(resolve => setTimeout(resolve, config.thinkingTime));
    
    // If no legal moves and no boneyard, bot must pass
    if (legalMoves.length === 0 && boneyardSize === 0) {
      console.log('🤖 Bot is passing - no moves and no boneyard');
      passMove();
      return;
    }
    
    if (shouldDrawFromBoneyard(hand, legalMoves, boneyardSize, config)) {
      drawFromBoneyard();
      return;
    }
    
    const bestMove = calculateBestMove(hand, legalMoves, config);
    if (bestMove) {
      // Extra validation before executing move
      if (bestMove.index !== undefined && hand[bestMove.index]) {
        console.log(`🤖 Bot executing move:`, {
          domino: hand[bestMove.index],
          position: `${bestMove.x},${bestMove.y}`,
          direction: bestMove.end.fromDir,
          orientation: bestMove.orientation,
          flipped: bestMove.flipped
        });
        executeMove(bestMove);
      } else {
        console.error('❌ Bot move validation failed - invalid index or domino');
        if (boneyardSize === 0) {
          passMove();
        }
      }
    } else if (boneyardSize === 0) {
      // Fallback pass if no moves available
      passMove();
    }
  }, [calculateBestMove, shouldDrawFromBoneyard]);

  return {
    calculateBestMove,
    shouldDrawFromBoneyard,
    makeBotMove
  };
};
