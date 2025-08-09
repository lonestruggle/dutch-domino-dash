import React, { useRef, useEffect } from 'react';
import { DominoTile } from './DominoTile';
import { PlacementTarget } from './PlacementTarget';
import { GameVisualControls } from './GameVisualControls';
import { GameState, LegalMove } from '@/types/domino';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGameVisualSettings } from '@/hooks/useGameVisualSettings';
import { cn } from '@/lib/utils';
import dominoTable1 from '@/assets/domino-table-1.webp';
import dominoTable2 from '@/assets/domino-table-2.webp';
const curacaoFlagTable = '/lovable-uploads/f85e0ba4-a21e-4716-b54c-d9c55efc9496.png';
const premiumWoodTable = '/lovable-uploads/06c1799a-c59e-44f8-8d9c-3cc8d671f4c2.png';

interface GameBoardProps {
  gameState: GameState;
  legalMoves: LegalMove[];
  onMoveExecute: (move: LegalMove) => void;
  onCenterView: () => void;
  hasDifferentNeighbor: (x: number, y: number) => boolean;
  backgroundChoice?: string;
  tableBackgroundUrl?: string;
  onRotateDomino?: (dominoId: string) => void;
}

// Original PC constants - exactly as in original HTML domino game
const CELL_SIZE = 48;
const MIN_SCALE = 0.25;
const MAX_SCALE = 1.0;
const MIN_BOARD_SIZE = 1200;
const PADDING = 400;
const SCROLL_PADDING = 200;

export const GameBoard: React.FC<GameBoardProps> = ({ 
  gameState, 
  legalMoves, 
  onMoveExecute, 
  onCenterView, 
  hasDifferentNeighbor, 
  backgroundChoice = 'domino-table-2',
  tableBackgroundUrl,
  onRotateDomino
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { settings } = useGameVisualSettings();

  // Standard domino size for mobile - like real dominoes
  const calculateDominoScale = () => {
    if (!isMobile) return 1; // PC unchanged
    
    // Standard domino size for mobile - readable and playable like real dominoes
    return 1.0; // Full size dominoes on mobile for best visibility and usability
  };

  // Update CSS scaling
  const updateDominoScaling = () => {
    const baseScale = calculateDominoScale();
    const userScale = settings.dominoScale;
    const finalScale = baseScale * userScale;
    const selectedScale = finalScale * 1.05;
    const hoverScale = finalScale;
    const targetScale = finalScale;
    
    const rootElement = document.documentElement;
    rootElement.style.setProperty('--domino-scale', finalScale.toString());
    rootElement.style.setProperty('--domino-scale-selected', selectedScale.toString());
    rootElement.style.setProperty('--domino-scale-hover', hoverScale.toString());
    rootElement.style.setProperty('--domino-target-scale', targetScale.toString());
    rootElement.style.setProperty('--hand-domino-scale', finalScale.toString());
    
    if (boardRef.current) {
      boardRef.current.offsetHeight;
    }
  };

  useEffect(() => {
    updateDominoScaling();
    const handleResize = () => updateDominoScaling();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile, settings.dominoScale]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => updateDominoScaling());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [settings.dominoScale]);

  useEffect(() => {
    updateDominoScaling();
  }, [gameState.dominoes, settings.dominoScale]);

  // Original PC logic for board size calculation
  const calculateOptimalScale = () => {
    if (!containerRef.current || Object.keys(gameState.dominoes).length === 0) {
      return MAX_SCALE;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const availableWidth = containerRect.width;
    const availableHeight = containerRect.height;

    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    
    Object.values(gameState.dominoes).forEach(domino => {
      const dominoWidth = domino.orientation === 'horizontal' ? 2 : 1;
      const dominoHeight = domino.orientation === 'vertical' ? 2 : 1;
      
      minX = Math.min(minX, domino.x);
      maxX = Math.max(maxX, domino.x + dominoWidth - 1);
      minY = Math.min(minY, domino.y);
      maxY = Math.max(maxY, domino.y + dominoHeight - 1);
    });

    const extraPadding = 4;
    const requiredWidth = (maxX - minX + 1 + extraPadding * 2) * CELL_SIZE;
    const requiredHeight = (maxY - minY + 1 + extraPadding * 2) * CELL_SIZE;

    const scaleX = availableWidth / requiredWidth;
    const scaleY = availableHeight / requiredHeight;
    const optimalScale = Math.min(scaleX, scaleY, MAX_SCALE);

    return Math.max(optimalScale, MIN_SCALE);
  };

  // Original PC logic for board size
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

  // Original PC viewport calculation
  const calculateOptimalViewport = () => {
    if (!containerRef.current) return null;

    const dominoes = Object.values(gameState.dominoes);
    if (dominoes.length === 0) return null;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    dominoes.forEach(domino => {
      const dominoWidth = domino.orientation === 'horizontal' ? 2 : 1;
      const dominoHeight = domino.orientation === 'vertical' ? 2 : 1;
      
      minX = Math.min(minX, domino.x);
      maxX = Math.max(maxX, domino.x + dominoWidth - 1);
      minY = Math.min(minY, domino.y);
      maxY = Math.max(maxY, domino.y + dominoHeight - 1);
    });

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

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const boardSize = calculateBoardSize();
    
    const pixelCenterX = boardSize / 2 + centerX * CELL_SIZE;
    const pixelCenterY = boardSize / 2 + centerY * CELL_SIZE;
    
    const optimalScrollX = pixelCenterX - containerRect.width / 2;
    const optimalScrollY = pixelCenterY - containerRect.height / 2;
    
    return {
      scrollLeft: Math.max(0, optimalScrollX),
      scrollTop: Math.max(0, optimalScrollY)
    };
  };

  const boardSize = calculateBoardSize();
  const dynamicScale = calculateOptimalScale();

  const getBackgroundImage = (backgroundChoice?: string) => {
    const backgroundMap: { [key: string]: string } = {
      'domino-table-1': dominoTable1,
      'domino-table-2': dominoTable2,
      'curacao-flag-table': curacaoFlagTable,
      'premium-wood-table': premiumWoodTable
    };
    
    return backgroundMap[backgroundChoice || 'domino-table-2'] || dominoTable2;
  };

  const backgroundImage = getBackgroundImage(backgroundChoice);

  // Original PC auto-center logic
  useEffect(() => {
    if (!containerRef.current || Object.keys(gameState.dominoes).length === 0) return;
    
    const checkIfRecenterNeeded = () => {
      const containerRect = containerRef.current!.getBoundingClientRect();
      const currentScale = dynamicScale;
      const boardSize = calculateBoardSize();
      
      const dominoes = Object.values(gameState.dominoes);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      
      dominoes.forEach(domino => {
        const dominoWidth = domino.orientation === 'horizontal' ? 2 : 1;
        const dominoHeight = domino.orientation === 'vertical' ? 2 : 1;
        
        minX = Math.min(minX, domino.x);
        maxX = Math.max(maxX, domino.x + dominoWidth - 1);
        minY = Math.min(minY, domino.y);
        maxY = Math.max(maxY, domino.y + dominoHeight - 1);
      });
      
      legalMoves.forEach(move => {
        minX = Math.min(minX, move.x);
        maxX = Math.max(maxX, move.x + 1);
        minY = Math.min(minY, move.y);
        maxY = Math.max(maxY, move.y + 1);
      });
      
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      
      const pixelCenterX = boardSize / 2 + centerX * CELL_SIZE * currentScale;
      const pixelCenterY = boardSize / 2 + centerY * CELL_SIZE * currentScale;
      
      const optimalScrollX = pixelCenterX - containerRect.width / 2;
      const optimalScrollY = pixelCenterY - containerRect.height / 2;
      
      containerRef.current!.scrollTo({
        left: Math.max(0, optimalScrollX),
        top: Math.max(0, optimalScrollY),
        behavior: 'smooth'
      });
    };
    
    const timer = setTimeout(checkIfRecenterNeeded, 100);
    return () => clearTimeout(timer);
  }, [gameState.dominoes, legalMoves, dynamicScale]);

  // Original PC initial center logic
  useEffect(() => {
    if (containerRef.current && Object.keys(gameState.dominoes).length === 1) {
      const firstDomino = Object.values(gameState.dominoes)[0];
      const firstDominoX = firstDomino.x * CELL_SIZE * dynamicScale;
      const firstDominoY = firstDomino.y * CELL_SIZE * dynamicScale;
      
      setTimeout(() => {
        containerRef.current?.scrollTo({
          left: boardSize / 2 + firstDominoX - containerRef.current.clientWidth / 2,
          top: boardSize / 2 + firstDominoY - containerRef.current.clientHeight / 2,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [gameState.dominoes, dynamicScale, boardSize]);

  return (
    <div className="relative w-full max-w-4xl mx-auto aspect-square">
      <GameVisualControls />
      
      <div 
        ref={containerRef}
        className="w-full h-full game-board overflow-hidden rounded-2xl shadow-2xl"
        style={{ 
          background: tableBackgroundUrl 
            ? `linear-gradient(
                45deg,
                rgba(101, 67, 33, 0.15) 0%,
                rgba(160, 82, 45, 0.05) 50%,
                rgba(139, 69, 19, 0.1) 100%
              ),
              url(${tableBackgroundUrl})`
            : `
              linear-gradient(
                45deg,
                rgba(101, 67, 33, 0.15) 0%,
                rgba(160, 82, 45, 0.05) 50%,
                rgba(139, 69, 19, 0.1) 100%
              ),
              url(${backgroundImage})
            `,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          boxShadow: `
            inset 0 2px 8px rgba(101, 67, 33, 0.4),
            inset 0 -2px 8px rgba(62, 39, 35, 0.4),
            0 12px 40px rgba(0, 0, 0, 0.5),
            0 4px 16px rgba(101, 67, 33, 0.3)
          `
        }}
      >
        <div 
          ref={boardRef}
          className="relative w-full h-full"
          style={{ 
            width: boardSize, 
            height: boardSize,
            transform: `scale(${dynamicScale})`,
            transformOrigin: 'center'
          }}
        >
          {/* Original PC domino rendering */}
          {Object.entries(gameState.dominoes).map(([id, domino]) => {
            // Elke dominosteen krijgt zijn eigen willekeurige rotatie hoek (tussen 5 en 20 graden)
            const individualAngle = 5 + Math.random() * 15; // 5-20 graden
            // Elke dominosteen krijgt zijn eigen willekeurige duur (tussen 1 en 3 seconden)
            const individualDuration = 1 + Math.random() * 2; // 1-3 seconden
            
            return (
              <div
                key={id}
                className="absolute"
                style={{
                  left: boardSize / 2 + domino.x * CELL_SIZE,
                  top: boardSize / 2 + domino.y * CELL_SIZE,
                }}
              >
                <DominoTile
                  data={domino.data}
                  orientation={domino.orientation}
                  flipped={domino.flipped}
                  rotation={domino.rotation || 0}
                  isShaking={gameState.isHardSlamming}
                  onClick={undefined}
                  className="domino-tile-board"
                  style={{
                    '--individual-angle': `${individualAngle}deg`,
                    '--individual-duration': `${individualDuration}s`,
                  } as React.CSSProperties}
                />
              </div>
            );
          })}

          {/* Original PC placement target rendering */}
          {legalMoves.map((move, index) => {
            const { end } = move;
            
            if (hasDifferentNeighbor(end.x, end.y)) return null;
            if (gameState.forbiddens[`${end.x},${end.y}`]) return null;

            let { x, y } = end;
            const { orientation, dominoData } = move;
            const isDouble = dominoData.value1 === dominoData.value2;
            
            if (orientation === "horizontal" && end.fromDir === "W") x -= 1;
            if (orientation === "vertical" && end.fromDir === "N") y -= 1;

            const size = orientation === "horizontal" ? [2, 1] : [1, 2];
            const isInitialPlacement = Object.keys(gameState.dominoes).length === 0;

            return (
              <PlacementTarget
                key={`${end.x}-${end.y}-${index}`}
                x={x}
                y={y}
                width={size[0]}
                height={size[1]}
                orientation={orientation}
                isDouble={isDouble}
                isInitialPlacement={isInitialPlacement}
                onClick={() => onMoveExecute(move)}
                style={{
                  // Position exactly on grid coordinates - like dominos, no centering
                  left: boardSize / 2 + x * CELL_SIZE,
                  top: boardSize / 2 + y * CELL_SIZE,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};