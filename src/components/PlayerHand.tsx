import React from 'react';
import { DominoTile } from './DominoTile';
import { DominoData } from '@/types/domino';
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
  return (
    <div className="p-2 md:p-4">
      <h2 className="text-sm md:text-lg font-semibold mb-2 text-center text-ui-text">
        Jouw Hand
      </h2>
      
      {/* Mobile-optimized hand layout */}
      <div className="flex flex-wrap justify-center gap-1 md:gap-2 min-h-[50px] md:min-h-[64px] max-h-[120px] md:max-h-none overflow-y-auto">
        {hand.map((domino, index) => (
          <div key={getDominoKey(domino, index)} className="flex-shrink-0">
            <DominoTile
              data={domino}
              orientation={isDouble(domino) ? "vertical" : "horizontal"}
              selected={index === selectedIndex}
              onClick={() => onDominoSelect(index)}
              className={`relative hover:scale-105 transition-transform ${
                // Smaller dominoes on mobile
                'scale-75 md:scale-100'
              }`}
            />
          </div>
        ))}
      </div>
    </div>
  );
});