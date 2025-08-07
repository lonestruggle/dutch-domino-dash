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
  onDragMove?: (dominoId: string, deltaX: number, deltaY: number) => void;
  onDragEnd?: (dominoId: string) => void;
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
  onDragMove,
  onDragEnd
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<HTMLDivElement>(null);
  
  const handleMouseDown = (event: React.MouseEvent) => {
    if (!selected) {
      onClick?.();
      return;
    }
    
    event.preventDefault();
    setIsDragging(true);
    setDragStartPos({ x: event.clientX, y: event.clientY });
    setDragOffset({ x: 0, y: 0 });
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartPos.x;
      const deltaY = e.clientY - dragStartPos.y;
      
      // Limit to 5 grid cells (5 * 48px = 240px)
      const maxDistance = 5 * 48;
      const limitedDeltaX = Math.max(-maxDistance, Math.min(maxDistance, deltaX));
      const limitedDeltaY = Math.max(-maxDistance, Math.min(maxDistance, deltaY));
      
      setDragOffset({ x: limitedDeltaX, y: limitedDeltaY });
      onDragMove?.(dominoId, limitedDeltaX, limitedDeltaY);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      setDragOffset({ x: 0, y: 0 });
      onDragEnd?.(dominoId);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    if (!selected) {
      onClick?.();
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
      
      // Limit to 5 grid cells
      const maxDistance = 5 * 48;
      const limitedDeltaX = Math.max(-maxDistance, Math.min(maxDistance, deltaX));
      const limitedDeltaY = Math.max(-maxDistance, Math.min(maxDistance, deltaY));
      
      setDragOffset({ x: limitedDeltaX, y: limitedDeltaY });
      onDragMove?.(dominoId, limitedDeltaX, limitedDeltaY);
    };
    
    const handleTouchEnd = () => {
      setIsDragging(false);
      setDragOffset({ x: 0, y: 0 });
      onDragEnd?.(dominoId);
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
        selected && 'cursor-grab active:cursor-grabbing ring-2 ring-primary/50',
        !selected && 'cursor-pointer',
        isDragging && 'scale-110 z-50 shadow-2xl',
        selected && !isDragging && 'scale-105 shadow-lg'
      )}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{
        ...style,
        transform: `${style?.transform || ''} translate(${dragOffset.x}px, ${dragOffset.y}px)`,
        zIndex: isDragging ? 100 : selected ? 50 : 10
      }}
    >
      <DominoTile
        data={data}
        orientation={orientation}
        flipped={flipped}
        className={className}
        selected={selected}
        rotation={rotation}
        isShaking={isShaking}
      />
      
      {/* Selection indicator */}
      {selected && (
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-primary rounded-full animate-pulse flex items-center justify-center">
          <div className="w-2 h-2 bg-background rounded-full"></div>
        </div>
      )}
      
      {/* Drag range indicator when dragging */}
      {isDragging && (
        <div 
          className="absolute border-2 border-dashed border-primary/40 rounded-lg pointer-events-none"
          style={{
            left: -240, // 5 * 48px
            top: -240,
            width: 480, // 10 * 48px
            height: 480,
            zIndex: -1
          }}
        />
      )}
    </div>
  );
};