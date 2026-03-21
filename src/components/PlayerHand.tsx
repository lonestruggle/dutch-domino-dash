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
  isMyTurn?: boolean;
}

const isDouble = (data: DominoData) => data.value1 === data.value2;

// Generate a stable key for each domino based on its values (canonical order)
const getDominoKey = (domino: DominoData, index: number) => 
  `${Math.min(domino.value1, domino.value2)}-${Math.max(domino.value1, domino.value2)}-${index}`;

export const PlayerHand: React.FC<PlayerHandProps> = React.memo(({
  hand,
  selectedIndex,
  onDominoSelect,
  isMyTurn = true
}) => {
  const isMobile = useIsMobile();
  const { settings } = useGameVisualSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const safeHandScale = (() => {
    const requestedScale = Number.isFinite(settings.handDominoScale) ? settings.handDominoScale : 1;
    const dominoWidth = Number.isFinite(settings.dominoWidth) ? settings.dominoWidth : 80;
    // Keep hand tiles readable on small screens, even when board width/scale is set high.
    const maxByWidth = (isMobile ? 76 : 96) / Math.max(40, dominoWidth);
    const hardMax = isMobile ? 0.95 : 1.2;
    return Math.max(0.35, Math.min(requestedScale, hardMax, maxByWidth));
  })();

  // Dynamische gap op basis van handDominoScale
  const baseGap = isMobile ? 2 : 12; // px
  const gapPx = Math.max(1, Math.round(baseGap * safeHandScale));

  // Update hand domino scale CSS variables - force immediate update and listen for global changes
  useEffect(() => {
    const toSafeHandScale = (scale: number, dominoWidth: number) => {
      const requestedScale = Number.isFinite(scale) ? scale : 1;
      const safeWidth = Number.isFinite(dominoWidth) ? dominoWidth : 80;
      const maxByWidth = (isMobile ? 76 : 96) / Math.max(40, safeWidth);
      const hardMax = isMobile ? 0.95 : 1.2;
      return Math.max(0.35, Math.min(requestedScale, hardMax, maxByWidth));
    };

    const applyScale = (scale: number, dominoWidth: number) => {
      if (containerRef.current) {
        containerRef.current.style.setProperty('--hand-domino-scale', toSafeHandScale(scale, dominoWidth).toString());
        // Force reflow to ensure immediate visual update
        containerRef.current.offsetHeight;
      }
    };

    // Initial apply from local hook
    applyScale(settings.handDominoScale, settings.dominoWidth);

    // Listen for globally broadcast updates from controls
    const handleUpdate = (e: Event) => {
      try {
        const custom = e as CustomEvent;
        const latestSettings = custom.detail?.settings ?? (window as any).__dominoSettings ?? {};
        const newScale = latestSettings.handDominoScale;
        const newDominoWidth = latestSettings.dominoWidth;
        if (typeof newScale === 'number' || typeof newDominoWidth === 'number') {
          applyScale(
            typeof newScale === 'number' ? newScale : settings.handDominoScale,
            typeof newDominoWidth === 'number' ? newDominoWidth : settings.dominoWidth
          );
        }
      } catch {}
    };

    window.addEventListener('visualSettingsUpdated', handleUpdate);

    return () => {
      window.removeEventListener('visualSettingsUpdated', handleUpdate);
    };
  }, [isMobile, settings.dominoWidth, settings.handDominoScale]);
  
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
            rotateX={settings.rotateX}
            rotateY={settings.rotateY}
            rotateZ={settings.rotateZ}
            onClick={isMyTurn ? () => onDominoSelect(index) : undefined}
            className="relative transition-all duration-200 domino-tile-hand hover:z-20"
          />
        ))}
      </div>
    </div>
  );
});