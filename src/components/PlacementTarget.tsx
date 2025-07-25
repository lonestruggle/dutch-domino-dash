import React from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface PlacementTargetProps {
  x: number;
  y: number;
  width: number;
  height: number;
  orientation: 'horizontal' | 'vertical';
  isDouble: boolean;
  onClick: () => void;
  style?: React.CSSProperties;
  cellSize?: number;
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
  cellSize
}) => {
  const isMobile = useIsMobile();
  const CELL_SIZE = cellSize || (isMobile ? 32 : 48);
  
  return (
    <div
      className={cn(
        'placement-target absolute z-10 transform -translate-x-1/2 -translate-y-1/2',
        isDouble && orientation === 'vertical' && '-mt-6',
        isDouble && orientation === 'horizontal' && '-ml-6'
      )}
      style={{
        width: `${CELL_SIZE * width - 4}px`,
        height: `${CELL_SIZE * height - 4}px`,
        ...style
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    />
  );
};