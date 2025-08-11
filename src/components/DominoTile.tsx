import React from 'react';
import { DominoData } from '@/types/domino';
import { cn } from '@/lib/utils';

interface DominoTileProps {
  data: DominoData;
  orientation?: 'horizontal' | 'vertical';
  flipped?: boolean;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
  style?: React.CSSProperties;
  rotation?: number;
  isShaking?: boolean;
}

const isDouble = (data: DominoData) => data.value1 === data.value2;

export const DominoTile: React.FC<DominoTileProps> = ({
  data,
  orientation = 'horizontal',
  flipped = false,
  className,
  onClick,
  selected = false,
  style,
  rotation = 0,
  isShaking = false
}) => {
  
  const pips = flipped ? [data.value2, data.value1] : [data.value1, data.value2];
  const double = isDouble(data);

  const renderPips = (count: number) => {
    if (count === 0) return null;
    return Array.from({ length: count }, (_, i) => (
      <div key={i} className="domino-pip" />
    ));
  };

  return (
    <div
      className={cn(
        'domino-tile cursor-pointer relative',
        // Perfect grid cells - exactly 48px per cell, no gaps like reference image
        // Horizontal: 2×48px (96px) × 1×48px (48px)
        // Vertical: 1×48px (48px) × 2×48px (96px)
        orientation === 'vertical' ? 'w-12 h-24' : 'w-24 h-12',
        selected && 'selected',
        isShaking && 'hard-slam-shake',
        className
      )}
      onClick={onClick}
      style={{
        '--domino-rotation': `${rotation}deg`,
        // Remove the hardcoded shake duration - let settings control it
        // Zorg dat ALLE style properties van de GameBoard worden doorgegeven
        ...style,
      } as React.CSSProperties}
    >
      <div
        className={cn(
          'absolute inset-0 flex',
          orientation === 'vertical' ? 'flex-col' : 'flex-row'
        )}
      >
        <div className={cn(
          'flex-1 relative flex items-center justify-center',
          orientation === 'horizontal' ? 'border-r border-domino-border' : 'border-b border-domino-border',
          `pip-pattern-${pips[0]}`
        )}>
          {renderPips(pips[0])}
        </div>
        <div className={cn(
          'flex-1 relative flex items-center justify-center',
          `pip-pattern-${pips[1]}`
        )}>
          {renderPips(pips[1])}
        </div>
      </div>
    </div>
  );
};