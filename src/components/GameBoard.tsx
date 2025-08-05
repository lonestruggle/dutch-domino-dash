
import React, { useRef, useEffect } from 'react';
import { DominoTile } from './DominoTile';
import { PlacementTarget } from './PlacementTarget';
import { GameState, LegalMove } from '@/types/domino';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
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

const CELL_SIZE = 48;
const MOBILE_CELL_SIZE = 18; // Much smaller to prevent overlap with scale-[0.5]
const MIN_BOARD_SIZE = 1200; // Increased for more scroll space
const MIN_MOBILE_BOARD_SIZE = 800; // Smaller board on mobile
const PADDING = 400; // Increased padding for better scroll area
const MOBILE_PADDING = 200; // Smaller padding on mobile
const SCROLL_PADDING = 200; // Extra padding for scroll calculations

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

  // Calculate dynamic board size based on domino positions
  const calculateBoardSize = () => {
    if (Object.keys(gameState.dominoes).length === 0) {
      return isMobile ? MIN_MOBILE_BOARD_SIZE : MIN_BOARD_SIZE;
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

    const cellSize = isMobile ? MOBILE_CELL_SIZE : CELL_SIZE;
    const padding = isMobile ? MOBILE_PADDING : PADDING;
    const minBoardSize = isMobile ? MIN_MOBILE_BOARD_SIZE : MIN_BOARD_SIZE;
    
    const requiredWidth = (maxX - minX + 1) * cellSize + padding * 2;
    const requiredHeight = (maxY - minY + 1) * cellSize + padding * 2;
    const requiredSize = Math.max(requiredWidth, requiredHeight, minBoardSize);
    
    return Math.max(requiredSize, minBoardSize);
  };

  // Calculate optimal viewport center based on all dominoes and legal moves
  const calculateOptimalViewport = () => {
    if (!containerRef.current) return null;

    const dominoes = Object.values(gameState.dominoes);
    if (dominoes.length === 0) return null;

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

    // Include legal move positions for better viewport planning
    legalMoves.forEach(move => {
      const { end } = move;
      let { x, y } = end;
      const { orientation } = move;
      
      // Adjust position based on direction (same logic as in render)
      if (orientation === "horizontal" && end.fromDir === "W") x -= 1;
      if (orientation === "vertical" && end.fromDir === "N") y -= 1;

      const width = orientation === "horizontal" ? 2 : 1;
      const height = orientation === "vertical" ? 2 : 1;
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + width - 1);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + height - 1);
    });

    // Calculate center point with extra padding
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const boardSize = calculateBoardSize();
    
    // Convert grid coordinates to pixel coordinates
    const cellSize = isMobile ? MOBILE_CELL_SIZE : CELL_SIZE;
    const pixelCenterX = boardSize / 2 + centerX * cellSize;
    const pixelCenterY = boardSize / 2 + centerY * cellSize;
    
    // Calculate optimal scroll position (center the viewport on the content center)
    const optimalScrollX = pixelCenterX - containerRect.width / 2;
    const optimalScrollY = pixelCenterY - containerRect.height / 2;
    
    return {
      scrollLeft: Math.max(0, optimalScrollX),
      scrollTop: Math.max(0, optimalScrollY)
    };
  };

  // Auto-scroll to optimal viewport
  const autoScroll = () => {
    if (!containerRef.current) return;
    
    const viewport = calculateOptimalViewport();
    if (!viewport) return;

    containerRef.current.scrollTo({
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
      behavior: 'smooth'
    });
  };

  const boardSize = calculateBoardSize();

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

  // Auto-scroll when dominoes change or legal moves change
  useEffect(() => {
    // Small delay to ensure DOM is updated
    const timer = setTimeout(() => {
      autoScroll();
    }, 100);

    return () => clearTimeout(timer);
  }, [gameState.dominoes, legalMoves]);

  // Initial center when game starts
  useEffect(() => {
    if (containerRef.current && Object.keys(gameState.dominoes).length === 1) {
      // For the first domino, center it properly
      setTimeout(() => {
        containerRef.current?.scrollTo({
          left: boardSize / 2 - 200,
          top: boardSize / 2 - 200,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [gameState.dominoes, boardSize]);

  return (
    <div 
      ref={containerRef}
      className={`relative w-full flex-1 game-board border-2 border-border rounded-lg overflow-auto ${isMobile ? "mb-2" : "mb-4"}`}
      style={{ 
        scrollBehavior: 'smooth',
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        height: isMobile ? '40vh' : 'auto'
      }}
    >
      <div 
        ref={boardRef}
        className="relative"
        style={{ 
          width: boardSize, 
          height: boardSize,
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Render placed dominoes */}
        {Object.entries(gameState.dominoes).map(([id, domino]) => {
          const cellSize = isMobile ? MOBILE_CELL_SIZE : CELL_SIZE;
          return (
            <div
              key={id}
              className="absolute"
              style={{
                left: boardSize / 2 + domino.x * cellSize,
                top: boardSize / 2 + domino.y * cellSize,
              }}
            >
              <DominoTile
                data={domino.data}
                orientation={domino.orientation}
                flipped={domino.flipped}
                rotation={domino.rotation || 0}
                isShaking={gameState.isHardSlamming}
                className={isMobile ? "!scale-[0.5] transform" : ""}
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
          const cellSize = isMobile ? MOBILE_CELL_SIZE : CELL_SIZE;
          
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
                left: boardSize / 2 + (x + size[0] / 2) * cellSize,
                top: boardSize / 2 + (y + size[1] / 2) * cellSize,
              }}
              className={isMobile ? "scale-75" : ""}
            />
          );
        })}
      </div>
    </div>
  );
};
