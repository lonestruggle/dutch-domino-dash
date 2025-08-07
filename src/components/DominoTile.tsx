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
  console.log(`🎯 DominoTile render - rotation: ${rotation}, data: ${data.value1}|${data.value2}`);
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
        orientation === 'vertical' ? 'w-11 h-[88px]' : 'w-[88px] h-11',
        double && orientation === 'vertical' && '-translate-y-6',
        double && orientation === 'horizontal' && '-translate-x-6',
        selected && 'selected',
        isShaking && 'hard-slam-shake',
        className
      )}
      onClick={onClick}
      style={{
        ...style,
        '--domino-rotation': `${rotation}deg`,
        '--shake-duration': `${1 + Math.random()}s`,
      } as React.CSSProperties}
    >
      <div
        className={cn(
          'absolute inset-0 flex',
          orientation === 'vertical' ? 'flex-col' : 'flex-row'
        )}
        style={{ transform: `rotate(${rotation}deg)` }}
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