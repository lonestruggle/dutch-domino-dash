import React from 'react';
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
}

export const PlacementTarget: React.FC<PlacementTargetProps> = ({
  x,
  y,
  width,
  height,
  orientation,
  isDouble,
  onClick,
  style
}) => {
  const CELL_SIZE = 48;
  
  return (
    <div
      className={cn(
        'placement-target absolute z-10 transform -translate-x-1/2 -translate-y-1/2',
        isDouble && orientation === 'vertical' && '-mt-6',
        isDouble && orientation === 'horizontal' && '-ml-6'
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
    />
  );
};