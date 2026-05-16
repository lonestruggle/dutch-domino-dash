import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BoneyardTile } from '@/components/BoneyardTile';
import { DominoSkin } from '@/hooks/useDominoSkins';

interface Props {
  /** Aantal vaste slots in de layout (default 26 voor Wega di sen). */
  slotCount?: number;
  /** Per slot of de tegel nog beschikbaar is. Lege slots worden niet getekend. */
  available?: Array<boolean>;
  skin?: Pick<DominoSkin, 'image_url' | 'css_background'> | null;
  onPick: (index: number) => void;
}

const TILE_W = 56;
const TILE_H = 28;
const MIN_DIST = 64;

export const BoneyardScatter: React.FC<Props> = ({ slotCount = 26, available, skin, onPick }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const { positions, height } = useMemo(() => {
    const w = Math.max(width, 240);
    const margin = 36;
    const cols = Math.max(3, Math.floor((w - margin * 2) / 80));
    const rows = Math.ceil(slotCount / cols);
    const h = Math.max(rows * 78 + margin * 2, 240);

    // Seeded RNG op basis van vast slotCount → posities blijven stabiel bij elke draw.
    let s = 987654321 + slotCount * 31;
    const rng = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };

    const placed: { x: number; y: number; rotation: number }[] = [];
    for (let i = 0; i < slotCount; i++) {
      let spot: { x: number; y: number; rotation: number } | null = null;
      for (let attempt = 0; attempt < 250; attempt++) {
        const x = margin + rng() * (w - margin * 2);
        const y = margin + rng() * (h - margin * 2);
        const ok = placed.every(p => Math.hypot(p.x - x, p.y - y) >= MIN_DIST);
        if (ok) { spot = { x, y, rotation: rng() * 120 - 60 }; break; }
      }
      if (!spot) {
        for (let relax = 0.9; relax > 0.4 && !spot; relax -= 0.1) {
          for (let attempt = 0; attempt < 80; attempt++) {
            const x = margin + rng() * (w - margin * 2);
            const y = margin + rng() * (h - margin * 2);
            const ok = placed.every(p => Math.hypot(p.x - x, p.y - y) >= MIN_DIST * relax);
            if (ok) { spot = { x, y, rotation: rng() * 120 - 60 }; break; }
          }
        }
      }
      if (!spot) {
        spot = { x: margin + (i % cols) * 80 + 40, y: margin + Math.floor(i / cols) * 78 + 39, rotation: rng() * 120 - 60 };
      }
      placed.push(spot);
    }
    return { positions: placed, height: h };
  }, [width, slotCount]);

  return (
    <div
      ref={ref}
      className="relative w-full overflow-auto rounded-xl"
      style={{
        height,
        background: 'radial-gradient(ellipse at center, hsl(155 45% 28%) 0%, hsl(155 55% 18%) 100%)',
        boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.45), inset 0 -2px 6px rgba(255,255,255,0.05)',
        border: '1px solid hsl(40 35% 35% / 0.5)',
      }}
    >
      {positions.map((p, i) => {
        const isAvailable = available ? !!available[i] : true;
        if (!isAvailable) return null;
        return (
          <BoneyardTile
            key={i}
            index={i}
            skin={skin}
            onClick={() => onPick(i)}
            placement={p}
          />
        );
      })}
    </div>
  );
};

export default BoneyardScatter;
