import React, { useRef, useEffect, useState } from 'react';
import { DominoTile } from './DominoTile';
import { PlacementTarget } from './PlacementTarget';
import { GameState, LegalMove } from '@/types/domino';
import { cn } from '@/lib/utils';
import dominoTable1 from '@/assets/domino-table-1.webp';
import dominoTable2 from '@/assets/domino-table-2.webp';
import dominoTable3 from '@/assets/domino-table-3.webp';
const curacaoFlagTable = '/lovable-uploads/f85e0ba4-a21e-4716-b54c-d9c55efc9496.png';

interface SquareGameBoardProps {
  gameState: GameState;
  legalMoves: LegalMove[];
  onMoveExecute: (move: LegalMove) => void;
  onCenterView: () => void;
  hasDifferentNeighbor: (x: number, y: number) => boolean;
  backgroundChoice?: string;
}

export const SquareGameBoard: React.FC<SquareGameBoardProps> = ({
  gameState,
  legalMoves,
  onMoveExecute,
  onCenterView,
  hasDifferentNeighbor,
  backgroundChoice = 'domino-table-2'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  
  // Fixed table dimensions - vierkante tafel
  const TABLE_SIZE = 600;
  const CELL_SIZE = 24; // Smaller cells to fit more dominoes
  const GRID_SIZE = 25; // Larger grid for more space
  const CENTER_OFFSET = Math.floor(GRID_SIZE / 2);
  
  // Calculate scale to fit container
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      
      const container = containerRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      // Calculate scale to fit with some padding
      const scaleX = (containerWidth - 20) / TABLE_SIZE;
      const scaleY = (containerHeight - 20) / TABLE_SIZE;
      const newScale = Math.min(scaleX, scaleY, 1); // Never scale up
      
      setScale(newScale);
    };
    
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // Convert world coordinates to table coordinates
  const worldToTable = (x: number, y: number) => {
    const tableX = CENTER_OFFSET + x;
    const tableY = CENTER_OFFSET + y;
    return { x: tableX, y: tableY };
  };

  // Check if coordinates are within table bounds
  const isWithinBounds = (tableX: number, tableY: number, width = 1, height = 1) => {
    return tableX >= 0 && tableY >= 0 && 
           tableX + width <= GRID_SIZE && 
           tableY + height <= GRID_SIZE;
  };

  // Get background image
  const getBackgroundImage = () => {
    switch (backgroundChoice) {
      case 'domino-table-1': return dominoTable1;
      case 'domino-table-2': return dominoTable2;
      case 'domino-table-3': return dominoTable3;
      case 'curacao-flag-table': return curacaoFlagTable;
      default: return dominoTable2;
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center bg-muted/20 rounded-lg overflow-hidden"
    >
      {/* Square table container */}
      <div 
        className="relative bg-cover bg-center bg-no-repeat rounded-lg shadow-2xl border-4 border-border"
        style={{ 
          width: TABLE_SIZE,
          height: TABLE_SIZE,
          transform: `scale(${scale})`,
          backgroundImage: `url(${getBackgroundImage()})`,
          transformOrigin: 'center center'
        }}
      >
        {/* Grid overlay (optional - for debugging) */}
        <div className="absolute inset-0 opacity-5">
          {Array.from({ length: GRID_SIZE + 1 }).map((_, i) => (
            <React.Fragment key={i}>
              {/* Vertical lines */}
              <div 
                className="absolute bg-foreground/20"
                style={{
                  left: (i * CELL_SIZE),
                  top: 0,
                  width: 1,
                  height: '100%'
                }}
              />
              {/* Horizontal lines */}
              <div 
                className="absolute bg-foreground/20"
                style={{
                  left: 0,
                  top: (i * CELL_SIZE),
                  width: '100%',
                  height: 1
                }}
              />
            </React.Fragment>
          ))}
        </div>

        {/* Render placed dominoes */}
        {Object.entries(gameState.dominoes).map(([id, domino]) => {
          const tablePos = worldToTable(domino.x, domino.y);
          const width = domino.orientation === 'horizontal' ? 2 : 1;
          const height = domino.orientation === 'vertical' ? 2 : 1;
          
          // Only render if within bounds
          if (!isWithinBounds(tablePos.x, tablePos.y, width, height)) {
            return null;
          }

          return (
            <div
              key={id}
              className="absolute"
              style={{
                left: tablePos.x * CELL_SIZE,
                top: tablePos.y * CELL_SIZE,
                transform: scale < 0.8 ? 'scale(0.9)' : 'scale(1)',
                transformOrigin: 'top left'
              }}
            >
              <DominoTile
                data={domino.data}
                orientation={domino.orientation}
                flipped={domino.flipped}
                rotation={domino.rotation || 0}
                isShaking={gameState.isHardSlamming}
                className="shadow-lg"
              />
            </div>
          );
        })}

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

          const tablePos = worldToTable(x, y);
          const width = orientation === "horizontal" ? 2 : 1;
          const height = orientation === "vertical" ? 2 : 1;
          
          // Only render if within bounds
          if (!isWithinBounds(tablePos.x, tablePos.y, width, height)) {
            return null;
          }

          return (
            <PlacementTarget
              key={`${end.x}-${end.y}-${index}`}
              x={tablePos.x}
              y={tablePos.y}
              width={width}
              height={height}
              orientation={orientation}
              isDouble={isDouble}
              onClick={() => onMoveExecute(move)}
              style={{
                left: tablePos.x * CELL_SIZE,
                top: tablePos.y * CELL_SIZE,
                transform: scale < 0.8 ? 'scale(0.9)' : 'scale(1)',
                transformOrigin: 'top left'
              }}
            />
          );
        })}

        {/* Center dot for reference */}
        <div 
          className="absolute w-2 h-2 bg-primary/30 rounded-full"
          style={{
            left: CENTER_OFFSET * CELL_SIZE - 1,
            top: CENTER_OFFSET * CELL_SIZE - 1
          }}
        />
      </div>

      {/* Scale indicator for small screens */}
      {scale < 1 && (
        <div className="absolute bottom-2 right-2 text-xs bg-background/80 px-2 py-1 rounded">
          {Math.round(scale * 100)}%
        </div>
      )}
    </div>
  );
};