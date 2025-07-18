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

export const PlayerHand: React.FC<PlayerHandProps> = ({
  hand,
  selectedIndex,
  onDominoSelect
}) => {
  return (
    <div className="game-ui p-6">
      <h2 className="text-lg font-semibold mb-4 text-center text-ui-text">
        Jouw Hand
      </h2>
      
      <div className="flex flex-wrap justify-center gap-2 min-h-[64px] p-2">
        {hand.map((domino, index) => (
          <DominoTile
            key={index}
            data={domino}
            orientation={isDouble(domino) ? "vertical" : "horizontal"}
            selected={index === selectedIndex}
            onClick={() => onDominoSelect(index)}
            className="relative m-1 hover:scale-105 transition-transform"
          />
        ))}
      </div>
    </div>
  );
};