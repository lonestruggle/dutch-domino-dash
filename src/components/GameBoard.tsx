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
}

const CELL_SIZE = 48;
const BOARD_SIZE = 5000;

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  legalMoves,
  onMoveExecute,
  onCenterView
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Center view when game starts
    if (containerRef.current && Object.keys(gameState.dominoes).length === 1) {
      containerRef.current.scrollTo({
        left: 1950,
        top: 2250,
        behavior: 'smooth'
      });
    }
  }, [gameState.dominoes]);

  const hasDifferentNeighbor = (x: number, y: number): boolean => {
    const { board } = gameState;
    const neighbors = [
      [x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y],
      [x + 1, y - 1], [x - 1, y - 1], [x + 1, y + 1], [x - 1, y + 1]
    ];

    let neighborCount = 0;
    for (const [nx, ny] of neighbors) {
      if (board[`${nx},${ny}`]) {
        neighborCount++;
      }
    }

    return neighborCount > 3;
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full flex-1 game-board border-2 border-border rounded-lg overflow-auto mb-4"
      style={{ scrollBehavior: 'smooth' }}
    >
      <div 
        ref={boardRef}
        className="relative"
        style={{ width: BOARD_SIZE, height: BOARD_SIZE }}
      >
        {/* Render placed dominoes */}
        {Object.entries(gameState.dominoes).map(([id, domino]) => (
          <div
            key={id}
            className="absolute"
            style={{
              left: BOARD_SIZE / 2 + domino.x * CELL_SIZE,
              top: BOARD_SIZE / 2 + domino.y * CELL_SIZE,
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
                left: BOARD_SIZE / 2 + (x + size[0] / 2) * CELL_SIZE,
                top: BOARD_SIZE / 2 + (y + size[1] / 2) * CELL_SIZE,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};