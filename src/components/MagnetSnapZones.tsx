import React from 'react';
import { SnapZone } from '@/hooks/useMagnetDomino';
import { cn } from '@/lib/utils';

interface MagnetSnapZonesProps {
  snapZones: SnapZone[];
  cellSize?: number;
  highlightedZone?: SnapZone | null;
}

export const MagnetSnapZones: React.FC<MagnetSnapZonesProps> = ({
  snapZones,
  cellSize = 48,
  highlightedZone
}) => {
  if (snapZones.length === 0) return null;
  
  return (
    <>
      {snapZones.map((zone, index) => (
        <div
          key={`${zone.x}-${zone.y}-${zone.orientation}-${zone.flipped ? 'f' : 'nf'}-${index}`}
          className={cn(
            'absolute border-2 border-dashed rounded-md pointer-events-none transition-all duration-200',
            highlightedZone === zone 
              ? 'border-primary bg-primary/20 scale-110' 
              : 'border-primary/40 bg-primary/10'
          )}
          style={{
            left: zone.x * cellSize + (cellSize * (zone.orientation === 'horizontal' ? 2 : 1)) / 2,
            top: zone.y * cellSize + (cellSize * (zone.orientation === 'vertical' ? 2 : 1)) / 2,
            width: zone.orientation === 'horizontal' ? cellSize * 2 : cellSize,
            height: zone.orientation === 'horizontal' ? cellSize : cellSize * 2,
            zIndex: highlightedZone === zone ? 30 : 20,
            transform: 'translate(-50%, -50%)'
          }}
        >
          {/* Connection point indicator */}
          <div 
            className={cn(
              'absolute w-2 h-2 rounded-full bg-primary',
              zone.orientation === 'horizontal' 
                ? 'top-1/2 -translate-y-1/2' 
                : 'left-1/2 -translate-x-1/2'
            )}
            style={{
              left: zone.orientation === 'horizontal' ? (zone.flipped ? '100%' : '-4px') : '50%',
              top: zone.orientation === 'vertical' ? (zone.flipped ? '100%' : '-4px') : '50%',
            }}
          />
          
          {/* Value indicator */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-primary bg-background/80 rounded px-1">
              {zone.value}
            </span>
          </div>
        </div>
      ))}
    </>
  );
};