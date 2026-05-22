import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface DominoData {
  v1: number;
  v2: number;
}

interface Stone {
  id: number;
  gx: number;
  gy: number;
  x: number;
  y: number;
  angle: number;
  targetX: number;
  targetY: number;
  targetAngle: number;
  v1: number;
  v2: number;
  orientation: "h" | "v";
  flipped?: boolean;
  isDoubleStone?: boolean;
}

const CELL = 64;
const W = 56;
const H = 56;
const DEPTH = 5;
const ORIGIN_X = 400;
const ORIGIN_Y = 280;

type Dir = "N" | "S" | "E" | "W";
interface OpenEnd {
  gx: number;
  gy: number;
  value: number;
  fromDir: Dir;
}
interface PlacementTarget {
  gx: number;
  gy: number;
  orientation: "h" | "v";
  flipped: boolean;
  end: OpenEnd;
  handIndex: number;
  data: DominoData;
}

const isDouble = (d: DominoData) => d.v1 === d.v2;
const gridToPx = (gx: number, gy: number, orientation: "h" | "v") => {
  const cx = ORIGIN_X + gx * CELL + (orientation === "h" ? CELL : CELL / 2);
  const cy = ORIGIN_Y + gy * CELL + (orientation === "h" ? CELL / 2 : CELL);
  return { x: cx, y: cy };
};

const PIP_MAP: Record<number, [number, number][]> = {
  0: [],
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

function drawPips(ctx: CanvasRenderingContext2D, value: number, cx: number, cy: number, size: number) {
  const r = size * 0.09;
  const step = size * 0.28;
  ctx.fillStyle = "#1a1a1a";
  for (const [px, py] of PIP_MAP[value] || []) {
    ctx.beginPath();
    ctx.arc(cx + px * step, cy + py * step, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawStone(ctx: CanvasRenderingContext2D, stone: Stone, envelope: number) {
  const isH = stone.orientation === "h";
  const w = isH ? W * 2 : W;
  const h = isH ? H : H * 2;

  const shadowOffset = 8 + envelope * 30;
  const jumpOffset = -envelope * 20;

  ctx.save();
  ctx.translate(shadowOffset, shadowOffset);
  ctx.fillStyle = `rgba(0,0,0,${0.45 - envelope * 0.2})`;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 10 + envelope * 30;
  roundRect(ctx, -w / 2, -h / 2, w, h, 6);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(jumpOffset, jumpOffset);

  const gradR = ctx.createLinearGradient(w / 2, 0, w / 2 + DEPTH, 0);
  gradR.addColorStop(0, "#d8c9a8");
  gradR.addColorStop(1, "#6b5a3f");
  ctx.fillStyle = gradR;
  ctx.beginPath();
  ctx.moveTo(w / 2, -h / 2);
  ctx.lineTo(w / 2 + DEPTH, -h / 2 + DEPTH);
  ctx.lineTo(w / 2 + DEPTH, h / 2 + DEPTH);
  ctx.lineTo(w / 2, h / 2);
  ctx.closePath();
  ctx.fill();

  const gradB = ctx.createLinearGradient(0, h / 2, 0, h / 2 + DEPTH);
  gradB.addColorStop(0, "#c9b88f");
  gradB.addColorStop(1, "#5a4a30");
  ctx.fillStyle = gradB;
  ctx.beginPath();
  ctx.moveTo(-w / 2, h / 2);
  ctx.lineTo(w / 2, h / 2);
  ctx.lineTo(w / 2 + DEPTH, h / 2 + DEPTH);
  ctx.lineTo(-w / 2 + DEPTH, h / 2 + DEPTH);
  ctx.closePath();
  ctx.fill();

  const grad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  grad.addColorStop(0, "#fdf6e3");
  grad.addColorStop(1, "#e8dcb8");
  ctx.fillStyle = grad;
  roundRect(ctx, -w / 2, -h / 2, w, h, 6);
  ctx.fill();

  ctx.strokeStyle = "#5a4a30";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const pips = stone.flipped ? [stone.v2, stone.v1] : [stone.v1, stone.v2];

  ctx.beginPath();
  if (isH) {
    ctx.moveTo(0, -h / 2 + 4);
    ctx.lineTo(0, h / 2 - 4);
    ctx.stroke();
    drawPips(ctx, pips[0], -w / 4, 0, W);
    drawPips(ctx, pips[1], w / 4, 0, W);
  } else {
    ctx.moveTo(-w / 2 + 4, 0);
    ctx.lineTo(w / 2 - 4, 0);
    ctx.stroke();
    drawPips(ctx, pips[0], 0, -h / 4, W);
    drawPips(ctx, pips[1], 0, h / 4, W);
  }

  ctx.restore();
}

function getCollisionCircles(stone: Stone) {
  const isH = stone.orientation === "h";
  const longHalf = isH ? W : H;
  const cos = Math.cos(stone.angle);
  const sin = Math.sin(stone.angle);
  const offsets = [-longHalf * 0.66, 0, longHalf * 0.66];
  return offsets.map((o) => {
    const dx = isH ? o : 0;
    const dy = isH ? 0 : o;
    return {
      x: stone.x + dx * cos - dy * sin,
      y: stone.y + dx * sin + dy * cos,
    };
  });
}
const COLLISION_RADIUS = 24;
const SAFE_DIST = COLLISION_RADIUS * 2;

function buildBoardMap(stones: Stone[]) {
  const board: Record<string, { id: number; value: number }> = {};
  for (const s of stones) {
    const pips = s.flipped ? [s.v2, s.v1] : [s.v1, s.v2];
    const cells =
      s.orientation === "h"
        ? [[s.gx, s.gy], [s.gx + 1, s.gy]]
        : [[s.gx, s.gy], [s.gx, s.gy + 1]];
    cells.forEach((c, i) => {
      board[`${c[0]},${c[1]}`] = { id: s.id, value: pips[i] };
    });
  }
  return board;
}

function computeOpenEnds(stones: Stone[]): OpenEnd[] {
  const board = buildBoardMap(stones);
  const ends: OpenEnd[] = [];
  for (const s of stones) {
    const pips = s.flipped ? [s.v2, s.v1] : [s.v1, s.v2];
    const cells =
      s.orientation === "h"
        ? [[s.gx, s.gy], [s.gx + 1, s.gy]]
        : [[s.gx, s.gy], [s.gx, s.gy + 1]];

    cells.forEach((cell, i) => {
      const [x, y] = cell;
      const value = pips[i];
      const dirs: { d: Dir; nx: number; ny: number }[] = [
        { d: "N", nx: x, ny: y - 1 },
        { d: "S", nx: x, ny: y + 1 },
        { d: "W", nx: x - 1, ny: y },
        { d: "E", nx: x + 1, ny: y },
      ];
      for (const { d, nx, ny } of dirs) {
        if (board[`${nx},${ny}`]) continue;

        if (s.isDoubleStone) {
          if (s.orientation === "h" && (d === "W" || d === "E")) continue;
          if (s.orientation === "v" && (d === "N" || d === "S")) continue;
        } else if (s.orientation === "h") {
          const isLeft = i === 0;
          if (isLeft && d !== "W") continue;
          if (!isLeft && d !== "E") continue;
        } else {
          const isTop = i === 0;
          if (isTop && d !== "N") continue;
          if (!isTop && d !== "S") continue;
        }

        ends.push({ gx: nx, gy: ny, value, fromDir: d });
      }
    });
  }
  return ends;
}

function findPlacements(
  data: DominoData,
  handIndex: number,
  ends: OpenEnd[],
  board: Record<string, { id: number; value: number }>,
): PlacementTarget[] {
  const out: PlacementTarget[] = [];
  const seen = new Set<string>();
  const dbl = isDouble(data);

  for (const end of ends) {
    const tryPlace = (flipped: boolean) => {
      let orientation: "h" | "v";
      let gx: number;
      let gy: number;
      let matchPip: number;

      if (dbl) {
        // Double placed perpendicular to chain direction
        if (end.fromDir === "E" || end.fromDir === "W") {
          orientation = "v";
          gx = end.gx;
          gy = end.fromDir === "E" ? end.gy : end.gy; // double occupies one column, span 2 rows
          // Center it: top cell at (gx, end.gy) and bottom at (gx, end.gy+1).
          // But end.gy is the connecting row, so we want it spanning end.gy-? :
          // simplest: put top cell at end.gy so connection is at top cell
          gy = end.gy;
        } else {
          orientation = "h";
          gx = end.gx;
          gy = end.gy;
        }
        matchPip = data.v1;
      } else {
        if (end.fromDir === "E") {
          orientation = "h";
          gx = end.gx;
          gy = end.gy;
          matchPip = flipped ? data.v2 : data.v1;
        } else if (end.fromDir === "W") {
          orientation = "h";
          gx = end.gx - 1;
          gy = end.gy;
          matchPip = flipped ? data.v1 : data.v2;
        } else if (end.fromDir === "S") {
          orientation = "v";
          gx = end.gx;
          gy = end.gy;
          matchPip = flipped ? data.v2 : data.v1;
        } else {
          orientation = "v";
          gx = end.gx;
          gy = end.gy - 1;
          matchPip = flipped ? data.v1 : data.v2;
        }
      }

      if (matchPip !== end.value) return;

      const cells =
        orientation === "h"
          ? [[gx, gy], [gx + 1, gy]]
          : [[gx, gy], [gx, gy + 1]];
      for (const [cx, cy] of cells) {
        if (board[`${cx},${cy}`]) return;
      }

      const key = `${gx},${gy},${orientation},${flipped}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ gx, gy, orientation, flipped, end, handIndex, data });
    };
    tryPlace(false);
    if (!dbl) tryPlace(true);
  }
  return out;
}

function randHand(): DominoData[] {
  const full: DominoData[] = [];
  for (let i = 0; i <= 6; i++) for (let j = i; j <= 6; j++) full.push({ v1: i, v2: j });
  full.sort(() => Math.random() - 0.5);
  return full.slice(0, 7);
}

function makeStarter(nextId: { current: number }): Stone {
  const data: DominoData = { v1: 6, v2: 6 };
  const orientation: "h" | "v" = "h";
  const { x, y } = gridToPx(0, 0, orientation);
  return {
    id: nextId.current++,
    gx: 0,
    gy: 0,
    x,
    y,
    angle: 0,
    targetX: x,
    targetY: y,
    targetAngle: 0,
    v1: data.v1,
    v2: data.v2,
    orientation,
    flipped: false,
    isDoubleStone: true,
  };
}

const CanvasDemo: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const slamTimeRef = useRef(0);
  const isSlamActiveRef = useRef(false);
  const [intensity, setIntensity] = useState(1);
  const [showCollision, setShowCollision] = useState(true);
  const [hand, setHand] = useState<DominoData[]>(() => randHand());
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const stonesRef = useRef<Stone[]>([]);
  const nextIdRef = useRef(1);
  const targetsRef = useRef<PlacementTarget[]>([]);
  const draggingRef = useRef<{ id: number; offX: number; offY: number } | null>(null);

  if (stonesRef.current.length === 0) {
    stonesRef.current.push(makeStarter(nextIdRef));
  }

  // recompute targets when selection or hand changes
  useEffect(() => {
    if (selectedIdx === null) {
      targetsRef.current = [];
      return;
    }
    const data = hand[selectedIdx];
    if (!data) {
      targetsRef.current = [];
      return;
    }
    const ends = computeOpenEnds(stonesRef.current);
    const board = buildBoardMap(stonesRef.current);
    targetsRef.current = findPlacements(data, selectedIdx, ends, board);
  }, [selectedIdx, hand]);

  const placeStone = (t: PlacementTarget) => {
    const { x, y } = gridToPx(t.gx, t.gy, t.orientation);
    stonesRef.current.push({
      id: nextIdRef.current++,
      gx: t.gx,
      gy: t.gy,
      x,
      y: y - 40,
      angle: 0,
      targetX: x,
      targetY: y,
      targetAngle: 0,
      v1: t.data.v1,
      v2: t.data.v2,
      orientation: t.orientation,
      flipped: t.flipped,
      isDoubleStone: isDouble(t.data),
    });
    setHand((h) => h.filter((_, i) => i !== t.handIndex));
    setSelectedIdx(null);
    targetsRef.current = [];
    isSlamActiveRef.current = true;
    slamTimeRef.current = 0;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const getMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * canvas.width,
        y: ((e.clientY - rect.top) / rect.height) * canvas.height,
      };
    };

    const onMouseDown = (e: MouseEvent) => {
      const { x, y } = getMouse(e);
      // 1) Drag existing stone (top-most first)
      for (let i = stonesRef.current.length - 1; i >= 0; i--) {
        const s = stonesRef.current[i];
        const isH = s.orientation === "h";
        const w = isH ? W * 2 : W;
        const h = isH ? H : H * 2;
        if (Math.abs(x - s.x) < w / 2 && Math.abs(y - s.y) < h / 2) {
          draggingRef.current = { id: s.id, offX: x - s.x, offY: y - s.y };
          return;
        }
      }
      // 2) Otherwise: place from hand
      for (const t of targetsRef.current) {
        const { x: tx, y: ty } = gridToPx(t.gx, t.gy, t.orientation);
        const w = t.orientation === "h" ? W * 2 : W;
        const h = t.orientation === "h" ? H : H * 2;
        if (Math.abs(x - tx) < w / 2 && Math.abs(y - ty) < h / 2) {
          placeStone(t);
          return;
        }
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const { x, y } = getMouse(e);
      const s = stonesRef.current.find((st) => st.id === draggingRef.current!.id);
      if (!s) return;
      s.x = x - draggingRef.current.offX;
      s.y = y - draggingRef.current.offY;
      s.targetX = s.x;
      s.targetY = s.y;
    };
    const onMouseUp = () => {
      if (!draggingRef.current) return;
      const s = stonesRef.current.find((st) => st.id === draggingRef.current!.id);
      if (s) {
        // Snap target back to grid home
        const home = gridToPx(s.gx, s.gy, s.orientation);
        s.targetX = home.x;
        s.targetY = home.y;
      }
      draggingRef.current = null;
    };
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    let raf = 0;
    const loop = () => {
      let env = 0;
      if (isSlamActiveRef.current) {
        slamTimeRef.current += 0.055;
        const attack = Math.min(1, slamTimeRef.current * 4.5);
        const decay = Math.exp(-slamTimeRef.current * 3.8);
        env = attack * decay;
        if (env < 0.005) {
          isSlamActiveRef.current = false;
          env = 0;
        }
      }

      const grad = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        50,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width / 1.2,
      );
      grad.addColorStop(0, "#1f7a4e");
      grad.addColorStop(1, "#0a3a23");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "#3d2b15";
      ctx.lineWidth = 16;
      ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

      const stones = stonesRef.current;

      for (const s of stones) {
        s.x += (s.targetX - s.x) * 0.25;
        s.y += (s.targetY - s.y) * 0.25;
        s.angle += (s.targetAngle - s.angle) * 0.2;
      }

      for (let iter = 0; iter < 6; iter++) {
        for (let i = 0; i < stones.length; i++) {
          for (let j = i + 1; j < stones.length; j++) {
            const t1 = stones[i];
            const t2 = stones[j];
            const c1s = getCollisionCircles(t1);
            const c2s = getCollisionCircles(t2);
            for (const c1 of c1s) {
              for (const c2 of c2s) {
                const dx = c2.x - c1.x;
                const dy = c2.y - c1.y;
                const dist = Math.hypot(dx, dy) || 0.01;
                if (dist < SAFE_DIST) {
                  const overlap = SAFE_DIST - dist;
                  const pushX = (dx / dist) * overlap * 0.6;
                  const pushY = (dy / dist) * overlap * 0.6;
                  t1.x -= pushX;
                  t1.targetX -= pushX;
                  t1.y -= pushY;
                  t1.targetY -= pushY;
                  t2.x += pushX;
                  t2.targetX += pushX;
                  t2.y += pushY;
                  t2.targetY += pushY;
                }
              }
            }
          }
        }
      }

      for (const stone of stones) {
        const shakeX = (Math.random() - 0.5) * 15 * env * intensity;
        const shakeY = (Math.random() - 0.5) * 15 * env * intensity;
        const shakeA = (Math.random() - 0.5) * 0.1 * env * intensity;
        const lift = env * intensity;

        ctx.save();
        ctx.translate(stone.x + shakeX, stone.y + shakeY);
        ctx.rotate(stone.angle + shakeA);
        const popScale = 1 + lift * 0.15;
        ctx.scale(popScale, popScale);
        drawStone(ctx, stone, env * intensity);
        ctx.restore();
      }

      if (targetsRef.current.length > 0) {
        const pulse = 0.4 + 0.3 * Math.sin(Date.now() / 250);
        ctx.save();
        for (const t of targetsRef.current) {
          const { x: tx, y: ty } = gridToPx(t.gx, t.gy, t.orientation);
          const w = t.orientation === "h" ? W * 2 : W;
          const h = t.orientation === "h" ? H : H * 2;
          ctx.fillStyle = `rgba(255, 200, 0, ${pulse * 0.4})`;
          ctx.strokeStyle = `rgba(255, 200, 0, ${Math.min(1, pulse + 0.3)})`;
          ctx.lineWidth = 2;
          roundRect(ctx, tx - w / 2, ty - h / 2, w, h, 6);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }

      if (showCollision) {
        ctx.save();
        for (const stone of stones) {
          const circles = getCollisionCircles(stone);
          for (const c of circles) {
            ctx.beginPath();
            ctx.arc(c.x, c.y, COLLISION_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255, 80, 80, 0.18)";
            ctx.fill();
            ctx.strokeStyle = "rgba(255, 80, 80, 0.55)";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [intensity, showCollision, hand, selectedIdx]);

  const triggerSlam = () => {
    isSlamActiveRef.current = true;
    slamTimeRef.current = 0;
    // Scatter every stone away from its grid home, then it LERPs back
    const scatterBase = 70;
    for (const s of stonesRef.current) {
      const dx = (Math.random() - 0.5) * 2 * scatterBase * intensity;
      const dy = (Math.random() - 0.5) * 2 * scatterBase * intensity;
      s.targetX = s.x + dx;
      s.targetY = s.y + dy;
    }
    // After short delay, snap targets back to grid home so they fly back
    window.setTimeout(() => {
      for (const s of stonesRef.current) {
        const home = gridToPx(s.gx, s.gy, s.orientation);
        s.targetX = home.x;
        s.targetY = home.y;
      }
    }, 220);
  };

  const resetDemo = () => {
    stonesRef.current = [];
    nextIdRef.current = 1;
    targetsRef.current = [];
    setHand(randHand());
    setSelectedIdx(null);
    stonesRef.current.push(makeStarter(nextIdRef));
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 flex flex-col items-center gap-4">
      <h1 className="text-2xl font-bold">Domino Plaatsing + Magneet Demo</h1>
      <p className="text-sm text-muted-foreground max-w-xl text-center">
        Klik een steen in je hand, dan klik op een geel veld op het bord om hem aan te leggen.
        Pip-matching uit de klassieke logica + magneet-fysica eroverheen.
      </p>
      <div className="flex gap-3 items-center flex-wrap justify-center">
        <Button onClick={triggerSlam} size="lg">
          HARD SLAM
        </Button>
        <Button onClick={resetDemo} variant="outline" size="lg">
          Reset
        </Button>
        <label className="text-sm flex items-center gap-2">
          Intensiteit: {intensity.toFixed(1)}
          <input
            type="range"
            min={0.3}
            max={2}
            step={0.1}
            value={intensity}
            onChange={(e) => setIntensity(parseFloat(e.target.value))}
            className="w-32 accent-emerald-500"
          />
        </label>
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={showCollision}
            onChange={(e) => setShowCollision(e.target.checked)}
          />
          Toon magneet-zones
        </label>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={560}
        className="rounded-lg shadow-2xl border border-border cursor-pointer"
      />

      <div className="flex gap-2 items-center p-3 rounded-lg bg-card border border-border flex-wrap justify-center">
        <span className="text-sm font-medium mr-2">Hand:</span>
        {hand.map((d, i) => (
          <button
            key={i}
            onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
            className={`px-3 py-2 rounded border-2 text-sm font-mono transition-all ${
              selectedIdx === i
                ? "border-amber-400 bg-amber-100 text-amber-900 scale-110"
                : "border-border bg-background hover:border-amber-300"
            }`}
          >
            {d.v1}|{d.v2}
          </button>
        ))}
        {hand.length === 0 && (
          <span className="text-sm text-muted-foreground">Hand leeg — druk Reset</span>
        )}
      </div>
    </div>
  );
};

export default CanvasDemo;
