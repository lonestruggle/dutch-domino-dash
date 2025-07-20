import React, { useRef, useEffect } from 'react';
import { DominoTile } from './DominoTile';
import { PlacementTarget } from './PlacementTarget';
import { GameState, LegalMove } from '@/types/domino';
import { cn } from '@/lib/utils';

interface GameBoardProps {
  gameState: GameState;
  legalMoves: LegalMove[];
  onMoveExecute: (move: LegalMove) => void;
  onCenterView: () => void;
  hasDifferentNeighbor: (x: number, y: number) => boolean;
}

const CELL_SIZE = 48;
const MIN_BOARD_SIZE = 600;
const PADDING = 200;

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  legalMoves,
  onMoveExecute,
  onCenterView,
  hasDifferentNeighbor
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // Calculate dynamic board size based on domino positions
  const calculateBoardSize = () => {
    if (Object.keys(gameState.dominoes).length === 0) {
      return MIN_BOARD_SIZE;
    }

    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    
    Object.values(gameState.dominoes).forEach(domino => {
      const dominoWidth = domino.orientation === 'horizontal' ? 2 : 1;
      const dominoHeight = domino.orientation === 'vertical' ? 2 : 1;
      
      minX = Math.min(minX, domino.x);
      maxX = Math.max(maxX, domino.x + dominoWidth - 1);
      minY = Math.min(minY, domino.y);
      maxY = Math.max(maxY, domino.y + dominoHeight - 1);
    });

    const requiredWidth = (maxX - minX + 1) * CELL_SIZE + PADDING * 2;
    const requiredHeight = (maxY - minY + 1) * CELL_SIZE + PADDING * 2;
    const requiredSize = Math.max(requiredWidth, requiredHeight, MIN_BOARD_SIZE);
    
    return Math.max(requiredSize, MIN_BOARD_SIZE);
  };

  const boardSize = calculateBoardSize();

  useEffect(() => {
    // Center view when game starts
    if (containerRef.current && Object.keys(gameState.dominoes).length === 1) {
      containerRef.current.scrollTo({
        left: boardSize / 2 - 200,
        top: boardSize / 2 - 200,
        behavior: 'smooth'
      });
    }
  }, [gameState.dominoes, boardSize]);


  return (
    <div 
      ref={containerRef}
      className="relative w-full flex-1 game-board border-2 border-border rounded-lg overflow-auto mb-4"
      style={{ scrollBehavior: 'smooth' }}
    >
      <div 
        ref={boardRef}
        className="relative"
        style={{ width: boardSize, height: boardSize }}
      >
        {/* Render placed dominoes */}
        {Object.entries(gameState.dominoes).map(([id, domino]) => (
          <div
            key={id}
            className="absolute"
            style={{
              left: boardSize / 2 + domino.x * CELL_SIZE - CELL_SIZE,
              top: boardSize / 2 + domino.y * CELL_SIZE - CELL_SIZE / 2,
            }}
          >
            <DominoTile
              data={domino.data}
              orientation={domino.orientation}
              flipped={domino.flipped}
            />
          </div>
        ))}

        {/* Render placement targets */}
        {legalMoves.map((move, index) => {
          const { end } = move;
          
          if (hasDifferentNeighbor(end.x, end.y)) return null;
          if (gameState.forbiddens[`${end.x},${end.y}`]) return null;

          let { x, y } = end;
          const { orientation, dominoData } = move;
          const isDouble = dominoData.value1 === dominoData.value2;
          
          // Adjust position based on direction
          if (orientation === "horizontal" && end.fromDir === "W") x -= 1;
          if (orientation === "vertical" && end.fromDir === "N") y -= 1;

          const size = orientation === "horizontal" ? [2, 1] : [1, 2];

          return (
            <PlacementTarget
              key={`${end.x}-${end.y}-${index}`}
              x={x}
              y={y}
              width={size[0]}
              height={size[1]}
              orientation={orientation}
              isDouble={isDouble}
              onClick={() => onMoveExecute(move)}
              style={{
                left: boardSize / 2 + (x + size[0] / 2) * CELL_SIZE,
                top: boardSize / 2 + (y + size[1] / 2) * CELL_SIZE,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};