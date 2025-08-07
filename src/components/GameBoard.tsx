
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
  onRotateDomino?: (dominoId: string) => void;
}

const CELL_SIZE = 48;
const MIN_SCALE = 0.25; // Maximum 4x smaller
const MAX_SCALE = 1.0; // Original size
const MIN_BOARD_SIZE = 1200; // Increased for more scroll space
const MIN_MOBILE_BOARD_SIZE = 800; // Larger board on mobile for better gameplay
const PADDING = 400; // Increased padding for better scroll area
const MOBILE_PADDING = 150; // Better padding on mobile
const SCROLL_PADDING = 200; // Extra padding for scroll calculations

export const GameBoard: React.FC<GameBoardProps> = ({ 
  gameState, 
  legalMoves, 
  onMoveExecute, 
  onCenterView, 
  hasDifferentNeighbor, 
  backgroundChoice = 'domino-table-2',
  onRotateDomino
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

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

    const padding = isMobile ? MOBILE_PADDING : PADDING;
    const minBoardSize = isMobile ? MIN_MOBILE_BOARD_SIZE : MIN_BOARD_SIZE;
    
    const requiredWidth = (maxX - minX + 1) * CELL_SIZE + padding * 2;
    const requiredHeight = (maxY - minY + 1) * CELL_SIZE + padding * 2;
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
      {/* Vierkante Eikenhout Tafel */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-900 via-amber-800 to-yellow-900 rounded-2xl shadow-2xl p-12" 
           style={{
             background: `
               linear-gradient(135deg, 
                 hsl(30, 35%, 45%) 0%,
                 hsl(25, 40%, 40%) 25%,
                 hsl(20, 45%, 35%) 50%,
                 hsl(25, 40%, 40%) 75%,
                 hsl(30, 35%, 45%) 100%
               ),
               repeating-linear-gradient(90deg, 
                 transparent, 
                 transparent 2px, 
                 rgba(0,0,0,0.1) 2px, 
                 rgba(0,0,0,0.1) 3px
               )
             `,
             boxShadow: `
               inset 0 2px 4px rgba(139, 69, 19, 0.3),
               inset 0 -2px 4px rgba(101, 67, 33, 0.3),
               0 8px 32px rgba(0, 0, 0, 0.4)
             `
           }}>
        
        {/* Top vak voor dominostenen - eikenhout */}
        <div className="absolute top-6 left-20 right-20 h-20 rounded-lg shadow-inner border-2"
             style={{
               background: `linear-gradient(180deg, hsl(25, 30%, 30%) 0%, hsl(20, 35%, 25%) 100%)`,
               borderColor: 'hsl(20, 40%, 20%)',
               boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.4)'
             }}></div>
        
        {/* Right vak voor dominostenen - eikenhout */}
        <div className="absolute top-20 bottom-20 right-6 w-20 rounded-lg shadow-inner border-2"
             style={{
               background: `linear-gradient(90deg, hsl(25, 30%, 30%) 0%, hsl(20, 35%, 25%) 100%)`,
               borderColor: 'hsl(20, 40%, 20%)',
               boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.4)'
             }}></div>
        
        {/* Bottom vak voor dominostenen - eikenhout */}
        <div className="absolute bottom-6 left-20 right-20 h-20 rounded-lg shadow-inner border-2"
             style={{
               background: `linear-gradient(0deg, hsl(25, 30%, 30%) 0%, hsl(20, 35%, 25%) 100%)`,
               borderColor: 'hsl(20, 40%, 20%)',
               boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.4)'
             }}></div>
        
        {/* Left vak voor dominostenen - eikenhout */}
        <div className="absolute top-20 bottom-20 left-6 w-20 rounded-lg shadow-inner border-2"
             style={{
               background: `linear-gradient(270deg, hsl(25, 30%, 30%) 0%, hsl(20, 35%, 25%) 100%)`,
               borderColor: 'hsl(20, 40%, 20%)',
               boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.4)'
             }}></div>
        
        {/* Hoekversieringen - eikenhout met metalen accenten */}
        <div className="absolute top-6 left-6 w-14 h-14 rounded-full shadow-lg border-2"
             style={{
               background: `radial-gradient(circle, hsl(35, 50%, 55%) 0%, hsl(30, 45%, 45%) 100%)`,
               borderColor: 'hsl(20, 40%, 20%)'
             }}></div>
        <div className="absolute top-6 right-6 w-14 h-14 rounded-full shadow-lg border-2"
             style={{
               background: `radial-gradient(circle, hsl(35, 50%, 55%) 0%, hsl(30, 45%, 45%) 100%)`,
               borderColor: 'hsl(20, 40%, 20%)'
             }}></div>
        <div className="absolute bottom-6 left-6 w-14 h-14 rounded-full shadow-lg border-2"
             style={{
               background: `radial-gradient(circle, hsl(35, 50%, 55%) 0%, hsl(30, 45%, 45%) 100%)`,
               borderColor: 'hsl(20, 40%, 20%)'
             }}></div>
        <div className="absolute bottom-6 right-6 w-14 h-14 rounded-full shadow-lg border-2"
             style={{
               background: `radial-gradient(circle, hsl(35, 50%, 55%) 0%, hsl(30, 45%, 45%) 100%)`,
               borderColor: 'hsl(20, 40%, 20%)'
             }}></div>
        
        {/* Speelveld BINNEN de tafel - eikenhout finish */}
        <div 
          ref={containerRef}
          className={`w-full h-full game-board rounded-lg border-2 ${isMobile ? 'overflow-hidden' : 'overflow-auto'}`}
          style={{ 
            scrollBehavior: 'smooth',
            background: `
              linear-gradient(135deg, 
                hsl(30, 25%, 50%) 0%,
                hsl(25, 30%, 45%) 25%,
                hsl(20, 35%, 40%) 50%,
                hsl(25, 30%, 45%) 75%,
                hsl(30, 25%, 50%) 100%
              ),
              repeating-linear-gradient(45deg, 
                transparent, 
                transparent 4px, 
                rgba(139, 69, 19, 0.1) 4px, 
                rgba(139, 69, 19, 0.1) 6px
              ),
              url(${backgroundImage})
            `,
            backgroundSize: 'cover, auto, cover',
            backgroundPosition: 'center, center, center',
            backgroundRepeat: 'no-repeat, repeat, no-repeat',
            borderColor: 'hsl(20, 40%, 20%)',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3)'
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
          backgroundRepeat: 'no-repeat',
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
                onClick={onRotateDomino ? () => onRotateDomino(id) : undefined}
                className={onRotateDomino ? "cursor-pointer hover:ring-2 hover:ring-dutch-orange" : undefined}
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
      </div>
    </div>
  );
};
