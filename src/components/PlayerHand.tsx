import React from 'react';
import { DominoTile } from './DominoTile';
import { DominoData } from '@/types/domino';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

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
    <div className="game-ui p-6">
      <h2 className="text-lg font-semibold mb-4 text-center text-ui-text">
        Jouw Hand
      </h2>
      
      <div className={cn(
        "flex flex-wrap justify-center min-h-[64px] p-2",
        isMobile ? "gap-1" : "gap-2"
      )}>
        {hand.map((domino, index) => (
          <DominoTile
            key={getDominoKey(domino, index)} // More stable key
            data={domino}
            orientation={isDouble(domino) ? "vertical" : "horizontal"}
            selected={index === selectedIndex}
            onClick={() => onDominoSelect(index)}
            className={cn(
              "relative hover:scale-105 transition-transform",
              isMobile ? "m-0.5" : "m-1"
            )}
          />
        ))}
      </div>
    </div>
  );
});