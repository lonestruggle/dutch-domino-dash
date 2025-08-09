import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
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
  isInitialPlacement = false
}) => {
  const isMobile = useIsMobile();
  const DESKTOP_CELL_SIZE = 48;
  const MOBILE_CELL_SIZE = 28;
  
  // Get responsive cell size
  const cellSize = isMobile ? MOBILE_CELL_SIZE : DESKTOP_CELL_SIZE;
  
  return (
    <div
      className={cn(
        'placement-target absolute z-10',
        isDouble && orientation === 'vertical' && 'double-vertical-offset',
        isDouble && orientation === 'horizontal' && 'double-horizontal-offset',
        isMobile && 'cursor-pointer active:bg-opacity-80',
        className
      )}
      style={{
        width: `${cellSize * width - 1}px`,
        height: `${cellSize * height - 1}px`,
        transform: `scale(var(--domino-target-scale, 1)) translate(-50%, -50%)`,
        transformOrigin: 'center',
        transition: 'none', // Remove transition to prevent size jumping
        ...style
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onTouchStart={isMobile ? (e) => e.stopPropagation() : undefined}
    />
  );
};