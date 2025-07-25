import React from 'react';
import { DominoData } from '@/types/domino';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

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
  cellSize?: number;
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
  isShaking = false,
  cellSize
}) => {
  const isMobile = useIsMobile();
  console.log(`🎯 DominoTile render - rotation: ${rotation}, data: ${data.value1}|${data.value2}`);
  const pips = flipped ? [data.value2, data.value1] : [data.value1, data.value2];
  const double = isDouble(data);
  
  // Dynamic domino sizes based on cellSize or fallback to responsive defaults
  const baseCellSize = cellSize || (isMobile ? 32 : 48);
  const dominoWidth = baseCellSize * 1.8;
  const dominoHeight = baseCellSize * 0.9;
  
  // Calculate pip size based on cell size
  const pipSize = Math.max(baseCellSize * 0.15, 3);

  const renderPips = (count: number) => {
    if (count === 0) return null;
    return Array.from({ length: count }, (_, i) => (
      <div key={i} className="domino-pip" />
    ));
  };

  return (
    <div
      className={cn(
        'domino-tile cursor-pointer flex relative',
        selected && 'selected',
        isShaking && 'hard-slam-shake',
        className
      )}
      onClick={onClick}
      style={{
        width: orientation === 'vertical' ? dominoHeight : dominoWidth,
        height: orientation === 'vertical' ? dominoWidth : dominoHeight,
        transform: `${style?.transform || ''} rotate(${rotation}deg)`.trim(),
        '--domino-rotation': `${rotation}deg`,
        '--shake-duration': `${1 + Math.random()}s`,
        '--pip-size': `${pipSize}px`,
        flexDirection: orientation === 'vertical' ? 'column' : 'row',
        ...style,
      } as React.CSSProperties}
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
  );
};