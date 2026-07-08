import React, { useEffect, useRef, useState } from 'react';
import { DominoTile } from './DominoTile';
import { DominoData } from '@/types/domino';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGameVisualSettings } from '@/hooks/useGameVisualSettings';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useUserPermissions } from '@/hooks/useUserPermissions';
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
  // Vastgezet op basis van glove-hand-holder.png: 5 stenen vallen over de
  // doorzichtige sleuven, de 6e ligt er strak naast. Rotatie/schaal zijn zo
  // gekozen dat de transparante voorbeeldstenen grotendeels worden afgedekt.
  { xPct: 13.5, yPct: 60.5, rotateDeg: -15, scale: 1.55 },
  { xPct: 31.0, yPct: 59.2, rotateDeg: -15, scale: 1.55 },
  { xPct: 48.8, yPct: 58.8, rotateDeg: -15, scale: 1.55 },
  { xPct: 66.8, yPct: 59.2, rotateDeg: -15, scale: 1.55 },
  { xPct: 84.3, yPct: 60.2, rotateDeg: -15, scale: 1.55 },
  { xPct: 96.0, yPct: 58.5, rotateDeg: -15, scale: 1.55 },
];

const DEFAULT_GLOVE_ALIGN: GloveAlignment = {
  widthMobile: 300,
  widthDesktop: 210,
  aspectRatio: 0.67,
  slots: DEFAULT_SLOTS,
};

const GLOVE_ALIGN_KEY = 'gloveAlignment.v9';

function loadGloveAlignment(): GloveAlignment {
  try {
    const raw = localStorage.getItem(GLOVE_ALIGN_KEY);
    if (!raw) return DEFAULT_GLOVE_ALIGN;
    const parsed = JSON.parse(raw);
    const merged: GloveAlignment = { ...DEFAULT_GLOVE_ALIGN, ...parsed };
    if (!Array.isArray(merged.slots) || merged.slots.length !== 6) {
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
  const [dragMode, setDragMode] = useState(false);
  const [calibrateStep, setCalibrateStep] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 360
  );

  // Refs per handschoen-container zodat we tijdens slepen de rect kunnen uitlezen.
  const gloveRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const update = () => setContainerWidth(el.clientWidth || window.innerWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const updateAlign = (patch: Partial<GloveAlignment>) => {
    setAlign(prev => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(GLOVE_ALIGN_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // Schrijf één sleuf weg naar de juiste zijde (links = slots, rechts = slotsMirrored).
  const writeSlot = (mirrored: boolean, slotIndex: number, patch: Partial<SlotConfig>) => {
    setAlign(prev => {
      const baseArr = mirrored
        ? (prev.slotsMirrored ?? prev.slots.map(s => ({
            ...s, xPct: 100 - s.xPct, rotateDeg: -s.rotateDeg,
          })))
        : prev.slots;
      const nextArr = baseArr.map((s, i) => i === slotIndex ? { ...s, ...patch } : s);
      const next: GloveAlignment = mirrored
        ? { ...prev, slotsMirrored: nextArr }
        : { ...prev, slots: nextArr };
      try { localStorage.setItem(GLOVE_ALIGN_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const resetOneSlot = (mirrored: boolean, slotIndex: number) => {
    const def = DEFAULT_SLOTS[slotIndex] ?? DEFAULT_SLOTS[0];
    const patch = mirrored
      ? { xPct: 100 - def.xPct, yPct: def.yPct, rotateDeg: -def.rotateDeg, scale: def.scale }
      : { ...def };
    writeSlot(mirrored, slotIndex, patch);
  };

  // Actieve drag-sessie
  const dragRef = useRef<null | {
    pointerId: number;
    chunkIdx: number;
    mirrored: boolean;
    slotIndex: number;
    mode: 'move' | 'rotate';
    startRotate: number;
    startAngle: number;
  }>(null);

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
  const baseGap = isMobile ? 12 : 40; // px - extra ruimte zodat overhangende stenen niet over de buurman heen vallen
  const gapPx = Math.max(1, Math.round(baseGap * safeHandScale));

  const getHorizontalFootprint = (slots: SlotConfig[], gloveWidth: number) => {
    const dominoBaseWidth = Number.isFinite(settings.dominoWidth) ? settings.dominoWidth : 80;
    const tileWidth = dominoBaseWidth / 2;
    const tileHeight = dominoBaseWidth;
    const rotateZ = Number.isFinite(settings.rotateZ) ? settings.rotateZ : 0;
    const buffer = isMobile ? 10 : 14;

    return slots.reduce(
      (acc, slot) => {
        const rotation = ((slot.rotateDeg + rotateZ) * Math.PI) / 180;
        const horizontalSpan =
          (Math.abs(tileWidth * Math.cos(rotation)) + Math.abs(tileHeight * Math.sin(rotation))) * slot.scale;
        const halfSpan = horizontalSpan / 2 + buffer;
        const centerX = (slot.xPct / 100) * gloveWidth;

        return {
          left: Math.max(acc.left, halfSpan - centerX),
          right: Math.max(acc.right, centerX + halfSpan - gloveWidth),
        };
      },
      { left: 0, right: 0 }
    );
  };

  // Each glove holds up to 6 slots. We assign each domino a STABLE (glove, slot)
  // position so that when a stone is played, the others in that glove keep their
  // place instead of shifting in from the next glove. Eerste 6 stenen vullen
  // handschoen 1, daarna 6 in handschoen 2, en alles daarboven om-en-om.
  const chunkSize = 6;
  const [selectedSlot, setSelectedSlot] = useState(0);
  const COMPACT_THRESHOLD = 5;

  // Handschoen-/hand-instellingen zijn alleen voor admin/dev zichtbaar.
  const { canAccessDevTools } = useUserRoles();
  const { canUseBeta } = useUserPermissions();
  const canUseGloveFeatures = canAccessDevTools || canUseBeta;

  // Persoonlijke voorkeur: stenen automatisch naar elkaar toe schuiven na een zet.
  const AUTO_COMPACT_KEY = 'playerHand.autoCompact';
  const [autoCompact, setAutoCompact] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(AUTO_COMPACT_KEY);
      return raw === null ? true : raw === 'true';
    } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem(AUTO_COMPACT_KEY, String(autoCompact)); } catch {}
  }, [autoCompact]);

  // canonicalKey -> { glove, slot }
  const assignmentsRef = useRef<Map<string, { glove: number; slot: number }>>(new Map());
  // Bump to force a re-compact (used by the "Samenvoegen" button)
  const [compactTick, setCompactTick] = useState(0);

  const canonicalKey = (d: DominoData) =>
    `${Math.min(d.value1, d.value2)}-${Math.max(d.value1, d.value2)}`;

  // Build chunks based on stable assignments
  const { chunks, indexByKey } = (() => {
    const map = assignmentsRef.current;
    const currentKeys = new Set(hand.map(canonicalKey));

    // Drop assignments for dominoes no longer in hand
    for (const k of Array.from(map.keys())) {
      if (!currentKeys.has(k)) map.delete(k);
    }

    // Auto-compact when enabled, when few stones remain, or when user clicked the compact button
    const assignPos = (i: number): { glove: number; slot: number } => {
      // Elke handschoen heeft `chunkSize` sleuven. Bij overschrijding wordt
      // een nieuwe handschoen toegevoegd zodat stenen niet op elkaar stapelen.
      return { glove: Math.floor(i / chunkSize), slot: i % chunkSize };
    };

    if (autoCompact || hand.length <= COMPACT_THRESHOLD || compactTick > 0) {
      map.clear();
      hand.forEach((d, i) => {
        map.set(canonicalKey(d), assignPos(i));
      });
      if (compactTick > 0) {
        // consume the tick on next render
        // (defer via microtask to avoid setState-in-render)
        queueMicrotask(() => setCompactTick(0));
      }
    } else {
      // Assign any new dominoes (e.g. drawn from boneyard) to the first free slot
      const occupied = new Set<string>();
      for (const { glove, slot } of map.values()) occupied.add(`${glove}:${slot}`);
      for (const d of hand) {
        const k = canonicalKey(d);
        if (map.has(k)) continue;
        let placed = false;
        // Doorloop posities in dezelfde volgorde als assignPos:
        // 0..5 = g0 s0..5, 6..11 = g1 s0..5, daarna om-en-om met s>=6.
        for (let i = 0; !placed; i++) {
          const pos = assignPos(i);
          const tag = `${pos.glove}:${pos.slot}`;
          if (!occupied.has(tag)) {
            map.set(k, pos);
            occupied.add(tag);
            placed = true;
          }
        }
      }
    }

    // Build chunks (sparse -> array with possible nulls per slot)
    const indexByKey = new Map<string, number>();
    hand.forEach((d, i) => indexByKey.set(canonicalKey(d), i));

    let maxGlove = 0;
    for (const { glove } of map.values()) maxGlove = Math.max(maxGlove, glove);
    const chunks: { items: (DominoData | null)[] }[] = [];
    for (let g = 0; g <= maxGlove; g++) {
      chunks.push({ items: new Array(chunkSize).fill(null) });
    }
    for (const d of hand) {
      const pos = map.get(canonicalKey(d));
      if (!pos) continue;
      chunks[pos.glove].items[pos.slot] = d;
    }
    if (chunks.length === 0) chunks.push({ items: new Array(chunkSize).fill(null) });
    return { chunks, indexByKey };
  })();

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
    <div ref={containerRef} className={`relative ${isMobile ? "p-2" : "p-6"}`}>
      <div className="absolute top-2 right-2 flex items-center gap-2 z-[90]">
        {canUseGloveFeatures && (
          <>
            <button
              type="button"
              onClick={() => setAutoCompact(v => !v)}
              className={`text-xs px-2 py-0.5 rounded border border-ui-border ${autoCompact ? 'bg-accent text-accent-foreground' : 'bg-ui-bg/60 hover:bg-ui-bg text-ui-text'}`}
              title="Automatisch stenen samenvoegen na een zet"
            >
              Auto-samenvoegen: {autoCompact ? 'aan' : 'uit'}
            </button>
            {!autoCompact && hand.length > COMPACT_THRESHOLD && chunks.length > 1 && (
              <button
                type="button"
                onClick={() => setCompactTick(t => t + 1)}
                className="text-xs px-2 py-0.5 rounded border border-ui-border bg-ui-bg/60 hover:bg-ui-bg text-ui-text"
                title="Stenen samenvoegen in zo min mogelijk handschoenen"
              >
                Samenvoegen
              </button>
            )}
            {canAccessDevTools && (
            <button
              type="button"
              onClick={() => setShowAligner(s => !s)}
              className="text-xs px-2 py-0.5 rounded border border-ui-border bg-ui-bg/60 hover:bg-ui-bg text-ui-text"
              title="Handschoen uitlijnen"
            >
              ⚙︎
            </button>
            )}
            {canAccessDevTools && showAligner && (
              <button
                type="button"
                onClick={() => setDragMode(d => !d)}
                className={`text-xs px-2 py-0.5 rounded border border-ui-border ${dragMode ? 'bg-accent text-accent-foreground' : 'bg-ui-bg/60 hover:bg-ui-bg text-ui-text'}`}
                title="Sleep sleuven direct op de handschoen. Shift+sleep = draaien. Dubbelklik = reset sleuf."
              >
                {dragMode ? '✋ Sleep aan' : '✋ Sleep'}
              </button>
            )}
            {canAccessDevTools && showAligner && (
              <button
                type="button"
                onClick={() => setCalibrateStep(s => (s === null ? 0 : null))}
                className={`text-xs px-2 py-0.5 rounded border border-ui-border ${calibrateStep !== null ? 'bg-accent text-accent-foreground' : 'bg-ui-bg/60 hover:bg-ui-bg text-ui-text'}`}
                title="Klik één voor één op elke sleuf in de handschoen. Klaar in 6 kliks."
              >
                {calibrateStep !== null ? `🎯 Klik sleuf ${calibrateStep + 1}/6` : '🎯 Klik-kalibratie'}
              </button>
            )}
          </>
        )}
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

      <div className={`relative z-0 flex flex-row-reverse flex-nowrap items-start justify-center ${showAligner ? 'mt-4' : '-mt-20'}`} style={{ gap: `${gapPx}px` }}>
        {chunks.map((chunk, chunkIdx) => {
          const mirrored = chunkIdx % 2 === 1;
          const desiredGloveWidth = isMobile ? align.widthMobile : align.widthDesktop;
          const desiredGloveHeight = desiredGloveWidth * align.aspectRatio;
          // Bouw eerst één vaste handschoen+stenen-groep op volledige grootte.
          // Daarna schalen we de complete groep in één keer, zodat de stenen
          // exact vast blijven zitten op hun sleuf in de handschoen.
          const horizontalPadding = isMobile ? 16 : 48;
          const gloveCount = Math.max(1, chunks.length);
          const totalGaps = gapPx * (gloveCount - 1);
          const availableWidth = Math.max(120, containerWidth - horizontalPadding - totalGaps);
          const perGloveWidth = availableWidth / gloveCount;
          const baseSlotsForChunk = mirrored
            ? (align.slotsMirrored ?? align.slots.map(s => ({
                ...s,
                xPct: 100 - s.xPct,
                rotateDeg: -s.rotateDeg,
              })))
            : align.slots;
          const slotsForChunk = baseSlotsForChunk;
          const footprint = getHorizontalFootprint(slotsForChunk, desiredGloveWidth);
          const desiredTotalWidth = desiredGloveWidth + footprint.left + footprint.right;
          const fitScale = Math.min(1, perGloveWidth / Math.max(1, desiredTotalWidth));
          return (
            <div
              key={`glove-chunk-${chunkIdx}`}
              className="relative"
              style={{
                width: `${desiredGloveWidth * fitScale}px`,
                height: `${desiredGloveHeight * fitScale}px`,
                marginLeft: `${Math.ceil(footprint.left * fitScale)}px`,
                marginRight: `${Math.ceil(footprint.right * fitScale)}px`,
              }}
            >
              <div
                className="absolute left-0 top-0 origin-top-left"
                ref={(el) => { gloveRefs.current.set(chunkIdx, el); }}
                style={{
                  width: `${desiredGloveWidth}px`,
                  height: `${desiredGloveHeight}px`,
                  transform: `scale(${fitScale})`,
                }}
              >
                {/* Glove background */}
                <img
                  src="/glove-hand-holder.png"
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                  style={{
                    transform: mirrored ? 'scaleX(-1)' : undefined,
                    zIndex: 0,
                  }}
                />
                {/* Elke steen zit vast op zijn sleuf; de buitenlaag schaalt alles samen. */}
                {chunk.items.map((domino, i) => {
                  if (!domino) return null;
                  const index = indexByKey.get(canonicalKey(domino)) ?? -1;
                  if (index < 0) return null;
                  const slot = slotsForChunk[i] ?? slotsForChunk[slotsForChunk.length - 1];
                  return (
                    <div
                      key={getDominoKey(domino, index)}
                      onDoubleClick={onTileDoubleClick ? (e) => { e.stopPropagation(); onTileDoubleClick(index); } : undefined}
                      onClick={() => { if (showAligner) setSelectedSlot(i); }}
                      onPointerDown={(e) => {
                        if (!showAligner || !dragMode) return;
                        e.preventDefault();
                        e.stopPropagation();
                        const glove = gloveRefs.current.get(chunkIdx);
                        if (!glove) return;
                        const rect = glove.getBoundingClientRect();
                        const cx = rect.left + (slot.xPct / 100) * rect.width;
                        const cy = rect.top + (slot.yPct / 100) * rect.height;
                        const isRotate = e.shiftKey;
                        dragRef.current = {
                          pointerId: e.pointerId,
                          chunkIdx,
                          mirrored,
                          slotIndex: i,
                          mode: isRotate ? 'rotate' : 'move',
                          startRotate: slot.rotateDeg,
                          startAngle: Math.atan2(e.clientY - cy, e.clientX - cx),
                        };
                        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                      }}
                      onPointerMove={(e) => {
                        const d = dragRef.current;
                        if (!d || d.pointerId !== e.pointerId) return;
                        const glove = gloveRefs.current.get(d.chunkIdx);
                        if (!glove) return;
                        const rect = glove.getBoundingClientRect();
                        if (d.mode === 'move') {
                          const xPct = ((e.clientX - rect.left) / rect.width) * 100;
                          const yPct = ((e.clientY - rect.top) / rect.height) * 100;
                          const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
                          writeSlot(d.mirrored, d.slotIndex, {
                            xPct: Math.round(clamp(xPct, -20, 120) * 10) / 10,
                            yPct: Math.round(clamp(yPct, -20, 120) * 10) / 10,
                          });
                        } else {
                          const cx = rect.left + (slot.xPct / 100) * rect.width;
                          const cy = rect.top + (slot.yPct / 100) * rect.height;
                          const ang = Math.atan2(e.clientY - cy, e.clientX - cx);
                          const delta = ((ang - d.startAngle) * 180) / Math.PI;
                          let next = d.startRotate + delta;
                          if (next > 180) next -= 360;
                          if (next < -180) next += 360;
                          writeSlot(d.mirrored, d.slotIndex, { rotateDeg: Math.round(next * 10) / 10 });
                        }
                      }}
                      onPointerUp={(e) => {
                        const d = dragRef.current;
                        if (!d || d.pointerId !== e.pointerId) return;
                        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
                        dragRef.current = null;
                      }}
                      onDoubleClickCapture={(e) => {
                        if (!showAligner || !dragMode) return;
                        e.preventDefault();
                        e.stopPropagation();
                        resetOneSlot(mirrored, i);
                      }}
                      className="absolute"
                      style={{
                        left: `${slot.xPct}%`,
                        top: `${slot.yPct}%`,
                        // BELANGRIJK: geen safeHandScale meer hier — anders zouden
                        // de stenen uit hun sleuf "drijven" zodra de globale
                        // hand-schaal verandert. De buitenste wrapper schaalt de
                        // hele handschoen + stenen als één geheel.
                        transform: `translate(-50%, -50%) rotate(${slot.rotateDeg}deg) scale(${slot.scale})`,
                        transformOrigin: 'center',
                        zIndex: 1,
                        outline: undefined,
                        cursor: (showAligner && dragMode) ? 'grab' : undefined,
                        touchAction: (showAligner && dragMode) ? 'none' : undefined,
                      }}
                    >
                      <DominoTile
                        data={domino}
                        orientation="vertical"
                        flipped={!!flippedTiles?.[index]}
                        selected={index === selectedIndex}
                        rotateX={settings.rotateX}
                        rotateY={settings.rotateY}
                        rotateZ={settings.rotateZ}
                        onClick={isMyTurn ? () => onDominoSelect(index) : undefined}
                        className="relative transition-all duration-200 domino-tile-hand-locked hover:z-20"
                      />
                    </div>
                  );
                })}
                {calibrateStep !== null && chunkIdx === 0 && (
                  <div
                    className="absolute inset-0"
                    style={{ zIndex: 50, cursor: 'crosshair', background: 'hsl(var(--accent) / 0.08)' }}
                    onClick={(e) => {
                      const glove = gloveRefs.current.get(0);
                      if (!glove) return;
                      const rect = glove.getBoundingClientRect();
                      const xPct = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
                      const yPct = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
                      writeSlot(false, calibrateStep, { xPct, yPct });
                      setCalibrateStep(prev => (prev === null ? null : (prev + 1 >= 6 ? null : prev + 1)));
                    }}
                  >
                    <div
                      className="absolute left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-ui-text/70 text-ui-bg text-xs font-semibold"
                      style={{ top: 4 }}
                    >
                      Klik op sleuf {calibrateStep + 1} van 6
                    </div>
                  </div>
                )}
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
interface GloveAlignerPropsExt extends GloveAlignerProps {
  selectedSlot: number;
  setSelectedSlot: (n: number) => void;
}

const GloveAligner: React.FC<GloveAlignerProps> = ({ align, isMobile, onChange, onReset, onClose }) => {
  const [slotIdx, setSlotIdx] = useState(0);
  const [side, setSide] = useState<'left' | 'right'>('left');

  // Welke slots-array bewerken we?
  const activeSlots: SlotConfig[] = side === 'left'
    ? align.slots
    : (align.slotsMirrored ?? align.slots.map(s => ({
        ...s,
        xPct: 100 - s.xPct,
        rotateDeg: -s.rotateDeg,
      })));

  const writeSlots = (next: SlotConfig[]) => {
    if (side === 'left') onChange({ slots: next });
    else onChange({ slotsMirrored: next });
  };

  const resetMirroredToAuto = () => onChange({ slotsMirrored: undefined });

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
        <Row label={isMobile ? 'Handschoen breedte (mobile)' : 'Handschoen breedte (desktop)'}
             value={isMobile ? align.widthMobile : align.widthDesktop}
             min={160} max={900} step={2} suffix="px"
             onChange={(n) => onChange(isMobile ? { widthMobile: n } : { widthDesktop: n })} />
        <Row label="Verhouding (h/b)" value={align.aspectRatio} min={0.2} max={1.2} step={0.01} onChange={(n) => onChange({ aspectRatio: n })} />

        <div className="mt-2 pt-2 border-t border-ui-border/60">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs w-36 shrink-0">Handschoen</span>
            <div className="flex gap-1">
              <button type="button"
                onClick={() => setSide('left')}
                className={`text-[11px] px-2 py-0.5 rounded border border-ui-border ${side==='left' ? 'bg-accent text-accent-foreground' : 'bg-ui-bg/60 hover:bg-ui-bg'}`}
              >Links</button>
              <button type="button"
                onClick={() => setSide('right')}
                className={`text-[11px] px-2 py-0.5 rounded border border-ui-border ${side==='right' ? 'bg-accent text-accent-foreground' : 'bg-ui-bg/60 hover:bg-ui-bg'}`}
              >Rechts (gespiegeld)</button>
              {side === 'right' && align.slotsMirrored && (
                <button type="button"
                  onClick={resetMirroredToAuto}
                  className="text-[11px] px-2 py-0.5 rounded border border-ui-border hover:bg-black/5"
                  title="Verwijder eigen rechter-uitlijning, gebruik automatische spiegeling van links"
                >Auto-spiegel</button>
              )}
            </div>
          </div>
          <div className="flex gap-1 mb-2 flex-wrap">
            <button
              type="button"
              className="text-[11px] px-2 py-0.5 rounded border border-ui-border hover:bg-black/5"
              title="Gebruikt sleuf 1 als basis: spreidt X gelijkmatig, kopieert Y/Schaal, en waaiert rotatie"
              onClick={() => {
                const base = activeSlots[0];
                const N = activeSlots.length;
                // Spread X across the glove, slight arc on Y, fan rotation around base.
                const next: SlotConfig[] = Array.from({ length: N }, (_, i) => {
                  const t = N === 1 ? 0.5 : i / (N - 1); // 0..1
                  const xPct = 8 + t * 84; // 8% .. 92%
                  const arc = Math.sin(t * Math.PI); // 0 at ends, 1 in middle
                  const yPct = base.yPct - arc * 6;  // lichte boog omhoog
                  // rotation fans from -span..+span, slot1 keeps its own rotation as center bias
                  const span = 22;
                  const rotateDeg = (t - 0.5) * 2 * span;
                  return { xPct, yPct, rotateDeg, scale: base.scale };
                });
                writeSlots(next);
              }}
            >Spreid vanaf sleuf 1</button>
            <button
              type="button"
              className="text-[11px] px-2 py-0.5 rounded border border-ui-border hover:bg-black/5"
              title="Kopieer Y en schaal van sleuf 1 naar alle sleuven (X en rotatie blijven)"
              onClick={() => {
                const base = activeSlots[0];
                const next = activeSlots.map((s) => ({ ...s, yPct: base.yPct, scale: base.scale }));
                writeSlots(next);
              }}
            >Y+Schaal van sleuf 1 → alle</button>
            <button
              type="button"
              className="text-[11px] px-2 py-0.5 rounded border border-ui-border hover:bg-black/5"
              title="5 stenen in het bakje + 1 los ernaast (past op glove-hand-holder.png)"
              onClick={() => writeSlots([
                { xPct:  9, yPct: 56, rotateDeg: 0, scale: activeSlots[0].scale },
                { xPct: 26, yPct: 58, rotateDeg: 0, scale: activeSlots[0].scale },
                { xPct: 43, yPct: 60, rotateDeg: 0, scale: activeSlots[0].scale },
                { xPct: 60, yPct: 60, rotateDeg: 0, scale: activeSlots[0].scale },
                { xPct: 77, yPct: 58, rotateDeg: 0, scale: activeSlots[0].scale },
                { xPct: 96, yPct: 45, rotateDeg: 0, scale: activeSlots[0].scale },
              ])}
            >Preset: 5+1 los</button>
            <button
              type="button"
              className="text-[11px] px-2 py-0.5 rounded border border-ui-border hover:bg-black/5"
              title="6 stenen strak naast elkaar in het bakje"
              onClick={() => {
                const s = activeSlots[0].scale;
                const next: SlotConfig[] = Array.from({ length: 6 }, (_, i) => ({
                  xPct: 10 + (i * 80) / 5, yPct: 58, rotateDeg: 0, scale: s,
                }));
                writeSlots(next);
              }}
            >Preset: 6 strak</button>
            <button
              type="button"
              className="text-[11px] px-2 py-0.5 rounded border border-ui-border hover:bg-black/5"
              title="6 stenen als lichte waaier/boog"
              onClick={() => {
                const s = activeSlots[0].scale;
                const next: SlotConfig[] = Array.from({ length: 6 }, (_, i) => {
                  const t = i / 5;
                  const arc = Math.sin(t * Math.PI);
                  return {
                    xPct: 10 + t * 80,
                    yPct: 60 - arc * 8,
                    rotateDeg: (t - 0.5) * 2 * 18,
                    scale: s,
                  };
                });
                writeSlots(next);
              }}
            >Preset: boog</button>
          </div>
          <label className="flex items-center gap-2 text-xs mb-1">
            <span className="w-36 shrink-0">Sleuf</span>
            <select
              value={slotIdx}
              onChange={(e) => setSlotIdx(parseInt(e.target.value, 10))}
              className="flex-1 text-xs px-1 py-0.5 rounded border border-ui-border bg-ui-bg"
            >
              {activeSlots.map((_, i) => <option key={i} value={i}>Sleuf {i + 1}</option>)}
            </select>
          </label>
          {(() => {
            const s = activeSlots[slotIdx];
            const patchSlot = (patch: Partial<SlotConfig>) => {
              const next = activeSlots.map((cur, i) => i === slotIdx ? { ...cur, ...patch } : cur);
              writeSlots(next);
            };
            return (
              <>
                <Row label="X (%)" value={s.xPct} min={-20} max={120} step={0.5} suffix="%" onChange={(n) => patchSlot({ xPct: n })} />
                <Row label="Y (%)" value={s.yPct} min={-20} max={120} step={0.5} suffix="%" onChange={(n) => patchSlot({ yPct: n })} />
                <Row label="Rotatie" value={s.rotateDeg} min={-180} max={180} step={0.5} suffix="°" onChange={(n) => patchSlot({ rotateDeg: n })} />
                <Row label="Schaal" value={s.scale} min={0.3} max={4} step={0.02} onChange={(n) => patchSlot({ scale: n })} />
              </>
            );
          })()}
        </div>
      </div>
      <p className="mt-2 text-[10px] opacity-70">Waarden worden lokaal opgeslagen. Klik "Kopieer" en stuur ze aan mij zodat ik ze als standaard kan inbouwen.</p>
    </div>
  );
};