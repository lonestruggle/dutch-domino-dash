import { useEffect, useRef, useState } from 'react';

/**
 * OBB / SAT physics-laag voor de klassieke DOM-rendering.
 *
 * - Houdt per dominoId een visueel center (cx, cy) bij in board-pixels.
 * - `baseCx/baseCy` = de grid-positie waar de steen "thuis" hoort.
 * - Per frame:
 *   1. Optionele zachte anchor-pull richting de grid-positie (slider).
 *   2. 6 iteraties Separating Axis Theorem op alle paren stenen.
 *      Bij overlap worden beide stenen langs de MTV uit elkaar geduwd.
 * - Geeft per steen een (dx, dy) offset terug die GameBoard via
 *   `transform: translate3d()` op de wrapper-div zet.
 *
 * De gameState (grid-coords) blijft onaangetast — dit is puur visueel.
 */

interface PhysicsDomino {
  x: number;
  y: number;
  orientation: 'horizontal' | 'vertical';
  rotation?: number; // graden
}

interface PhysicsBody {
  cx: number;
  cy: number;
  baseCx: number;
  baseCy: number;
  angle: number; // radians
  orientation: 'horizontal' | 'vertical';
  /** Visuele hoogte boven de tafel in "lagen" (0 = op tafel, 1 = opgetild). */
  z: number;
}

interface OBB {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  cos: number;
  sin: number;
}

function bodyOBB(b: PhysicsBody, cell: number): OBB {
  const isH = b.orientation === 'horizontal';
  const w = isH ? cell * 2 : cell;
  const h = isH ? cell : cell * 2;
  return {
    cx: b.cx,
    cy: b.cy,
    hw: w / 2,
    hh: h / 2,
    cos: Math.cos(b.angle),
    sin: Math.sin(b.angle),
  };
}

function satResolve(a: OBB, b: OBB): { x: number; y: number } | null {
  const axes = [
    { x: a.cos, y: a.sin },
    { x: -a.sin, y: a.cos },
    { x: b.cos, y: b.sin },
    { x: -b.sin, y: b.cos },
  ];
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  let minOverlap = Infinity;
  let mtvX = 0;
  let mtvY = 0;
  for (const ax of axes) {
    const rA =
      a.hw * Math.abs(ax.x * a.cos + ax.y * a.sin) +
      a.hh * Math.abs(-ax.x * a.sin + ax.y * a.cos);
    const rB =
      b.hw * Math.abs(ax.x * b.cos + ax.y * b.sin) +
      b.hh * Math.abs(-ax.x * b.sin + ax.y * b.cos);
    const projDist = dx * ax.x + dy * ax.y;
    const overlap = rA + rB - Math.abs(projDist);
    if (overlap <= 0) return null;
    if (overlap < minOverlap) {
      minOverlap = overlap;
      const sign = projDist < 0 ? -1 : 1;
      mtvX = ax.x * sign;
      mtvY = ax.y * sign;
    }
  }
  return { x: mtvX * minOverlap, y: mtvY * minOverlap };
}

export interface UseStonePhysicsOptions {
  /** Sterkte (0..0.25) waarmee stenen terug naar grid worden getrokken. 0 = blijven liggen. */
  anchorStrength: number;
  /** Of de physics-loop actief is. Bij false: alle offsets = 0. */
  enabled: boolean;
}

export interface StonePhysicsAPI {
  getOffset: (id: string) => { dx: number; dy: number; z: number };
  /** Geeft een steen een directe visuele duw (in px). Handig voor testen. */
  nudge: (id: string, dx: number, dy: number) => void;
  /** Reset alle stenen naar hun grid-positie. */
  resetAll: () => void;
  /** Tilt een steen op (z > 0) of zet hem terug op tafel (z = 0). */
  setLift: (id: string, z: number) => void;
  /** Z-waarde van een steen ophalen (0 als onbekend). */
  getLift: (id: string) => number;
}

export function useStonePhysics(
  dominoes: Record<string, PhysicsDomino>,
  gridCellSize: number,
  options: UseStonePhysicsOptions,
): StonePhysicsAPI {
  const bodiesRef = useRef<Map<string, PhysicsBody>>(new Map());
  const offsetsRef = useRef<Map<string, { dx: number; dy: number; z: number }>>(
    new Map(),
  );
  const [, forceTick] = useState(0);

  const anchorRef = useRef(options.anchorStrength);
  anchorRef.current = options.anchorStrength;
  const enabledRef = useRef(options.enabled);
  enabledRef.current = options.enabled;

  // Sync bodies met dominoes (add nieuwe, verwijder weggegane,
  // update baseCx/baseCy + angle voor bestaande).
  useEffect(() => {
    const m = bodiesRef.current;
    const ids = new Set(Object.keys(dominoes));
    for (const id of Array.from(m.keys())) {
      if (!ids.has(id)) m.delete(id);
    }
    for (const [id, d] of Object.entries(dominoes)) {
      const isH = d.orientation === 'horizontal';
      const baseCx = d.x * gridCellSize + (isH ? gridCellSize : gridCellSize / 2);
      const baseCy = d.y * gridCellSize + (isH ? gridCellSize / 2 : gridCellSize);
      const angle = ((d.rotation || 0) * Math.PI) / 180;
      const existing = m.get(id);
      if (!existing) {
        m.set(id, {
          cx: baseCx,
          cy: baseCy,
          baseCx,
          baseCy,
          angle,
          orientation: d.orientation,
          z: 0,
        });
      } else {
        existing.baseCx = baseCx;
        existing.baseCy = baseCy;
        existing.angle = angle;
        existing.orientation = d.orientation;
      }
    }
  }, [dominoes, gridCellSize]);

  useEffect(() => {
    if (!options.enabled) return;
    let raf = 0;
    const loop = () => {
      const entries = Array.from(bodiesRef.current.entries());
      const bodies = entries.map(([, b]) => b);

      // 1) Anchor pull (alleen als > 0)
      const a = anchorRef.current;
      if (a > 0) {
        for (const b of bodies) {
          b.cx += (b.baseCx - b.cx) * a;
          b.cy += (b.baseCy - b.cy) * a;
        }
      }

      // 2) 6 iteraties SAT
      for (let it = 0; it < 6; it++) {
        for (let i = 0; i < bodies.length; i++) {
          for (let j = i + 1; j < bodies.length; j++) {
            // 3D-DEPTH: stenen op verschillende lagen botsen niet.
            if (Math.abs(bodies[i].z - bodies[j].z) >= 0.5) continue;
            const mtv = satResolve(
              bodyOBB(bodies[i], gridCellSize),
              bodyOBB(bodies[j], gridCellSize),
            );
            if (!mtv) continue;
            bodies[i].cx -= mtv.x * 0.5;
            bodies[i].cy -= mtv.y * 0.5;
            bodies[j].cx += mtv.x * 0.5;
            bodies[j].cy += mtv.y * 0.5;
          }
        }
      }

      // 3) Offsets schrijven
      const off = offsetsRef.current;
      off.clear();
      for (let i = 0; i < entries.length; i++) {
        const [id, b] = entries[i];
        off.set(id, { dx: b.cx - b.baseCx, dy: b.cy - b.baseCy, z: b.z });
      }

      forceTick((t) => (t + 1) & 0xffff);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [options.enabled, gridCellSize]);

  return {
    getOffset: (id: string) =>
      offsetsRef.current.get(id) || { dx: 0, dy: 0, z: 0 },
    nudge: (id: string, dx: number, dy: number) => {
      const b = bodiesRef.current.get(id);
      if (b) {
        b.cx += dx;
        b.cy += dy;
      }
    },
    resetAll: () => {
      for (const b of bodiesRef.current.values()) {
        b.cx = b.baseCx;
        b.cy = b.baseCy;
        b.z = 0;
      }
      offsetsRef.current.clear();
      forceTick((t) => (t + 1) & 0xffff);
    },
    setLift: (id: string, z: number) => {
      const b = bodiesRef.current.get(id);
      if (b) b.z = Math.max(0, z);
    },
    getLift: (id: string) => bodiesRef.current.get(id)?.z ?? 0,
  };
}