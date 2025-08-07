import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { DominoTile } from './DominoTile';
import { DominoData } from '@/types/domino';

interface PlacementTargetProps {
  x: number;
  y: number;
  width: number;
  height: number;
  orientation: 'horizontal' | 'vertical';
  isDouble: boolean;
  onClick: () => void;
  style?: React.CSSProperties;
  className?: string;
  dominoData?: DominoData;
  flipped?: boolean;
  isSelected?: boolean;
  isSecondLevel?: boolean;
}

export const PlacementTarget: React.FC<PlacementTargetProps> = ({
  x,
  y,
  width,
  height,
  orientation,
  isDouble,
  onClick,
  style,
  className,
  dominoData,
  flipped = false,
  isSelected = false,
  isSecondLevel = false
}) => {
  const isMobile = useIsMobile();
  const CELL_SIZE = 48;
  const MOBILE_CELL_SIZE = 30;
  
  return (
    <div
      className={cn(
        'placement-target absolute z-10 transform -translate-x-1/2 -translate-y-1/2',
        'border-2 rounded transition-colors cursor-pointer',
        isSecondLevel
          ? 'bg-yellow-500/40 border-yellow-400 hover:bg-yellow-500/60 z-5'
          : isSelected 
            ? 'bg-yellow-500/60 border-yellow-400 hover:bg-yellow-500/80 z-20' 
            : 'bg-blue-500/40 border-blue-400 hover:bg-blue-500/60 z-10',
        isDouble && orientation === 'vertical' && '-mt-6',
        isDouble && orientation === 'horizontal' && '-ml-6',
        isMobile && 'active:bg-opacity-80 !scale-[0.7] transform',
        className
      )}
      style={{
        width: `calc(var(--cell-size) * ${width} - 4px)`,
        height: `calc(var(--cell-size) * ${height} - 4px)`,
        ...style
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onTouchStart={isMobile ? (e) => e.stopPropagation() : undefined}
    >
      {dominoData && (
        <div className="absolute inset-0 transition-opacity">
          <DominoTile
            data={dominoData}
            orientation={orientation}
            flipped={flipped}
            rotation={0}
            className={cn(
              "pointer-events-none",
              isSecondLevel ? "opacity-50" : isSelected ? "opacity-80" : "opacity-60"
            )}
            style={(!isSelected && !isSecondLevel) ? {
              filter: 'sepia(100%) saturate(200%) hue-rotate(45deg) brightness(1.2)'
            } : undefined}
          />
        </div>
      )}
    </div>
  );
};