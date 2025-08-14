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

// Generate a stable key for each domino based on its values (canonical order)
const getDominoKey = (domino: DominoData, index: number) => 
  `${Math.min(domino.value1, domino.value2)}-${Math.max(domino.value1, domino.value2)}-${index}`;

export const PlayerHand: React.FC<PlayerHandProps> = React.memo(({
  hand,
  selectedIndex,
  onDominoSelect
}) => {
  const isMobile = useIsMobile();
  const { settings } = useGameVisualSettings();
  const containerRef = useRef<HTMLDivElement>(null);

  // Dynamische gap op basis van handDominoScale
  const baseGap = isMobile ? 4 : 12; // px
  const gapPx = Math.max(1, Math.round(baseGap * (settings.handDominoScale ?? 1)));

  // Update hand domino scale CSS variables - force immediate update and listen for global changes
  useEffect(() => {
    const applyScale = (scale: number) => {
      if (containerRef.current) {
        containerRef.current.style.setProperty('--hand-domino-scale', scale.toString());
        // Force reflow to ensure immediate visual update
        containerRef.current.offsetHeight;
      }
    };

    // Initial apply from local hook
    applyScale(settings.handDominoScale);

    // Listen for globally broadcast updates from controls
    const handleUpdate = (e: Event) => {
      try {
        const custom = e as CustomEvent;
        const newScale = (custom.detail?.settings?.handDominoScale) ?? (window as any).__dominoSettings?.handDominoScale;
        if (typeof newScale === 'number') applyScale(newScale);
      } catch {}
    };

    window.addEventListener('visualSettingsUpdated', handleUpdate);

    return () => {
      window.removeEventListener('visualSettingsUpdated', handleUpdate);
    };
  }, [settings.handDominoScale]);
  
  return (
    <div ref={containerRef} className={`game-ui ${isMobile ? "p-2" : "p-6"}`}>
      <h2 className={`font-semibold text-center text-ui-text ${isMobile ? "text-sm mb-2" : "text-lg mb-4"}`}>
        Jouw Hand
      </h2>
      
      <div
        className={`flex flex-wrap justify-center min-h-[48px] ${isMobile ? "px-2" : "p-2"}`}
        style={{ gap: `${gapPx}px` }}
      >
        {hand.map((domino, index) => (
          <DominoTile
            key={getDominoKey(domino, index)}
            data={domino}
            orientation={isDouble(domino) ? "vertical" : "horizontal"}
            selected={index === selectedIndex}
            onClick={() => onDominoSelect(index)}
            className="relative transition-all duration-200 domino-tile-hand hover:z-20"
          />
        ))}
      </div>
    </div>
  );
});