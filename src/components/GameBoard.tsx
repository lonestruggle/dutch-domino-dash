
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
  tableBackgroundUrl?: string; // Aparte achtergrond voor achter de tafel
  onRotateDomino?: (dominoId: string) => void;
}

// Mobile-responsive grid sizing constants
const DESKTOP_CELL_SIZE = 48;
const MOBILE_CELL_SIZE = 28; // Much smaller cells on mobile for compact grid  
const MIN_SCALE = 0.25;
const MAX_SCALE = 1.0;
const DESKTOP_MIN_BOARD_SIZE = 1200;
const MOBILE_MIN_BOARD_SIZE = 600; // Much smaller board on mobile
const DESKTOP_PADDING = 400;
const MOBILE_PADDING = 100; // Much less padding on mobile
const SCROLL_PADDING = 50; // Smaller scroll padding for mobile

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

  // Get responsive values based on device
  const CELL_SIZE = isMobile ? MOBILE_CELL_SIZE : DESKTOP_CELL_SIZE;
  const MIN_BOARD_SIZE = isMobile ? MOBILE_MIN_BOARD_SIZE : DESKTOP_MIN_BOARD_SIZE;
  const PADDING = isMobile ? MOBILE_PADDING : DESKTOP_PADDING;

  // Calculate responsive domino scale based on viewport size
  const calculateDominoScale = () => {
    if (!containerRef.current) return 1;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Base scale factors
    let baseScale = 1;
    
    if (isMobile) {
      // On mobile, scale based on screen size
      // Smaller screens get bigger dominoes for better visibility
      if (viewportWidth < 400) {
        baseScale = 2.5;
      } else if (viewportWidth < 500) {
        baseScale = 2.2;
      } else if (viewportWidth < 600) {
        baseScale = 1.8;
      } else {
        baseScale = 1.5;
      }
    } else {
      // On desktop, scale based on container size
      // Smaller containers get slightly bigger dominoes
      if (containerRect.width < 400) {
        baseScale = 1.3;
      } else if (containerRect.width < 600) {
        baseScale = 1.1;
      } else {
        baseScale = 1;
      }
    }
    
    return baseScale;
  };

  // Update CSS custom properties for responsive scaling
  const updateDominoScaling = () => {
    const baseScale = calculateDominoScale();
    const userScale = settings.dominoScale;
    const finalScale = baseScale * userScale;
    const selectedScale = finalScale * 1.05;
    const hoverScale = finalScale;
    const targetScale = finalScale * 0.8; // Placement targets schaalt iets minder voor betere visibility
    
    // Force immediate updates with direct DOM manipulation
    const rootElement = document.documentElement;
    rootElement.style.setProperty('--domino-scale', finalScale.toString());
    rootElement.style.setProperty('--domino-scale-selected', selectedScale.toString());
    rootElement.style.setProperty('--domino-scale-hover', hoverScale.toString());
    rootElement.style.setProperty('--domino-target-scale', targetScale.toString());
    
    // Force reflow to ensure immediate visual update
    if (boardRef.current) {
      boardRef.current.offsetHeight;
    }
    
    // Debug logging
    console.log('Visual settings applied:', {
      dominoScale: settings.dominoScale,
      deviceType: 'current device'
    });
  };

  // Update scaling on mount and when viewport changes
  useEffect(() => {
    updateDominoScaling();
    
    const handleResize = () => {
      updateDominoScaling();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile, settings.dominoScale]);

  // Update scaling when container size changes
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver(() => {
      updateDominoScaling();
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [settings.dominoScale]);

  // Update scaling when game state changes (more dominoes = potentially different optimal scale)
  useEffect(() => {
    updateDominoScaling();
  }, [gameState.dominoes, settings.dominoScale]);

  // Calculate dynamic board size based on domino positions
  const calculateOptimalScale = () => {
    if (!containerRef.current || Object.keys(gameState.dominoes).length === 0) {
      return isMobile ? 1.2 : MAX_SCALE; // Verhoogd voor mobiel zodat center zichtbaar is
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

    // Add padding for future moves
    const extraPadding = 4; // cells for future expansion
    const requiredWidth = (maxX - minX + 1 + extraPadding * 2) * CELL_SIZE;
    const requiredHeight = (maxY - minY + 1 + extraPadding * 2) * CELL_SIZE;

    // Calculate scale needed to fit
    const scaleX = availableWidth / requiredWidth;
    const scaleY = availableHeight / requiredHeight;
    const optimalScale = Math.min(scaleX, scaleY, MAX_SCALE);

    // Clamp to minimum scale
    return Math.max(optimalScale, MIN_SCALE);
  };

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

    const minBoardSize = MIN_BOARD_SIZE;
    
    const requiredWidth = (maxX - minX + 1) * CELL_SIZE + PADDING * 2;
    const requiredHeight = (maxY - minY + 1) * CELL_SIZE + PADDING * 2;
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
    const pixelCenterX = boardSize / 2 + centerX * CELL_SIZE;
    const pixelCenterY = boardSize / 2 + centerY * CELL_SIZE;
    
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
  const dynamicScale = calculateOptimalScale();

  // Get the background image URL based on the choice
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


  // Auto-center wanneer stenen of legal moves te dicht bij de rand komen
  useEffect(() => {
    if (!containerRef.current || Object.keys(gameState.dominoes).length === 0) return;
    
    const checkIfRecenterNeeded = () => {
      const containerRect = containerRef.current!.getBoundingClientRect();
      const currentScale = dynamicScale;
      const boardSize = calculateBoardSize();
      
      // Controleer alle dominostenen
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
      
      // Voeg legal moves toe aan de grenzen
      legalMoves.forEach(move => {
        minX = Math.min(minX, move.x);
        maxX = Math.max(maxX, move.x + 1);
        minY = Math.min(minY, move.y);
        maxY = Math.max(maxY, move.y + 1);
      });
      
      // Bereken het centrum van alle content
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      
      // Converteer naar pixel coördinaten
      const pixelCenterX = boardSize / 2 + centerX * CELL_SIZE * currentScale;
      const pixelCenterY = boardSize / 2 + centerY * CELL_SIZE * currentScale;
      
      // Bereken optimale scroll positie om alles gecentreerd te houden
      const optimalScrollX = pixelCenterX - containerRect.width / 2;
      const optimalScrollY = pixelCenterY - containerRect.height / 2;
      
      // Centreer smooth
      containerRef.current!.scrollTo({
        left: Math.max(0, optimalScrollX),
        top: Math.max(0, optimalScrollY),
        behavior: 'smooth'
      });
    };
    
    // Check en hercentreer na elke domino plaatsing of legal move wijziging
    const timer = setTimeout(checkIfRecenterNeeded, 100);
    return () => clearTimeout(timer);
  }, [gameState.dominoes, legalMoves, dynamicScale]);

  // Initial center when game starts
  useEffect(() => {
    if (containerRef.current && Object.keys(gameState.dominoes).length === 1) {
      // Voor de eerste domino, hercentreer het grid op de positie van de eerste steen
      const firstDomino = Object.values(gameState.dominoes)[0];
      const firstDominoX = firstDomino.x * CELL_SIZE * dynamicScale;
      const firstDominoY = firstDomino.y * CELL_SIZE * dynamicScale;
      
      // Centreer de view op de eerste domino
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
      {/* Visual Controls Button */}
      <GameVisualControls />
      
      {/* Unifieke Tafel - één samenhangende oppervlak */}
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
        {/* Render placed dominoes */}
        {Object.entries(gameState.dominoes).map(([id, domino]) => {
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

          const size = orientation === "horizontal" ? [2, 1] : [1, 2];
          
          // Check if this is initial placement (no dominoes on board yet)
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
                left: boardSize / 2 + (x + size[0] / 2) * CELL_SIZE,
                top: boardSize / 2 + (y + size[1] / 2) * CELL_SIZE,
              }}
            />
          );
        })}
        </div>
      </div>
    </div>
  );
};
