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
  hardSlamMode?: boolean;
  isMyTurn?: boolean;
}

// Grid-based constants - each domino occupies 2 grid cells
// GRID_CELL_SIZE is now dynamic based on settings
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
  onRotateDomino,
  hardSlamMode,
  isMyTurn = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { settings, applyOriginalRotations, isAnimating, animationMode } = useGameVisualSettings();
  
  // Dynamic grid cell size based on settings - each domino = 2 grid cells
  const GRID_CELL_SIZE = settings.dominoWidth / 2;


  // Listen for live settings updates and reapply scaling
  useEffect(() => {
    const handleAnyUpdate = () => {
      updateDominoScaling();
    };

    return () => {
      window.removeEventListener('vibrationSettingsUpdated', handleAnyUpdate);
      window.removeEventListener('visualSettingsUpdated', handleAnyUpdate);
    };
  }, [gameState]);

  // Base domino scale - allow user settings to take effect
  const calculateDominoScale = () => {
    // Return base scale of 1.0 to let user dominoScale setting control the size
    return 1.0; // Base scale - user settings will be applied on top of this
  };

  // Update CSS scaling
  const updateDominoScaling = () => {
    // Prefer globally broadcast settings to ensure live updates across components
    const latest = (() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (window as any).__dominoSettings || settings;
      } catch {
        return settings;
      }
    })();

    const baseScale = calculateDominoScale();
    const userScale = latest.dominoScale;
    const finalScale = baseScale * userScale;
    const selectedScale = finalScale * 1.05;
    const hoverScale = finalScale;
    
    const rootElement = document.documentElement;
    rootElement.style.setProperty('--domino-scale', finalScale.toString());
    rootElement.style.setProperty('--domino-scale-selected', selectedScale.toString());
    rootElement.style.setProperty('--domino-scale-hover', hoverScale.toString());
    // IMPORTANT: Hand domino scale must be independent from board scale
    rootElement.style.setProperty('--hand-domino-scale', (latest.handDominoScale || 1).toString());
    
    // Apply global domino dimension settings
    rootElement.style.setProperty('--domino-width', (latest.dominoWidth || 80).toString() + 'px');
    rootElement.style.setProperty('--domino-height', (latest.dominoHeight || 40).toString() + 'px');
    rootElement.style.setProperty('--domino-thickness', (latest.dominoThickness || 8).toString() + 'px');
    
    // Calculate dynamic double offset for proper centering (based on grid cell size)
    const doubleOffset = GRID_CELL_SIZE / 2;
    rootElement.style.setProperty('--double-offset', `-${doubleOffset}px`);
    
    if (boardRef.current) {
      boardRef.current.offsetHeight;
    }
  };

  useEffect(() => {
    updateDominoScaling();
    const handleResize = () => updateDominoScaling();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile, settings.dominoScale, settings.dominoWidth, settings.dominoHeight, settings.dominoThickness]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => updateDominoScaling());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [settings.dominoScale, settings.dominoWidth, settings.dominoHeight, settings.dominoThickness]);

  useEffect(() => {
    updateDominoScaling();
    // Apply original rotations after rendering new dominoes
    const timer = setTimeout(() => {
      applyOriginalRotations();
    }, 100);
    return () => clearTimeout(timer);
  }, [gameState.dominoes, settings.dominoScale, settings.dominoWidth, settings.dominoHeight, settings.dominoThickness, applyOriginalRotations]);
  // Note: hardSlamMode is intentionally NOT in dependencies - we only want to trigger on new dominoes

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
    const requiredWidth = (maxX - minX + 1 + extraPadding * 2) * GRID_CELL_SIZE;
    const requiredHeight = (maxY - minY + 1 + extraPadding * 2) * GRID_CELL_SIZE;

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

    const requiredWidth = (maxX - minX + 1) * GRID_CELL_SIZE + PADDING * 2;
    const requiredHeight = (maxY - minY + 1) * GRID_CELL_SIZE + PADDING * 2;
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
    
    const pixelCenterX = boardSize / 2 + centerX * GRID_CELL_SIZE;
    const pixelCenterY = boardSize / 2 + centerY * GRID_CELL_SIZE;
    
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
      
      const pixelCenterX = boardSize / 2 + centerX * GRID_CELL_SIZE * currentScale;
      const pixelCenterY = boardSize / 2 + centerY * GRID_CELL_SIZE * currentScale;
      
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
      const firstDominoX = firstDomino.x * GRID_CELL_SIZE * dynamicScale;
      const firstDominoY = firstDomino.y * GRID_CELL_SIZE * dynamicScale;
      
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
            
            // Connect to actual animation state from useGameVisualSettings
            const shouldAnimate = isAnimating && animationMode === 'shake';
            const selectedAnimation = shouldAnimate ? 'shake' : 'none';
            
            return (
              <div
                key={id}
                className="absolute"
                style={{
                  left: boardSize / 2 + domino.x * GRID_CELL_SIZE,
                  top: boardSize / 2 + domino.y * GRID_CELL_SIZE,
                }}
              >
                <DominoTile
                  data={domino.data}
                  orientation={domino.orientation}
                  flipped={domino.flipped}
                  rotation={domino.rotation || 0}
                  rotateX={(domino.rotationX !== undefined ? domino.rotationX : settings.rotateX)}
                  rotateY={(domino.rotationY !== undefined ? domino.rotationY : settings.rotateY)}
                  rotateZ={(domino.rotationZ !== undefined ? domino.rotationZ : settings.rotateZ)}
                  isShaking={shouldAnimate}
                  onClick={undefined}
                  className="domino-tile-board board-domino"
                  style={{
                    '--individual-angle': `${individualAngle}deg`,
                  } as React.CSSProperties}
                />
              </div>
            );
          })}

          {/* Original PC placement target rendering */}
          {legalMoves.map((move, index) => {
            const { end } = move;
            
            if (!end.forced && hasDifferentNeighbor(end.x, end.y)) return null;
            if (!end.forced && gameState.forbiddens[`${end.x},${end.y}`]) return null;

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
                  left: boardSize / 2 + x * GRID_CELL_SIZE,
                  top: boardSize / 2 + y * GRID_CELL_SIZE,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};