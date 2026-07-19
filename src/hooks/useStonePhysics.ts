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
  targetCx: number;
  targetCy: number;
  angle: number; // radians
  baseAngle: number;
  targetAngle: number;
  orientation: 'horizontal' | 'vertical';
  /** Visuele hoogte boven de tafel in "lagen" (0 = op tafel, 1 = opgetild). */
  z: number;
  /** Na droppen blijft een steen tijdelijk ghost totdat hij vrij ligt. */
  ghostUntilClear: boolean;
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
  // Kleine tolerance: genoeg om subpixel-trillingen te voorkomen, maar niet
  // zo groot dat licht geroteerde gefixte stenen strak aan elkaar blijven kleven.
  const tol = Math.min(0.75, cell * 0.018);
  return {
    cx: b.cx,
    cy: b.cy,
    hw: w / 2 - tol,
    hh: h / 2 - tol,
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
  /** Sterkte (-1..1) waarmee stenen naar hun physics-anker worden getrokken. 0 = blijven liggen. */
  anchorStrength: number;
  /** Of de physics-loop actief is. Bij false: alle offsets = 0. */
  enabled: boolean;
}

export interface StonePhysicsAPI {
  getOffset: (id: string) => { dx: number; dy: number; z: number; angleDeg: number };
  /** Geeft een steen een directe visuele duw (in px). Handig voor testen. */
  nudge: (id: string, dx: number, dy: number) => void;
  /** CanvasDemo Hard Slam: verplaats óók het doelpunt, zodat stenen blijven liggen waar ze landen. */
  scatter: (id: string, dx: number, dy: number, angleDeg: number, targetAngleDeltaDeg?: number) => void;
  /** Reset alle stenen naar hun grid-positie. */
  resetAll: () => void;
  /** Tilt een steen op (z > 0) of zet hem terug op tafel (z = 0). */
  setLift: (id: string, z: number) => void;
  /** Z-waarde van een steen ophalen (0 als onbekend). */
  getLift: (id: string) => number;
  /**
   * Anchor-based placement: registreer een visuele start-offset voor een
   * steen die nog niet bestaat, op basis van zijn grid-coördinaten.
   * Zodra de body in de sync-effect aangemaakt wordt, start hij met die
   * offset. Hierdoor landt een nieuwe steen visueel naast de (verschoven)
   * anker-steen.
   */
  seedPlacementOffset: (gridX: number, gridY: number, dx: number, dy: number) => void;
}

export function useStonePhysics(
  dominoes: Record<string, PhysicsDomino>,
  gridCellSize: number,
  options: UseStonePhysicsOptions,
): StonePhysicsAPI {
  const bodiesRef = useRef<Map<string, PhysicsBody>>(new Map());
  const offsetsRef = useRef<Map<string, { dx: number; dy: number; z: number; angleDeg: number }>>(
    new Map(),
  );
  /** Pending seeds: key = `${gridX},${gridY}` → {dx, dy}. */
  const pendingSeedsRef = useRef<Map<string, { dx: number; dy: number }>>(
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
    let snappedToNewBases = false;
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
        const seedKey = `${d.x},${d.y}`;
        const seed = pendingSeedsRef.current.get(seedKey);
        if (seed) pendingSeedsRef.current.delete(seedKey);
        m.set(id, {
          cx: baseCx + (seed?.dx ?? 0),
          cy: baseCy + (seed?.dy ?? 0),
          baseCx,
          baseCy,
          targetCx: baseCx + (seed?.dx ?? 0),
          targetCy: baseCy + (seed?.dy ?? 0),
          angle,
          baseAngle: angle,
          targetAngle: angle,
          orientation: d.orientation,
          z: 0,
          ghostUntilClear: false,
        });
      } else {
        const baseChanged =
          Math.abs(existing.baseCx - baseCx) > 0.5 ||
          Math.abs(existing.baseCy - baseCy) > 0.5 ||
          existing.orientation !== d.orientation;
        const angleChanged = Math.abs(existing.baseAngle - angle) > 0.001;
        existing.baseCx = baseCx;
        existing.baseCy = baseCy;
        existing.baseAngle = angle;
        existing.orientation = d.orientation;
        // Als "Fix stenen" dezelfde domino-id's naar nieuwe grid-posities legt,
        // moeten bestaande physics-bodies meteen naar hun nieuwe anker springen.
        // Anders blijft de eerste klik visueel op de oude layout hangen en lijkt
        // pas de tweede klik goed te werken.
        if (baseChanged) {
          existing.cx = baseCx;
          existing.cy = baseCy;
          existing.targetCx = baseCx;
          existing.targetCy = baseCy;
          existing.angle = angle;
          existing.targetAngle = angle;
          existing.ghostUntilClear = false;
          snappedToNewBases = true;
        } else if (angleChanged) {
          existing.angle = angle;
          existing.targetAngle = angle;
          snappedToNewBases = true;
        }
      }
    }
    if (snappedToNewBases) {
      offsetsRef.current.clear();
      forceTick((t) => (t + 1) & 0xffff);
    }
  }, [dominoes, gridCellSize]);

  useEffect(() => {
    if (!options.enabled) return;
    let raf = 0;
    const loop = () => {
      const entries = Array.from(bodiesRef.current.entries());
      const bodies = entries.map(([, b]) => b);

      // 1) Anchor pull. Negatieve waarden gebruiken dezelfde timing als positieve
      // waarden, zodat positie + rotatie nooit omgekeerd of asynchroon gaan lopen.
      const a = Math.min(1, Math.abs(anchorRef.current));
      if (a > 0) {
        for (const b of bodies) {
          b.cx += (b.targetCx - b.cx) * a;
          b.cy += (b.targetCy - b.cy) * a;
          b.angle += (b.targetAngle - b.angle) * a;
        }
      }

      // 2) 6 iteraties SAT
      for (let it = 0; it < 6; it++) {
        for (let i = 0; i < bodies.length; i++) {
          for (let j = i + 1; j < bodies.length; j++) {
            // 3D-DEPTH: stenen op verschillende lagen botsen niet.
            if (Math.abs(bodies[i].z - bodies[j].z) >= 0.5) continue;
            if (bodies[i].ghostUntilClear || bodies[j].ghostUntilClear) continue;
            const mtv = satResolve(
              bodyOBB(bodies[i], gridCellSize),
              bodyOBB(bodies[j], gridCellSize),
            );
            if (!mtv) continue;
            const pushX = mtv.x * 0.5;
            const pushY = mtv.y * 0.5;
            bodies[i].cx -= pushX;
            bodies[i].cy -= pushY;
            bodies[i].targetCx -= pushX;
            bodies[i].targetCy -= pushY;
            bodies[j].cx += pushX;
            bodies[j].cy += pushY;
            bodies[j].targetCx += pushX;
            bodies[j].targetCy += pushY;
          }
        }
      }

      for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        if (!body.ghostUntilClear) continue;
        const overlaps = bodies.some((other, j) => {
          if (i === j || other.ghostUntilClear || Math.abs(body.z - other.z) >= 0.5) return false;
          return Boolean(satResolve(bodyOBB(body, gridCellSize), bodyOBB(other, gridCellSize)));
        });
        if (!overlaps) body.ghostUntilClear = false;
      }

      // 3) Offsets schrijven
      const off = offsetsRef.current;
      off.clear();
      for (let i = 0; i < entries.length; i++) {
        const [id, b] = entries[i];
        off.set(id, {
          dx: b.cx - b.baseCx,
          dy: b.cy - b.baseCy,
          z: b.z,
          angleDeg: ((b.angle - b.baseAngle) * 180) / Math.PI,
        });
      }

      forceTick((t) => (t + 1) & 0xffff);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [options.enabled, gridCellSize]);

  return {
    getOffset: (id: string) =>
      offsetsRef.current.get(id) || { dx: 0, dy: 0, z: 0, angleDeg: 0 },
    nudge: (id: string, dx: number, dy: number) => {
      const b = bodiesRef.current.get(id);
      if (b) {
        b.cx += dx;
        b.cy += dy;
      }
    },
    scatter: (id: string, dx: number, dy: number, angleDeg: number, targetAngleDeltaDeg = 0) => {
      const b = bodiesRef.current.get(id);
      if (b) {
        const totalAngleRad = ((angleDeg + targetAngleDeltaDeg) * Math.PI) / 180;
        // Hard Slam is één gezamenlijke impuls: locatie, rotatie én het anker
        // krijgen dezelfde waarde in dezelfde call. Daardoor kan anchorStrength
        // (ook negatief) nooit eerst locatie laten bewegen en daarna pas jump/rotatie.
        b.cx += dx;
        b.cy += dy;
        b.angle += totalAngleRad;
        b.targetCx = b.cx;
        b.targetCy = b.cy;
        b.targetAngle = b.angle;
        forceTick((t) => (t + 1) & 0xffff);
      }
    },
    resetAll: () => {
      for (const b of bodiesRef.current.values()) {
        b.cx = b.baseCx;
        b.cy = b.baseCy;
        b.targetCx = b.baseCx;
        b.targetCy = b.baseCy;
        b.angle = b.baseAngle;
        b.targetAngle = b.baseAngle;
        b.z = 0;
        b.ghostUntilClear = false;
      }
      offsetsRef.current.clear();
      pendingSeedsRef.current.clear();
      forceTick((t) => (t + 1) & 0xffff);
    },
    setLift: (id: string, z: number) => {
      const b = bodiesRef.current.get(id);
      if (b) {
        const nextZ = Math.max(0, z);
        if (b.z > 0 && nextZ === 0) b.ghostUntilClear = true;
        if (nextZ > 0) b.ghostUntilClear = true;
        b.z = nextZ;
        forceTick((t) => (t + 1) & 0xffff);
      }
    },
    getLift: (id: string) => bodiesRef.current.get(id)?.z ?? 0,
    seedPlacementOffset: (gridX: number, gridY: number, dx: number, dy: number) => {
      if (dx === 0 && dy === 0) return;
      pendingSeedsRef.current.set(`${gridX},${gridY}`, { dx, dy });
    },
  };
}