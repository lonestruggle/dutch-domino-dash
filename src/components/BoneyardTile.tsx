import React from 'react';
import { cn } from '@/lib/utils';
import { skinBackgroundStyle, DominoSkin } from '@/hooks/useDominoSkins';

interface BoneyardTileProps {
  index: number;
  skin?: Pick<DominoSkin, 'image_url' | 'css_background'> | null;
  onClick: () => void;
  className?: string;
}

/**
 * Face-down domino tile for the boneyard.
 * - No center divider stripe
 * - Stable pseudo-random rotation/offset per index
 * - Renders the host-chosen skin on the back
 */
export const BoneyardTile: React.FC<BoneyardTileProps> = ({ index, skin, onClick, className }) => {
  const seed = (index * 9301 + 49297) % 233280;
  const rand = (n: number) => ((seed * (n + 1)) % 100) / 100;
  const randomX = rand(1) * 8 - 4;
  const randomY = rand(2) * 8 - 4;
  const randomRotation = rand(3) * 30 - 15; // -15..+15 deg

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Trek deze steen"
      className={cn(
        'relative group cursor-pointer transition-all duration-200',
        'hover:scale-110 hover:-translate-y-1 focus:outline-none',
        'focus-visible:ring-2 focus-visible:ring-yellow-400 rounded-md',
        className,
      )}
      style={{
        transform: `translate(${randomX}px, ${randomY}px) rotate(${randomRotation}deg)`,
        filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))',
      }}
    >
      <div
        className="w-14 h-7 rounded-md border border-black/40 ring-1 ring-white/10 group-hover:ring-yellow-400 transition-colors overflow-hidden"
        style={{
          ...skinBackgroundStyle(skin),
          boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.15), inset 0 -2px 3px rgba(0,0,0,0.35)',
        }}
      />
    </button>
  );
};