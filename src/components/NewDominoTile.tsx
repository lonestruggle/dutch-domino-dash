import React from 'react';
import { DominoData } from '@/types/domino';
import { cn } from '@/lib/utils';

interface NewDominoTileProps {
  data: DominoData;
  orientation?: 'horizontal' | 'vertical';
  flipped?: boolean;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
  style?: React.CSSProperties;
  rotation?: number;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  size?: 'small' | 'medium' | 'large';
  colors?: {
    face: string;
    highlight: string;
    lowlight: string;
    dot: string;
    edge: string;
    side: string;
    back: string;
  };
}

const isDouble = (data: DominoData) => data.value1 === data.value2;

const defaultColors = {
  face: 'hsl(220, 50%, 90%)',
  highlight: 'hsl(220, 50%, 95%)',
  lowlight: 'hsl(220, 50%, 80%)',
  dot: 'hsl(220, 20%, 20%)',
  edge: 'hsl(220, 20%, 30%)',
  side: 'hsl(220, 30%, 70%)',
  back: 'hsl(220, 30%, 60%)'
};

export const NewDominoTile: React.FC<NewDominoTileProps> = ({
  data,
  orientation = 'horizontal',
  flipped = false,
  className,
  onClick,
  selected = false,
  style,
  rotation = 0,
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0,
  size = 'medium',
  colors = defaultColors
}) => {
  const pips = flipped ? [data.value2, data.value1] : [data.value1, data.value2];
  const double = isDouble(data);

  // Combine all rotations including global shake
  const globalShakeX = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--global-shake-x') || '0');
  const globalShakeY = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--global-shake-y') || '0');
  const globalShakeZ = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--global-shake-z') || '0');
  
  const totalRotateX = rotateX + globalShakeX;
  const totalRotateY = rotateY + globalShakeY;
  const totalRotateZ = rotateZ + globalShakeZ;

  const renderDots = (count: number) => {
    if (count === 0) return null;
    return Array.from({ length: count }, (_, i) => (
      <div key={i} className="domino-pip" style={{ backgroundColor: colors.dot }} />
    ));
  };

  const dotPositions = {
    0: [],
    1: [4], // center
    2: [0, 8], // top-left, bottom-right
    3: [0, 4, 8], // top-left, center, bottom-right
    4: [0, 2, 6, 8], // corners
    5: [0, 2, 4, 6, 8], // corners + center
    6: [0, 1, 2, 6, 7, 8] // two columns
  };

  const renderDotsGrid = (count: number) => {
    const positions = (count >= 0 && count <= 6) ? dotPositions[count as keyof typeof dotPositions] : dotPositions[0];
    
    return (
      <div className="relative w-full h-full grid grid-cols-3 grid-rows-3 gap-[2px] p-1">
        {Array.from({ length: 9 }, (_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-full transition-all duration-200",
              positions.includes(i) && "domino-pip",
              size === 'small' && positions.includes(i) && "w-1 h-1",
              size === 'medium' && positions.includes(i) && "w-1.5 h-1.5",
              size === 'large' && positions.includes(i) && "w-2 h-2"
            )}
            style={{ backgroundColor: positions.includes(i) ? colors.dot : 'transparent' }}
          />
        ))}
      </div>
    );
  };

  const sizeMetrics = {
    small: { width: '48px', height: '24px', thickness: '6px' },
    medium: { width: '64px', height: '32px', thickness: '8px' },
    large: { width: '80px', height: '40px', thickness: '10px' },
  };

  const { width, height, thickness } = sizeMetrics[size];
  const isHorizontal = orientation === 'horizontal';

  const tileWidth = isHorizontal ? width : height;
  const tileHeight = isHorizontal ? height : width;

  return (
    <div
      className={cn(
        'relative flex cursor-pointer select-none transition-all duration-200',
        'transform-gpu preserve-3d',
        selected && 'ring-2 ring-primary scale-105',
        onClick && 'hover:scale-105',
        'rounded-sm',
        double && orientation === 'vertical' && 'double-vertical-offset',
        double && orientation === 'horizontal' && 'double-horizontal-offset',
        className
      )}
      onClick={onClick}
      style={{
        transform: `rotateX(${totalRotateX}deg) rotateY(${totalRotateY}deg) rotateZ(${totalRotateZ}deg) rotate(${rotation}deg)`,
        width: tileWidth,
        height: tileHeight,
        transformStyle: 'preserve-3d',
        ...style,
      }}
    >
      {/* Front face */}
      <div 
        className={cn(
          'absolute inset-0 rounded-sm backface-hidden flex',
          isHorizontal ? 'flex-row' : 'flex-col'
        )}
        style={{
          transform: `translateZ(calc(${thickness} / 2))`,
          border: `1px solid ${colors.edge}`,
          backgroundColor: colors.face,
          boxShadow: 'var(--shadow-domino)',
        }}
      >
        <div 
          className={cn(
            'flex-1 flex items-center justify-center relative',
            isHorizontal ? 'border-r' : 'border-b'
          )}
          style={{ borderColor: colors.edge }}
        >
          {renderDotsGrid(pips[0])}
        </div>
        <div className="flex-1 flex items-center justify-center relative">
          {renderDotsGrid(pips[1])}
        </div>
        <div 
          className={cn(
            'absolute pointer-events-none',
            isHorizontal ? 'top-0 left-1/2 h-full w-[1px] -translate-x-0.5' : 'left-0 top-1/2 w-full h-[1px] -translate-y-0.5'
          )} 
          style={{ backgroundColor: colors.highlight }}
        />
      </div>

      {/* Back face */}
      <div 
        className="absolute inset-0 rounded-sm backface-hidden"
        style={{ 
          transform: `rotateY(180deg) translateZ(calc(${thickness} / 2))`, 
          backgroundColor: colors.back 
        }}
      />
      
      {/* Top face */}
      <div 
        className="absolute top-0 left-0 w-full rounded-t-sm origin-top backface-hidden"
        style={{
          height: thickness,
          backgroundColor: colors.side,
          transform: `rotateX(90deg) translateY(calc(${thickness} / -2))`
        }}
      />
      
      {/* Bottom face */}
      <div 
        className="absolute bottom-0 left-0 w-full rounded-b-sm origin-bottom backface-hidden"
        style={{
          height: thickness,
          backgroundColor: colors.side,
          transform: `rotateX(-90deg) translateY(calc(${thickness} / 2))`
        }}
      />

      {/* Left face */}
      <div 
        className="absolute top-0 left-0 h-full rounded-l-sm origin-left backface-hidden"
        style={{
          width: thickness,
          backgroundColor: colors.side,
          transform: `rotateY(-90deg) translateX(calc(${thickness} / -2))`
        }}
      />

      {/* Right face */}
      <div 
        className="absolute top-0 right-0 h-full rounded-r-sm origin-right backface-hidden"
        style={{
          width: thickness,
          backgroundColor: colors.side,
          transform: `rotateY(90deg) translateX(calc(${thickness} / 2))`
        }}
      />
    </div>
  );
};