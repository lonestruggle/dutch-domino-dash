import React, { useEffect, useRef, useState } from 'react';
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
  flippedTiles?: Record<number, boolean>;
  onTileDoubleClick?: (index: number) => void;
}

const isDouble = (data: DominoData) => data.value1 === data.value2;

// Generate a stable key for each domino based on its values (canonical order)
const getDominoKey = (domino: DominoData, index: number) => 
  `${Math.min(domino.value1, domino.value2)}-${Math.max(domino.value1, domino.value2)}-${index}`;

// ===== Handschoen-uitlijning (instelbaar via UI, persistent in localStorage) =====
// Elke sleuf in de handschoen krijgt zijn eigen positie/hoek zodat de
// stenen exact in de doorzichtige (mogelijk gekantelde) sleuven vallen.
interface SlotConfig {
  xPct: number;      // horizontale positie binnen handschoen (% breedte)
  yPct: number;      // verticale positie (% hoogte van handschoen-aspect)
  rotateDeg: number; // rotatie van de steen
  scale: number;     // schaal van de steen
}

interface GloveAlignment {
  widthMobile: number;       // totale breedte handschoen (px) mobile
  widthDesktop: number;      // totale breedte handschoen (px) desktop
  aspectRatio: number;       // hoogte / breedte van de handschoen-container
  slots: SlotConfig[];       // 7 sleuven
  slotsMirrored?: SlotConfig[]; // optionele override voor gespiegelde handschoen
}

const DEFAULT_SLOTS: SlotConfig[] = [
  { xPct: 12, yPct: 48, rotateDeg: -14, scale: 1 },
  { xPct: 24, yPct: 44, rotateDeg: -8,  scale: 1 },
  { xPct: 37, yPct: 42, rotateDeg: -3,  scale: 1 },
  { xPct: 50, yPct: 42, rotateDeg: 0,   scale: 1 },
  { xPct: 63, yPct: 42, rotateDeg: 3,   scale: 1 },
  { xPct: 76, yPct: 44, rotateDeg: 8,   scale: 1 },
  { xPct: 88, yPct: 48, rotateDeg: 14,  scale: 1 },
];

const DEFAULT_GLOVE_ALIGN: GloveAlignment = {
  widthMobile: 340,
  widthDesktop: 520,
  aspectRatio: 0.55,
  slots: DEFAULT_SLOTS,
};

const GLOVE_ALIGN_KEY = 'gloveAlignment.v2';

function loadGloveAlignment(): GloveAlignment {
  try {
    const raw = localStorage.getItem(GLOVE_ALIGN_KEY);
    if (!raw) return DEFAULT_GLOVE_ALIGN;
    const parsed = JSON.parse(raw);
    const merged: GloveAlignment = { ...DEFAULT_GLOVE_ALIGN, ...parsed };
    if (!Array.isArray(merged.slots) || merged.slots.length !== 7) {
      merged.slots = DEFAULT_SLOTS;
    }
    return merged;
  } catch {
    return DEFAULT_GLOVE_ALIGN;
  }
}

export const PlayerHand: React.FC<PlayerHandProps> = React.memo(({
  hand,
  selectedIndex,
  onDominoSelect,
  isMyTurn = true,
  flippedTiles,
  onTileDoubleClick,
}) => {
  const isMobile = useIsMobile();
  const { settings } = useGameVisualSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const [align, setAlign] = useState<GloveAlignment>(() => loadGloveAlignment());
  const [showAligner, setShowAligner] = useState(false);

  const updateAlign = (patch: Partial<GloveAlignment>) => {
    setAlign(prev => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(GLOVE_ALIGN_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const resetAlign = () => {
    setAlign(DEFAULT_GLOVE_ALIGN);
    try { localStorage.removeItem(GLOVE_ALIGN_KEY); } catch {}
  };

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

  // Split hand into chunks of 7 (one glove per chunk, alternating mirrored)
  const chunkSize = 7;
  const chunks: { items: DominoData[]; startIndex: number }[] = [];
  for (let i = 0; i < hand.length; i += chunkSize) {
    chunks.push({ items: hand.slice(i, i + chunkSize), startIndex: i });
  }
  if (chunks.length === 0) chunks.push({ items: [], startIndex: 0 });

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
      <div className="flex items-center justify-center gap-2 mb-2 relative">
        <h2 className={`font-semibold text-center text-ui-text ${isMobile ? "text-sm" : "text-lg"}`}>
          Jouw Hand
        </h2>
        <button
          type="button"
          onClick={() => setShowAligner(s => !s)}
          className="text-xs px-2 py-0.5 rounded border border-ui-border bg-ui-bg/60 hover:bg-ui-bg text-ui-text"
          title="Handschoen uitlijnen"
        >
          ⚙︎
        </button>
      </div>

      {showAligner && (
        <GloveAligner
          align={align}
          isMobile={isMobile}
          onChange={updateAlign}
          onReset={resetAlign}
          onClose={() => setShowAligner(false)}
        />
      )}

      <div className="flex flex-col items-center" style={{ gap: `${gapPx}px` }}>
        {chunks.map((chunk, chunkIdx) => {
          const mirrored = chunkIdx % 2 === 1;
          const perSlot = isMobile ? align.widthPerSlotMobile : align.widthPerSlotDesktop;
          return (
            <div
              key={`glove-chunk-${chunkIdx}`}
              className="relative"
              style={{
                // Width scales with number of slots in this chunk (instelbaar)
                width: `min(96vw, ${perSlot * chunkSize}px)`,
              }}
            >
              {/* Glove background */}
              <img
                src="/glove-hand-holder.png"
                alt=""
                aria-hidden="true"
                draggable={false}
                className="absolute inset-0 w-full h-auto pointer-events-none select-none"
                style={{
                  transform: mirrored ? 'scaleX(-1)' : undefined,
                  zIndex: 0,
                }}
              />
              {/* Domino row positioned over the transparent slot zone of the glove */}
              <div
                className="relative flex justify-center items-end"
                style={{
                  gap: `${gapPx + align.gapExtra}px`,
                  paddingTop: `${align.paddingTop}%`,
                  paddingBottom: `${align.paddingBottom}%`,
                  paddingLeft: `${align.paddingLeft}%`,
                  paddingRight: `${align.paddingRight}%`,
                  zIndex: 1,
                }}
              >
                {chunk.items.map((domino, i) => {
                  const index = chunk.startIndex + i;
                  return (
                    <div
                      key={getDominoKey(domino, index)}
                      onDoubleClick={onTileDoubleClick ? (e) => { e.stopPropagation(); onTileDoubleClick(index); } : undefined}
                      className="relative"
                      style={{ transform: align.dominoScale !== 1 ? `scale(${align.dominoScale})` : undefined, transformOrigin: 'bottom center' }}
                    >
                      <DominoTile
                        data={domino}
                        orientation={isDouble(domino) ? "vertical" : "horizontal"}
                        flipped={!!flippedTiles?.[index]}
                        selected={index === selectedIndex}
                        rotateX={settings.rotateX}
                        rotateY={settings.rotateY}
                        rotateZ={settings.rotateZ}
                        onClick={isMyTurn ? () => onDominoSelect(index) : undefined}
                        className="relative transition-all duration-200 domino-tile-hand hover:z-20"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ===== Inline aligner panel =====
interface GloveAlignerProps {
  align: GloveAlignment;
  isMobile: boolean;
  onChange: (patch: Partial<GloveAlignment>) => void;
  onReset: () => void;
  onClose: () => void;
}

const GloveAligner: React.FC<GloveAlignerProps> = ({ align, isMobile, onChange, onReset, onClose }) => {
  const copyJSON = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(align, null, 2));
      alert('Uitlijning gekopieerd naar klembord. Stuur deze aan Lovable om vast in te bouwen.');
    } catch {
      prompt('Kopieer onderstaande waarden:', JSON.stringify(align));
    }
  };

  const Row: React.FC<{ label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (n: number) => void }> = ({ label, value, min, max, step = 1, suffix = '', onChange }) => (
    <label className="flex items-center gap-2 text-xs text-ui-text">
      <span className="w-36 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1"
      />
      <span className="w-14 text-right tabular-nums">{value}{suffix}</span>
    </label>
  );

  return (
    <div className="mb-3 mx-auto max-w-md p-3 rounded-lg border border-ui-border bg-ui-bg/95 shadow-lg text-ui-text">
      <div className="flex items-center justify-between mb-2">
        <strong className="text-sm">Handschoen uitlijnen</strong>
        <div className="flex gap-1">
          <button type="button" onClick={onReset} className="text-xs px-2 py-0.5 rounded border border-ui-border hover:bg-black/5">Reset</button>
          <button type="button" onClick={copyJSON} className="text-xs px-2 py-0.5 rounded border border-ui-border hover:bg-black/5">Kopieer</button>
          <button type="button" onClick={onClose} className="text-xs px-2 py-0.5 rounded border border-ui-border hover:bg-black/5">Sluit</button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Row label={isMobile ? 'Breedte per sleuf (mobile)' : 'Breedte per sleuf (desktop)'}
             value={isMobile ? align.widthPerSlotMobile : align.widthPerSlotDesktop}
             min={20} max={140} step={1} suffix="px"
             onChange={(n) => onChange(isMobile ? { widthPerSlotMobile: n } : { widthPerSlotDesktop: n })} />
        <Row label="Padding boven" value={align.paddingTop} min={0} max={60} step={0.5} suffix="%" onChange={(n) => onChange({ paddingTop: n })} />
        <Row label="Padding onder" value={align.paddingBottom} min={0} max={60} step={0.5} suffix="%" onChange={(n) => onChange({ paddingBottom: n })} />
        <Row label="Padding links" value={align.paddingLeft} min={0} max={30} step={0.5} suffix="%" onChange={(n) => onChange({ paddingLeft: n })} />
        <Row label="Padding rechts" value={align.paddingRight} min={0} max={30} step={0.5} suffix="%" onChange={(n) => onChange({ paddingRight: n })} />
        <Row label="Extra gap" value={align.gapExtra} min={-10} max={30} step={1} suffix="px" onChange={(n) => onChange({ gapExtra: n })} />
        <Row label="Steen schaal" value={align.dominoScale} min={0.4} max={1.6} step={0.02} onChange={(n) => onChange({ dominoScale: n })} />
      </div>
      <p className="mt-2 text-[10px] opacity-70">Waarden worden lokaal opgeslagen. Klik "Kopieer" en stuur ze aan mij zodat ik ze als standaard kan inbouwen.</p>
    </div>
  );
};