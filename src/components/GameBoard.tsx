
import React, { useRef, useEffect, useState } from 'react';
import { DominoTile } from './DominoTile';
import { PlacementTarget } from './PlacementTarget';
import { GameState, LegalMove } from '@/types/domino';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import dominoTable1 from '@/assets/domino-table-1.webp';
import dominoTable2 from '@/assets/domino-table-2.webp';
import dominoTable3 from '@/assets/domino-table-3.webp';
const curacaoFlagTable = '/lovable-uploads/f85e0ba4-a21e-4716-b54c-d9c55efc9496.png';

interface GameBoardProps {
  gameState: GameState;
  legalMoves: LegalMove[];
  onMoveExecute: (move: LegalMove) => void;
  onCenterView: () => void;
  hasDifferentNeighbor: (x: number, y: number) => boolean;
  backgroundChoice?: string;
}

// Responsive cell sizes
const DESKTOP_CELL_SIZE = 48;
const MOBILE_CELL_SIZE = 32;

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  legalMoves,
  onMoveExecute,
  onCenterView,
  hasDifferentNeighbor,
  backgroundChoice = 'domino-table-2'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
  // Responsive cell size
  const CELL_SIZE = isMobile ? MOBILE_CELL_SIZE : DESKTOP_CELL_SIZE;

  // Calculate board size to fit the container perfectly
  const calculateBoardSize = () => {
    if (!containerSize.width || !containerSize.height) {
      return { width: 800, height: 600 };
    }
    
    // Use the full container size minus some padding
    const padding = isMobile ? 20 : 40;
    return {
      width: containerSize.width - padding,
      height: containerSize.height - padding
    };
  };

  // Calculate view transform to center dominoes in the container
  const calculateViewTransform = () => {
    const dominoes = Object.values(gameState.dominoes);
    if (dominoes.length === 0) {
      return { translateX: 0, translateY: 0 };
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    // Include placed dominoes
    dominoes.forEach(domino => {
      const dominoWidth = domino.orientation === 'horizontal' ? 2 : 1;
      const dominoHeight = domino.orientation === 'vertical' ? 2 : 1;
      
      minX = Math.min(minX, domino.x);
      maxX = Math.max(maxX, domino.x + dominoWidth - 1);
      minY = Math.min(minY, domino.y);
      maxY = Math.max(maxY, domino.y + dominoHeight - 1);
    });

    // Include legal move positions for better centering
    legalMoves.forEach(move => {
      const { end } = move;
      let { x, y } = end;
      const { orientation } = move;
      
      if (orientation === "horizontal" && end.fromDir === "W") x -= 1;
      if (orientation === "vertical" && end.fromDir === "N") y -= 1;

      const width = orientation === "horizontal" ? 2 : 1;
      const height = orientation === "vertical" ? 2 : 1;
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + width - 1);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + height - 1);
    });

    // Calculate the center of all game content
    const contentCenterX = (minX + maxX) / 2 * CELL_SIZE;
    const contentCenterY = (minY + maxY) / 2 * CELL_SIZE;
    
    const boardSize = calculateBoardSize();
    
    // Center the content within the board
    const translateX = (boardSize.width / 2) - contentCenterX;
    const translateY = (boardSize.height / 2) - contentCenterY;
    
    return { translateX, translateY };
  };

  const boardSize = calculateBoardSize();
  const viewTransform = calculateViewTransform();
  
  // Track container size changes
  useEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    
    updateContainerSize();
    window.addEventListener('resize', updateContainerSize);
    
    // Use ResizeObserver for more accurate tracking
    let resizeObserver: ResizeObserver;
    if (containerRef.current) {
      resizeObserver = new ResizeObserver(updateContainerSize);
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', updateContainerSize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  // Get the background image based on the choice
  const getBackgroundImage = () => {
    switch (backgroundChoice) {
      case 'domino-table-1':
        return dominoTable1;
      case 'domino-table-2':
        return dominoTable2;
      case 'domino-table-3':
        return dominoTable3;
      case 'curacao-flag-table':
        return curacaoFlagTable;
      default:
        return dominoTable2; // Default to table 2 (walnoot)
    }
  };

  const backgroundImage = getBackgroundImage();

  // No need for auto-scroll anymore since everything fits on screen

  return (
    <div 
      ref={containerRef}
      className="relative w-full game-board border-2 border-border rounded-lg overflow-hidden mb-4"
      style={{ 
        height: isMobile ? '50vh' : '60vh',
        minHeight: isMobile ? '300px' : '400px',
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div 
        ref={boardRef}
        className="relative w-full h-full"
        style={{ 
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Render placed dominoes */}
        {Object.entries(gameState.dominoes).map(([id, domino]) => (
          <div
            key={id}
            className="absolute"
            style={{
              left: domino.x * CELL_SIZE + viewTransform.translateX,
              top: domino.y * CELL_SIZE + viewTransform.translateY,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <DominoTile
              data={domino.data}
              orientation={domino.orientation}
              flipped={domino.flipped}
              rotation={domino.rotation || 0}
              isShaking={gameState.isHardSlamming}
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
                left: (x + size[0] / 2) * CELL_SIZE + viewTransform.translateX,
                top: (y + size[1] / 2) * CELL_SIZE + viewTransform.translateY,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
