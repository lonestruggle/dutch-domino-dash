import React, { useRef, useState } from 'react';
import { DominoTile } from './DominoTile';
import { DominoData, GameState } from '@/types/domino';
import { cn } from '@/lib/utils';

interface DraggableDominoTileProps {
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
  magnetEnabled: boolean;
  isDominoChainEnd: (dominoId: string, gameState: GameState) => { isEnd: boolean, isHead: boolean };
  onDragStart: (dominoId: string, gameState: GameState, event: { clientX: number, clientY: number }) => boolean;
  onDragMove?: (x: number, y: number) => void;
  onDragEnd: () => void;
  isBeingDragged?: boolean;
  isInDraggedChain?: boolean;
}

export const DraggableDominoTile: React.FC<DraggableDominoTileProps> = ({
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
  magnetEnabled,
  isDominoChainEnd,
  onDragStart,
  onDragMove,
  onDragEnd,
  isBeingDragged = false,
  isInDraggedChain = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<HTMLDivElement>(null);
  
  const { isEnd, isHead } = isDominoChainEnd(dominoId, gameState);
  const canDrag = magnetEnabled && isEnd;
  
  const handleMouseDown = (event: React.MouseEvent) => {
    if (!canDrag) {
      onClick?.();
      return;
    }
    
    event.preventDefault();
    const success = onDragStart(dominoId, gameState, { clientX: event.clientX, clientY: event.clientY });
    
    if (success) {
      setIsDragging(true);
      setDragStartPos({ x: event.clientX, y: event.clientY });
      
      const handleMouseMove = (e: MouseEvent) => {
        if (onDragMove) {
          const deltaX = e.clientX - dragStartPos.x;
          const deltaY = e.clientY - dragStartPos.y;
          onDragMove(deltaX, deltaY);
        }
      };
      
      const handleMouseUp = () => {
        setIsDragging(false);
        onDragEnd();
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      onClick?.();
    }
  };
  
  const handleTouchStart = (event: React.TouchEvent) => {
    if (!canDrag) {
      onClick?.();
      return;
    }
    
    event.preventDefault();
    const touch = event.touches[0];
    const success = onDragStart(dominoId, gameState, { clientX: touch.clientX, clientY: touch.clientY });
    
    if (success) {
      setIsDragging(true);
      setDragStartPos({ x: touch.clientX, y: touch.clientY });
      
      const handleTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        const touch = e.touches[0];
        if (onDragMove) {
          const deltaX = touch.clientX - dragStartPos.x;
          const deltaY = touch.clientY - dragStartPos.y;
          onDragMove(deltaX, deltaY);
        }
      };
      
      const handleTouchEnd = () => {
        setIsDragging(false);
        onDragEnd();
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
      
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    } else {
      onClick?.();
    }
  };
  
  return (
    <div
      ref={dragRef}
      className={cn(
        'relative transition-transform',
        canDrag && 'cursor-grab active:cursor-grabbing',
        !canDrag && 'cursor-pointer',
        isEnd && magnetEnabled && 'ring-2 ring-primary/30 ring-offset-1',
        isHead && magnetEnabled && 'ring-blue-400/50',
        !isHead && isEnd && magnetEnabled && 'ring-green-400/50',
        isBeingDragged && 'z-50 scale-105',
        isInDraggedChain && !isBeingDragged && 'opacity-80 scale-95',
        isDragging && 'scale-110 z-50'
      )}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{
        ...style,
        pointerEvents: isInDraggedChain && !isBeingDragged ? 'none' : 'auto'
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
      
      {/* Chain end indicator */}
      {isEnd && magnetEnabled && (
        <div className={cn(
          'absolute -top-1 -right-1 w-3 h-3 rounded-full text-[8px] font-bold flex items-center justify-center text-white',
          isHead ? 'bg-blue-500' : 'bg-green-500'
        )}>
          {isHead ? 'H' : 'T'}
        </div>
      )}
    </div>
  );
};