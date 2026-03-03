import React from 'react';
import { DominoData } from '@/types/domino';
import { useGameVisualSettings } from '@/hooks/useGameVisualSettings';
import { cn } from '@/lib/utils';

interface DominoTileProps {
  data: DominoData;
  dominoId?: string;
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
  dominoId,
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
  const { settings } = useGameVisualSettings();
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
  const thickness = `${settings.dominoThickness}px`;
  
  // Grid-based dimensions - each domino spans 2 grid cells
  // Use settings-based grid size for consistent scaling across devices
  const GRID_CELL_SIZE = settings.dominoWidth / 2;
  const dominoWidth = orientation === 'horizontal' ? GRID_CELL_SIZE * 2 : GRID_CELL_SIZE;
  const dominoHeight = orientation === 'horizontal' ? GRID_CELL_SIZE : GRID_CELL_SIZE * 2;

  return (
    <div
      className={cn(
        'domino-tile cursor-pointer relative preserve-3d',
        double && orientation === 'vertical' && 'double-vertical-offset',
        double && orientation === 'horizontal' && 'double-horizontal-offset',
        selected && 'ring-2 ring-blue-500 scale-105 shadow-[var(--shadow-domino-hover)]',
        'hover:scale-105 hover:shadow-[var(--shadow-domino-hover)]',
        'rounded-sm transition-all duration-200',
        className
      )}
      onClick={onClick}
      data-original-rotation={rotation} // Store original rotation for animations
      data-domino-id={dominoId}
      style={{
        '--domino-rotation': `${rotation}deg`,
        transformStyle: 'preserve-3d',
        // Grid-based dimensions - each domino spans exactly 2 grid cells
        width: `${dominoWidth}px`,
        height: `${dominoHeight}px`,
        // Spread alle andere style properties EERST
        ...style,
        // CRITICAL: Include original rotation in initial transform
        transform: style?.transform 
          ? `${style.transform} rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ + rotation}deg)`
          : `rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ + rotation}deg)`,
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