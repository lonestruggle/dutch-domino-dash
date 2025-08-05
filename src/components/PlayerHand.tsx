import React from 'react';
import { DominoTile } from './DominoTile';
import { DominoData } from '@/types/domino';
import { useIsMobile } from '@/hooks/use-mobile';
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
  
  return (
    <div className={`game-ui ${isMobile ? "p-3" : "p-6"}`}>
      <h2 className={`font-semibold mb-4 text-center text-ui-text ${isMobile ? "text-base" : "text-lg"}`}>
        Jouw Hand
      </h2>
      
      <div className={`flex flex-wrap justify-center gap-2 min-h-[64px] ${isMobile ? "p-1" : "p-2"}`}>
        {hand.map((domino, index) => (
          <DominoTile
            key={getDominoKey(domino, index)} // More stable key
            data={domino}
            orientation={isDouble(domino) ? "vertical" : "horizontal"}
            selected={index === selectedIndex}
            onClick={() => onDominoSelect(index)}
            className={`relative transition-transform active:scale-95 ${
              isMobile 
                ? "m-0.5 hover:scale-90 active:scale-85 !scale-[0.4] transform" 
                : "m-1 hover:scale-105"
            }`}
          />
        ))}
      </div>
    </div>
  );
});