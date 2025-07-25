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
  const isMobile = useIsMobile();
  console.log(`🎯 DominoTile render - rotation: ${rotation}, data: ${data.value1}|${data.value2}`);
  const pips = flipped ? [data.value2, data.value1] : [data.value1, data.value2];
  const double = isDouble(data);
  
  // Responsive domino sizes
  const dominoWidth = isMobile ? 58 : 88;  // 32px * 1.8 vs 48px * 1.8
  const dominoHeight = isMobile ? 29 : 44; // 32px * 0.9 vs 48px * 0.9

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