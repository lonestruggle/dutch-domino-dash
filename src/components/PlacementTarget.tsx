import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGameVisualSettings } from '@/hooks/useGameVisualSettings';
import { cn } from '@/lib/utils';

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
  disabled = false
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
    />
  );
};