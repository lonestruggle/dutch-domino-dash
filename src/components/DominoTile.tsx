import React from 'react';
import { DominoData } from '@/types/domino';
import { cn } from '@/lib/utils';
import { NewDominoTile } from './NewDominoTile';

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
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  size?: 'small' | 'medium' | 'large';
  use3D?: boolean; // Toggle tussen oude en nieuwe implementatie
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
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0,
  size = 'medium',
  use3D = true // Default naar nieuwe 3D implementatie
}) => {
  // Als 3D is uitgeschakeld, gebruik de oude implementatie
  if (!use3D) {
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
          orientation === 'vertical' ? 'w-12 h-24' : 'w-24 h-12',
          double && orientation === 'vertical' && 'double-vertical-offset',
          double && orientation === 'horizontal' && 'double-horizontal-offset',
          selected && 'selected',
          isShaking && 'hard-slam-shake',
          className
        )}
        onClick={onClick}
        style={{
          '--domino-rotation': `${rotation}deg`,
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
  }

  // Nieuwe 3D implementatie
  return (
    <NewDominoTile
      data={data}
      orientation={orientation}
      flipped={flipped}
      className={className}
      onClick={onClick}
      selected={selected}
      style={style}
      rotation={rotation}
      rotateX={rotateX}
      rotateY={rotateY}
      rotateZ={rotateZ}
      size={size}
    />
  );
};