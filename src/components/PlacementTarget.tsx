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
  flipped = false
}) => {
  const isMobile = useIsMobile();
  const CELL_SIZE = 48;
  const MOBILE_CELL_SIZE = 30;
  
  return (
    <div
      className={cn(
        'placement-target absolute z-10 transform -translate-x-1/2 -translate-y-1/2',
        isDouble && orientation === 'vertical' && '-mt-6',
        isDouble && orientation === 'horizontal' && '-ml-6',
        isMobile && 'cursor-pointer active:bg-opacity-80 !scale-[0.7] transform',
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
        <div className="absolute inset-0 opacity-60 hover:opacity-80 transition-opacity">
          <DominoTile
            data={dominoData}
            orientation={orientation}
            flipped={flipped}
            rotation={0}
            className="pointer-events-none"
          />
        </div>
      )}
    </div>
  );
};