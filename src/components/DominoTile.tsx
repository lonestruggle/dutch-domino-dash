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
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
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
  rotateZ = 0
}) => {
  console.log(`🎯 DominoTile render - rotation: ${rotation}, data: ${data.value1}|${data.value2}, isShaking: ${isShaking}`, style);
  const pips = flipped ? [data.value2, data.value1] : [data.value1, data.value2];
  const double = isDouble(data);

  const renderDots = (dots: number) => {
    // Deze array definieert de posities van de stippen voor elk nummer (0-6).
    const dotPositions = {
      0: [],
      1: [4], // midden
      2: [0, 8], // linksboven, rechtsonder
      3: [0, 4, 8], // linksboven, midden, rechtsonder
      4: [0, 2, 6, 8], // hoeken
      5: [0, 2, 4, 6, 8], // hoeken + midden
      6: [0, 1, 2, 6, 7, 8] // twee kolommen
    };

    const positions = dotPositions[dots] || [];
    
    return (
      // De stippen worden weergegeven in een 3x3 raster.
      <div className="relative w-full h-full grid grid-cols-3 grid-rows-3 gap-[1px] p-1">
        {Array.from({ length: 9 }, (_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-full transition-all duration-200",
              positions.includes(i)
                ? "bg-[hsl(var(--domino-dot))] shadow-sm w-1.5 h-1.5"
                : ""
            )}
          />
        ))}
      </div>
    );
  };

  const isHorizontal = orientation === 'horizontal';
  const thickness = '6px';

  return (
    <div
      className={cn(
        'domino-tile cursor-pointer relative preserve-3d',
        // Perfect grid cells - exactly 48px per cell, no gaps like reference image
        // Horizontal: 2×48px (96px) × 1×48px (48px)
        // Vertical: 1×48px (48px) × 2×48px (96px)
        orientation === 'vertical' ? 'w-12 h-24' : 'w-24 h-12',
        double && orientation === 'vertical' && 'double-vertical-offset',
        double && orientation === 'horizontal' && 'double-horizontal-offset',
        selected && 'ring-2 ring-blue-500 scale-105 shadow-[var(--shadow-domino-hover)]',
        'hover:scale-105 hover:shadow-[var(--shadow-domino-hover)]',
        'rounded-sm transition-all duration-200',
        className
      )}
      onClick={onClick}
      style={{
        '--domino-rotation': `${rotation}deg`,
        transform: `rotateX(var(--current-rotate-x, ${rotateX}deg)) rotateY(var(--current-rotate-y, ${rotateY}deg)) rotateZ(var(--current-rotate-z, ${rotateZ}deg))`,
        transformStyle: 'preserve-3d',
        // Zorg dat ALLE style properties van de GameBoard worden doorgegeven
        ...style,
      } as React.CSSProperties}
    >
      {/* Voorkant */}
      <div className={cn(
        "absolute inset-0 rounded-sm backface-hidden",
        "flex",
        isHorizontal ? "flex-row" : "flex-col",
        "bg-gradient-to-br from-[hsl(var(--domino-highlight))] via-[hsl(var(--domino-face))] to-[hsl(var(--domino-lowlight))]",
        "shadow-[var(--shadow-domino)]",
      )}
      style={{
        transform: `translateZ(calc(${thickness} / 2))`,
        border: '1px solid hsl(var(--domino-edge))'
      }}
      >
        <div className={cn(
          "flex-1 flex items-center justify-center relative",
          isHorizontal ? "border-r border-[hsl(var(--domino-edge))]" : "border-b border-[hsl(var(--domino-edge))]"
        )}>
          {renderDots(pips[0])}
        </div>
        <div className="flex-1 flex items-center justify-center relative">
          {renderDots(pips[1])}
        </div>
        <div className={cn(
          "absolute bg-[hsl(var(--domino-highlight))] pointer-events-none",
          isHorizontal ? "top-0 left-1/2 h-full w-[1px] -translate-x-0.5" : "left-0 top-1/2 w-full h-[1px] -translate-y-0.5"
        )} />
      </div>

      {/* Achterkant */}
      <div className="absolute inset-0 bg-[hsl(var(--domino-back))] rounded-sm backface-hidden"
            style={{ transform: `rotateY(180deg) translateZ(calc(${thickness} / 2))` }}
      />
      
      {/* Bovenkant */}
      <div className="absolute top-0 left-0 w-full rounded-t-sm bg-[hsl(var(--domino-side))] origin-top backface-hidden"
            style={{
              height: thickness,
              transform: `rotateX(90deg) translateY(calc(${thickness} / -2))`
            }}
      />
      
      {/* Onderkant */}
      <div className="absolute bottom-0 left-0 w-full rounded-b-sm bg-[hsl(var(--domino-side))] origin-bottom backface-hidden"
            style={{
              height: thickness,
              transform: `rotateX(-90deg) translateY(calc(${thickness} / 2))`
            }}
      />

      {/* Linkerkant */}
      <div className="absolute top-0 left-0 h-full rounded-l-sm bg-[hsl(var(--domino-side))] origin-left backface-hidden"
            style={{
              width: thickness,
              transform: `rotateY(-90deg) translateX(calc(${thickness} / -2))`
            }}
      />

      {/* Rechterkant */}
      <div className="absolute top-0 right-0 h-full rounded-r-sm bg-[hsl(var(--domino-side))] origin-right backface-hidden"
            style={{
              width: thickness,
              transform: `rotateY(90deg) translateX(calc(${thickness} / 2))`
            }}
      />
    </div>
  );
};