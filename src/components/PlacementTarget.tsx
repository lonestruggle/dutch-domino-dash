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
  isBlueHighlight?: boolean; // NIEUWE PROP VOOR BLAUW HIGHLIGHT
  isHeadEnd?: boolean; // NIEUWE PROP VOOR KOP
  isTailEnd?: boolean; // NIEUWE PROP VOOR STAART
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
  isBlueHighlight = false, // DEFAULT FALSE
  isHeadEnd = false, // DEFAULT FALSE
  isTailEnd = false // DEFAULT FALSE
}) => {
  const isMobile = useIsMobile();
  const CELL_SIZE = 48;
  const MOBILE_CELL_SIZE = 30;
  
  return (
    <div
      className={cn(
        'placement-target absolute z-10 transform -translate-x-1/2 -translate-y-1/2',
        isBlueHighlight && 'placement-target-blue', // BLAUW HIGHLIGHT VOOR ALLE MOVES
        isHeadEnd && 'placement-target-head', // GROENE KLEUR VOOR KOP
        isTailEnd && 'placement-target-tail', // ORANJE KLEUR VOOR STAART
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
    />
  );
};