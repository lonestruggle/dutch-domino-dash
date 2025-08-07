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
  onDragMove?: (dominoId: string, deltaX: number, deltaY: number, trainIds: string[]) => void;
  onDragEnd?: (dominoId: string, finalX: number, finalY: number, trainIds: string[]) => void;
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
  onDragMove,
  onDragEnd
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<HTMLDivElement>(null);
  
  // Check if this domino is selected
  const isSelected = selectedDominoId === dominoId;
  
  // Find connected dominoes (train)
  const getTrainDominoes = (leadId: string): string[] => {
    const visited = new Set<string>();
    const train: string[] = [];
    
    const findConnected = (dominoId: string) => {
      if (visited.has(dominoId)) return;
      visited.add(dominoId);
      train.push(dominoId);
      
      const domino = gameState.dominoes[dominoId];
      if (!domino) return;
      
      // Check adjacent positions for connected dominoes
      const positions = domino.orientation === 'horizontal'
        ? [
            { x: domino.x - 1, y: domino.y },    // Left
            { x: domino.x + 2, y: domino.y },    // Right
          ]
        : [
            { x: domino.x, y: domino.y - 1 },    // Top
            { x: domino.x, y: domino.y + 2 },    // Bottom
          ];
      
      for (const pos of positions) {
        const boardCell = gameState.board[`${pos.x},${pos.y}`];
        if (boardCell && boardCell.dominoId && !visited.has(boardCell.dominoId)) {
          findConnected(boardCell.dominoId);
        }
      }
    };
    
    findConnected(leadId);
    return train;
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
    
    const trainIds = getTrainDominoes(dominoId);
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartPos.x;
      const deltaY = e.clientY - dragStartPos.y;
      
      // Allow free movement during drag
      setDragOffset({ x: deltaX, y: deltaY });
      onDragMove?.(dominoId, deltaX, deltaY, trainIds);
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      
      // Calculate final grid position
      const gridSize = 48;
      const snappedX = Math.round(dragOffset.x / gridSize) * gridSize;
      const snappedY = Math.round(dragOffset.y / gridSize) * gridSize;
      
      // Calculate final world position
      const domino = gameState.dominoes[dominoId];
      const finalWorldX = domino.x + Math.round(dragOffset.x / gridSize);
      const finalWorldY = domino.y + Math.round(dragOffset.y / gridSize);
      
      onDragEnd?.(dominoId, finalWorldX, finalWorldY, trainIds);
      
      // Keep the snapped position (don't reset to 0)
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
    
    const trainIds = getTrainDominoes(dominoId);
    
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStartPos.x;
      const deltaY = touch.clientY - dragStartPos.y;
      
      setDragOffset({ x: deltaX, y: deltaY });
      onDragMove?.(dominoId, deltaX, deltaY, trainIds);
    };
    
    const handleTouchEnd = () => {
      setIsDragging(false);
      
      // Calculate final position
      const gridSize = 48;
      const snappedX = Math.round(dragOffset.x / gridSize) * gridSize;
      const snappedY = Math.round(dragOffset.y / gridSize) * gridSize;
      
      const domino = gameState.dominoes[dominoId];
      const finalWorldX = domino.x + Math.round(dragOffset.x / gridSize);
      const finalWorldY = domino.y + Math.round(dragOffset.y / gridSize);
      
      onDragEnd?.(dominoId, finalWorldX, finalWorldY, trainIds);
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