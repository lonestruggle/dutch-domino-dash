import React, { useState, useRef } from 'react';
import { DominoTile } from './DominoTile';
import { DominoData, GameState } from '@/types/domino';
import { cn } from '@/lib/utils';

interface SimpleDragDominoProps {
  dominoId: string;
  data: DominoData;
  orientation?: 'horizontal' | 'vertical';
  flipped?: boolean;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
  style?: React.CSSProperties;
  rotation?: number;
  isShaking?: boolean;
  gameState: GameState;
  selectedDominoId?: string | null;
  trainLength?: number; // Maximum number of dominoes in train
  onDragMove?: (dominoId: string, deltaX: number, deltaY: number, trainData: Array<{id: string, offsetX: number, offsetY: number}>) => void;
  onDragEnd?: (dominoId: string, finalX: number, finalY: number, trainData: Array<{id: string, offsetX: number, offsetY: number}>) => void;
}

export const SimpleDragDomino: React.FC<SimpleDragDominoProps> = ({
  dominoId,
  data,
  orientation = 'horizontal',
  flipped = false,
  className,
  onClick,
  selected = false,
  style,
  rotation = 0,
  isShaking = false,
  gameState,
  selectedDominoId,
  trainLength = 3, // Default train length
  onDragMove,
  onDragEnd
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<HTMLDivElement>(null);
  
  // Check if this domino is selected
  const isSelected = selectedDominoId === dominoId;
  
  // Find connected dominoes in order (train chain)
  const getTrainChain = (leadId: string): string[] => {
    const visited = new Set<string>();
    const chain: string[] = [];
    
    const findConnectedInOrder = (currentId: string, fromDirection?: string) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);
      chain.push(currentId);
      
      const domino = gameState.dominoes[currentId];
      if (!domino) return;
      
      // Find next domino in the chain (excluding the one we came from)
      const adjacentPositions = domino.orientation === 'horizontal'
        ? [
            { x: domino.x - 1, y: domino.y, dir: 'left' },
            { x: domino.x + 2, y: domino.y, dir: 'right' },
          ]
        : [
            { x: domino.x, y: domino.y - 1, dir: 'up' },
            { x: domino.x, y: domino.y + 2, dir: 'down' },
          ];
      
      for (const pos of adjacentPositions) {
        if (pos.dir === fromDirection) continue; // Don't go back
        
        const boardCell = gameState.board[`${pos.x},${pos.y}`];
        if (boardCell && boardCell.dominoId && !visited.has(boardCell.dominoId)) {
          const oppositeDir = pos.dir === 'left' ? 'right' : 
                             pos.dir === 'right' ? 'left' :
                             pos.dir === 'up' ? 'down' : 'up';
          findConnectedInOrder(boardCell.dominoId, oppositeDir);
        }
      }
    };
    
    findConnectedInOrder(leadId);
    return chain;
  };
  
  // Create snake/curve effect for train with limited length
  const createSnakeTrainData = (deltaX: number, deltaY: number): Array<{id: string, offsetX: number, offsetY: number}> => {
    const fullChain = getTrainChain(dominoId);
    
    // Limit train length
    const trainChain = fullChain.slice(0, trainLength);
    const trainData: Array<{id: string, offsetX: number, offsetY: number}> = [];
    
    for (let i = 0; i < trainChain.length; i++) {
      const id = trainChain[i];
      
      if (i === 0) {
        // Lead domino moves with full offset
        trainData.push({ id, offsetX: deltaX, offsetY: deltaY });
      } else {
        // Following dominoes create a snake curve with spacing
        const followFactor = Math.pow(0.7, i); // Each domino follows with 70% of previous
        const spacingFactor = i * 15; // Add spacing between dominoes
        const waveFactor = Math.sin(i * 0.8) * 8; // Sinus wave for snake effect
        
        // Create separation - last domino should not stick to previous
        const separationX = Math.cos(Math.atan2(deltaY, deltaX)) * spacingFactor;
        const separationY = Math.sin(Math.atan2(deltaY, deltaX)) * spacingFactor;
        
        const snakeOffsetX = (deltaX * followFactor) - separationX + waveFactor * Math.cos(Date.now() * 0.003 + i);
        const snakeOffsetY = (deltaY * followFactor) - separationY + waveFactor * Math.sin(Date.now() * 0.003 + i);
        
        trainData.push({ 
          id, 
          offsetX: snakeOffsetX, 
          offsetY: snakeOffsetY 
        });
      }
    }
    
    return trainData;
  };
  
  const handleMouseDown = (event: React.MouseEvent) => {
    if (!isSelected) {
      onClick?.(); // Select this domino
      return;
    }
    
    event.preventDefault();
    setIsDragging(true);
    setDragStartPos({ x: event.clientX, y: event.clientY });
    setDragOffset({ x: 0, y: 0 });
    
    let animationId: number;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartPos.x;
      const deltaY = e.clientY - dragStartPos.y;
      
      setDragOffset({ x: deltaX, y: deltaY });
      
      // Create snake effect and update train
      const trainData = createSnakeTrainData(deltaX, deltaY);
      onDragMove?.(dominoId, deltaX, deltaY, trainData);
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      
      // Calculate final positions for the whole train
      const trainData = createSnakeTrainData(dragOffset.x, dragOffset.y);
      
      // Get final world position for lead domino
      const domino = gameState.dominoes[dominoId];
      const gridSize = 48;
      const finalWorldX = domino.x + Math.round(dragOffset.x / gridSize);
      const finalWorldY = domino.y + Math.round(dragOffset.y / gridSize);
      
      onDragEnd?.(dominoId, finalWorldX, finalWorldY, trainData);
      
      // Keep final position
      const snappedX = Math.round(dragOffset.x / gridSize) * gridSize;
      const snappedY = Math.round(dragOffset.y / gridSize) * gridSize;
      setDragOffset({ x: snappedX, y: snappedY });
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    if (!isSelected) {
      onClick?.(); // Select this domino
      return;
    }
    
    event.preventDefault();
    const touch = event.touches[0];
    setIsDragging(true);
    setDragStartPos({ x: touch.clientX, y: touch.clientY });
    setDragOffset({ x: 0, y: 0 });
    
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStartPos.x;
      const deltaY = touch.clientY - dragStartPos.y;
      
      setDragOffset({ x: deltaX, y: deltaY });
      
      const trainData = createSnakeTrainData(deltaX, deltaY);
      onDragMove?.(dominoId, deltaX, deltaY, trainData);
    };
    
    const handleTouchEnd = () => {
      setIsDragging(false);
      
      const trainData = createSnakeTrainData(dragOffset.x, dragOffset.y);
      
      const domino = gameState.dominoes[dominoId];
      const gridSize = 48;
      const finalWorldX = domino.x + Math.round(dragOffset.x / gridSize);
      const finalWorldY = domino.y + Math.round(dragOffset.y / gridSize);
      
      onDragEnd?.(dominoId, finalWorldX, finalWorldY, trainData);
      
      const snappedX = Math.round(dragOffset.x / gridSize) * gridSize;
      const snappedY = Math.round(dragOffset.y / gridSize) * gridSize;
      setDragOffset({ x: snappedX, y: snappedY });
      
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };
  
  return (
    <div
      ref={dragRef}
      className={cn(
        'relative transition-all duration-200',
        isSelected && 'cursor-grab active:cursor-grabbing ring-2 ring-primary/50',
        !isSelected && 'cursor-pointer',
        isDragging && 'scale-110 z-50 shadow-2xl',
        isSelected && !isDragging && 'scale-105 shadow-lg'
      )}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{
        ...style,
        transform: `${style?.transform || ''} translate(${dragOffset.x}px, ${dragOffset.y}px)`,
        zIndex: isDragging ? 100 : isSelected ? 50 : 10,
        pointerEvents: 'auto'
      }}
    >
      <DominoTile
        data={data}
        orientation={orientation} // Keep original orientation, no rotation
        flipped={flipped}
        className={className}
        selected={isSelected}
        rotation={rotation} // Keep original rotation
        isShaking={isShaking}
      />
      
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-primary rounded-full animate-pulse flex items-center justify-center">
          <div className="w-2 h-2 bg-background rounded-full"></div>
        </div>
      )}
      
      {/* Grid snap indicator when dragging */}
      {isDragging && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="w-2 h-2 bg-primary/60 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
          <div className="text-xs bg-background/90 text-primary px-2 py-1 rounded absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
            Sleep vrij - loslaten = snap naar grid
          </div>
        </div>
      )}
    </div>
  );
};