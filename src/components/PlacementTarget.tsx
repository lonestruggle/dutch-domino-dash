import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGameVisualSettings } from '@/hooks/useGameVisualSettings';
import { cn } from '@/lib/utils';
import { DominoTile } from './DominoTile';
import type { DominoData } from '@/types/domino';

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
  isInitialPlacement?: boolean;
  disabled?: boolean;
  matchValue?: number;
  ghostTile?: DominoData;
  ghostFlipped?: boolean;
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
  isInitialPlacement = false,
  disabled = false,
  matchValue,
  ghostTile,
  ghostFlipped,
}) => {
  const isMobile = useIsMobile();
  const { settings } = useGameVisualSettings();
  
  // Use grid cell size - each domino occupies 2 grid cells
  // Use settings-based grid size for consistent scaling across devices
  const GRID_CELL_SIZE = settings.dominoWidth / 2;
  
  return (
    <div
      className={cn(
        'placement-target',
        isDouble && orientation === 'vertical' && 'double-vertical-offset',
        isDouble && orientation === 'horizontal' && 'double-horizontal-offset',
        isMobile && 'cursor-pointer active:bg-opacity-80',
        ghostTile && 'placement-target--ghost',
        className
      )}
      style={{
        // Perfect grid alignment - each domino = 2 grid cells
        width: `${width * GRID_CELL_SIZE}px`,
        height: `${height * GRID_CELL_SIZE}px`,
        left: style?.left,
        top: style?.top,
        // No additional transform scaling needed - size is already proportional
        transformOrigin: 'top left',
        transition: 'background-color 0.2s ease',
        ...style,
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) {
          onClick();
        }
      }}
      onTouchStart={isMobile ? (e) => e.stopPropagation() : undefined}
    >
      {ghostTile ? (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ opacity: 0.55 }}
        >
          <DominoTile
            data={ghostTile}
            orientation={orientation}
            flipped={!!ghostFlipped}
            className="pointer-events-none"
          />
        </div>
      ) : (
        typeof matchValue === 'number' && (
          <div
            className="absolute -top-2 -left-2 z-10 flex items-center justify-center rounded-full bg-yellow-400 text-black text-[10px] font-bold shadow-md pointer-events-none"
            style={{ width: 18, height: 18, border: '1px solid hsl(var(--background))' }}
            title={`Open einde verwacht: ${matchValue}`}
          >
            {matchValue}
          </div>
        )
      )}
    </div>
  );
};