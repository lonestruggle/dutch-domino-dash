import React, { useEffect, useRef } from 'react';
import { DominoTile } from './DominoTile';
import { DominoData } from '@/types/domino';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGameVisualSettings } from '@/hooks/useGameVisualSettings';
import { cn } from '@/lib/utils';

interface PlayerHandProps {
  hand: DominoData[];
  selectedIndex: number | null;
  onDominoSelect: (index: number) => void;
}

const isDouble = (data: DominoData) => data.value1 === data.value2;

// Generate a stable key for each domino based on its values
const getDominoKey = (domino: DominoData, index: number) => 
  `${domino.value1}-${domino.value2}-${index}`;

export const PlayerHand: React.FC<PlayerHandProps> = React.memo(({
  hand,
  selectedIndex,
  onDominoSelect
}) => {
  const isMobile = useIsMobile();
  const { settings } = useGameVisualSettings();
  const containerRef = useRef<HTMLDivElement>(null);

  // Update hand domino scale CSS variables
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.setProperty('--hand-domino-scale', settings.handDominoScale.toString());
    }
  }, [settings.handDominoScale]);
  
  return (
    <div ref={containerRef} className={`game-ui ${isMobile ? "p-2" : "p-6"}`}>
      <h2 className={`font-semibold text-center text-ui-text ${isMobile ? "text-sm mb-2" : "text-lg mb-4"}`}>
        Jouw Hand
      </h2>
      
      <div className={`flex flex-wrap justify-center gap-0.5 min-h-[48px] -space-y-2 ${isMobile ? "p-0" : "p-2"}`}>
        {hand.map((domino, index) => (
          <DominoTile
            key={getDominoKey(domino, index)}
            data={domino}
            orientation={isDouble(domino) ? "vertical" : "horizontal"}
            selected={index === selectedIndex}
            onClick={() => onDominoSelect(index)}
            className={`relative transition-transform active:scale-95 domino-tile-hand ${
              isMobile 
                ? "-mr-6 hover:z-10" 
                : "m-1"
            }`}
          />
        ))}
      </div>
    </div>
  );
});