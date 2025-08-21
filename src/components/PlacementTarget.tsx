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
  const { settings } = useGameVisualSettings();
  
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
        // Use domino settings for exact size matching with dominoes
        width: `${width * settings.dominoWidth}px`,
        height: `${height * settings.dominoHeight}px`,
        left: style?.left,
        top: style?.top,
        // No additional transform scaling needed - size is already proportional
        transformOrigin: 'top left',
        transition: 'background-color 0.2s ease',
        ...style,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onTouchStart={isMobile ? (e) => e.stopPropagation() : undefined}
    />
  );
};