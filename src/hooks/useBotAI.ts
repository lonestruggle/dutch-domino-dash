import { useCallback } from 'react';
import { DominoData, LegalMove } from '@/types/domino';

interface BotAIConfig {
  difficulty: 'easy' | 'medium' | 'hard';
  thinkingTime: number; // milliseconds
}

interface BotDecisionContext {
  currentOpenValues?: number[];
  /**
   * For each value 0..6, how many already placed tiles contain that value.
   * (double tile counts once, because the set has 7 tiles per value)
   */
  boardValueTileCounts?: number[];
}

const VALUE_DOMAIN = 7;

const clampValue = (value: number) => Math.max(0, Math.min(VALUE_DOMAIN - 1, value));

const countHandValueTiles = (hand: DominoData[]): number[] => {
  const counts = Array.from({ length: VALUE_DOMAIN }, () => 0);
  hand.forEach((domino) => {
    const v1 = clampValue(domino.value1);
    const v2 = clampValue(domino.value2);
    if (v1 === v2) {
      counts[v1] += 1;
      return;
    }
    counts[v1] += 1;
    counts[v2] += 1;
  });
  return counts;
};

const getExposedValueAfterMove = (domino: DominoData, matchedOpenValue: number): number => {
  if (domino.value1 === matchedOpenValue && domino.value2 === matchedOpenValue) {
    return matchedOpenValue; // double stays same value open
  }
  if (domino.value1 === matchedOpenValue) return domino.value2;
  if (domino.value2 === matchedOpenValue) return domino.value1;
  // Defensive fallback (should not happen for legal move)
  return domino.value1;
};

const simulateOpenValuesAfterMove = (
  currentOpenValues: number[],
  matchedOpenValue: number,
  exposedValue: number
): number[] => {
  if (!currentOpenValues.length) return [exposedValue];
  const next = [...currentOpenValues];
  const idx = next.findIndex((value) => value === matchedOpenValue);
  if (idx >= 0) next.splice(idx, 1);
  next.push(exposedValue);
  return next;
};

const getDominantValue = (handValueCounts: number[], boardValueTileCounts: number[]): number => {
  let bestValue = 0;
  let bestScore = -Infinity;
  for (let value = 0; value < VALUE_DOMAIN; value += 1) {
    const outsideTiles = Math.max(0, 7 - handValueCounts[value] - boardValueTileCounts[value]);
    const score = handValueCounts[value] * 2 - outsideTiles;
    if (score > bestScore) {
      bestScore = score;
      bestValue = value;
    }
  }
  return bestValue;
};

const scoreStrategicMove = (
  domino: DominoData,
  move: LegalMove,
  handValueCounts: number[],
  boardValueTileCounts: number[],
  currentOpenValues: number[]
): number => {
  const pipValue = domino.value1 + domino.value2;
  const isDouble = domino.value1 === domino.value2;
  const matchedValue = move.end.value;
  const exposedValue = getExposedValueAfterMove(domino, matchedValue);
  const outsideForExposed = Math.max(0, 7 - handValueCounts[exposedValue] - boardValueTileCounts[exposedValue]);
  const dominantValue = getDominantValue(handValueCounts, boardValueTileCounts);
  const nextOpenValues = simulateOpenValuesAfterMove(currentOpenValues, matchedValue, exposedValue);
  const nextOpenUnique = new Set(nextOpenValues);

  let score = 0;
  // Win condition helper: shedding high pip tiles reduces potential blocked-game penalty.
  score += pipValue * 0.35;
  if (isDouble) score += 2.0;

  // Prefer exposing values we control and opponents likely don't.
  score += handValueCounts[exposedValue] * 2.0;
  score -= outsideForExposed * 1.8;

  // Prefer keeping table pressure on a dominant value.
  if (exposedValue === dominantValue) score += 6.5;
  if (matchedValue === dominantValue && exposedValue !== dominantValue) score -= 3.0;

  // Strong trap pattern: all open ends collapse to one value.
  if (nextOpenUnique.size === 1) {
    const forcedValue = nextOpenValues[0];
    const outsideForForced = Math.max(0, 7 - handValueCounts[forcedValue] - boardValueTileCounts[forcedValue]);
    score += 9.0 + handValueCounts[forcedValue] * 1.5 - outsideForForced * 2.0;
  }

  return score;
};

export const useBotAI = () => {
  
  const calculateBestMove = useCallback((
    hand: DominoData[],
    legalMoves: LegalMove[],
    config: BotAIConfig = { difficulty: 'medium', thinkingTime: 1000 },
    context?: BotDecisionContext
  ): LegalMove | null => {
    if (!legalMoves || legalMoves.length === 0) {
      return null;
    }

    const handValueCounts = countHandValueTiles(hand);
    const boardValueTileCounts = Array.from(
      { length: VALUE_DOMAIN },
      (_, index) => Number(context?.boardValueTileCounts?.[index] || 0)
    );
    const currentOpenValues = (context?.currentOpenValues || []).filter(
      (value): value is number => Number.isFinite(value)
    );

    switch (config.difficulty) {
      case 'easy':
        // Easy bot: just picks a random legal move
        return legalMoves[Math.floor(Math.random() * legalMoves.length)];
      
      case 'medium':
        // Medium bot: balanced between simple value and light strategic blocking.
        return legalMoves
          .filter((move) => move.index !== undefined)
          .map((move) => {
            const domino = hand[move.index!];
            const strategic = scoreStrategicMove(
              domino,
              move,
              handValueCounts,
              boardValueTileCounts,
              currentOpenValues
            );
            const score = strategic * 0.55 + (domino.value1 + domino.value2) * 0.45;
            return { move, score };
          })
          .sort((a, b) => b.score - a.score)[0]?.move || legalMoves[0];
      
      case 'hard':
        // Hard bot: strategic control + blocking behavior.
        const strategicMoves = legalMoves
          .filter(move => move.index !== undefined)
          .map(move => {
            const domino = hand[move.index!];
            const score = scoreStrategicMove(
              domino,
              move,
              handValueCounts,
              boardValueTileCounts,
              currentOpenValues
            );
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
