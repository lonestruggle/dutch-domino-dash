import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

interface Stone {
  x: number;
  y: number;
  angle: number;
  v1: number;
  v2: number;
  orientation: 'h' | 'v';
}

const W = 56;     // halve breedte (één helft) basis
const H = 56;     // hoogte
const DEPTH = 14; // 3D dikte

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
  ctx.fillStyle = '#1a1a1a';
  for (const [px, py] of PIP_MAP[value] || []) {
    ctx.beginPath();
    ctx.arc(cx + px * step, cy + py * step, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStone(
  ctx: CanvasRenderingContext2D,
  stone: Stone,
  envelope: number,
) {
  const isH = stone.orientation === 'h';
  const w = isH ? W * 2 : W;
  const h = isH ? H : H * 2;

  const lift = envelope * 18; // hoe hoger envelope, hoe meer hij "springt"
  const shadowOffset = 6 + envelope * 22;

  // 1. Schaduw
  ctx.save();
  ctx.translate(shadowOffset, shadowOffset);
  ctx.fillStyle = `rgba(0,0,0,${0.45 - envelope * 0.15})`;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 10 + envelope * 30;
  roundRect(ctx, -w / 2, -h / 2, w, h, 6);
  ctx.fill();
  ctx.restore();

  // 2. Zijwanden (extrusie) - teken vanaf "onder" naar "boven" toe
  const depth = DEPTH + lift;
  // Rechter zijwand
  const gradR = ctx.createLinearGradient(w / 2, 0, w / 2 + depth, 0);
  gradR.addColorStop(0, '#d8c9a8');
  gradR.addColorStop(1, '#6b5a3f');
  ctx.fillStyle = gradR;
  ctx.beginPath();
  ctx.moveTo(w / 2, -h / 2);
  ctx.lineTo(w / 2 + depth, -h / 2 + depth);
  ctx.lineTo(w / 2 + depth, h / 2 + depth);
  ctx.lineTo(w / 2, h / 2);
  ctx.closePath();
  ctx.fill();

  // Onder zijwand
  const gradB = ctx.createLinearGradient(0, h / 2, 0, h / 2 + depth);
  gradB.addColorStop(0, '#c9b88f');
  gradB.addColorStop(1, '#5a4a30');
  ctx.fillStyle = gradB;
  ctx.beginPath();
  ctx.moveTo(-w / 2, h / 2);
  ctx.lineTo(w / 2, h / 2);
  ctx.lineTo(w / 2 + depth, h / 2 + depth);
  ctx.lineTo(-w / 2 + depth, h / 2 + depth);
  ctx.closePath();
  ctx.fill();

  // 3. Bovenkant
  ctx.save();
  ctx.translate(0, -lift);
  const grad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  grad.addColorStop(0, '#fdf6e3');
  grad.addColorStop(1, '#e8dcb8');
  ctx.fillStyle = grad;
  roundRect(ctx, -w / 2, -h / 2, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = '#5a4a30';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Scheidingslijn + pips
  ctx.beginPath();
  if (isH) {
    ctx.moveTo(0, -h / 2 + 4);
    ctx.lineTo(0, h / 2 - 4);
    ctx.stroke();
    drawPips(ctx, stone.v1, -w / 4, 0, W);
    drawPips(ctx, stone.v2, w / 4, 0, W);
  } else {
    ctx.moveTo(-w / 2 + 4, 0);
    ctx.lineTo(w / 2 - 4, 0);
    ctx.stroke();
    drawPips(ctx, stone.v1, 0, -h / 4, W);
    drawPips(ctx, stone.v2, 0, h / 4, W);
  }
  ctx.restore();
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

const CanvasDemo: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const slamTimeRef = useRef(0);
  const isSlamActiveRef = useRef(false);
  const [intensity, setIntensity] = useState(1);

  const stones: Stone[] = [
    { x: 200, y: 250, angle: 0, v1: 6, v2: 6, orientation: 'h' },
    { x: 330, y: 250, angle: 0, v1: 6, v2: 3, orientation: 'h' },
    { x: 460, y: 250, angle: 0, v1: 3, v2: 5, orientation: 'h' },
    { x: 560, y: 190, angle: 0, v1: 5, v2: 2, orientation: 'v' },
    { x: 560, y: 320, angle: 0, v1: 2, v2: 4, orientation: 'v' },
    { x: 460, y: 380, angle: 0, v1: 4, v2: 1, orientation: 'h' },
    { x: 330, y: 380, angle: 0, v1: 1, v2: 0, orientation: 'h' },
    { x: 200, y: 380, angle: 0, v1: 0, v2: 6, orientation: 'h' },
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const loop = () => {
      let env = 0;
      if (isSlamActiveRef.current) {
        slamTimeRef.current += 0.055;
        const attack = Math.min(1, slamTimeRef.current * 4.5);
        const decay = Math.exp(-slamTimeRef.current * 3.8);
        env = attack * decay * intensity;
        if (env < 0.005) {
          isSlamActiveRef.current = false;
          env = 0;
        }
      }

      // Tafel achtergrond (beweegt NIET)
      const grad = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 50, canvas.width / 2, canvas.height / 2, canvas.width / 1.2);
      grad.addColorStop(0, '#1f7a4e');
      grad.addColorStop(1, '#0a3a23');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Houten rand
      ctx.strokeStyle = '#3d2b15';
      ctx.lineWidth = 16;
      ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

      // Stenen (trillen onafhankelijk)
      for (const stone of stones) {
        ctx.save();
        const trilX = (Math.random() - 0.5) * 35 * env;
        const trilY = (Math.random() - 0.5) * 35 * env;
        const trilR = (Math.random() - 0.5) * 0.22 * env;
        ctx.translate(stone.x + trilX, stone.y + trilY);
        ctx.rotate(stone.angle + trilR);
        drawStone(ctx, stone, env);
        ctx.restore();
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intensity]);

  const triggerSlam = () => {
    isSlamActiveRef.current = true;
    slamTimeRef.current = 0;
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 flex flex-col items-center gap-4">
      <h1 className="text-2xl font-bold">Canvas 2.5D Hard Slam Demo</h1>
      <p className="text-sm text-muted-foreground max-w-xl text-center">
        Geïsoleerde testpagina — raakt de spellogica niet aan. Druk op de knop om de schud-animatie te triggeren.
      </p>
      <div className="flex gap-3 items-center">
        <Button onClick={triggerSlam} size="lg">Hard Slam!</Button>
        <label className="text-sm flex items-center gap-2">
          Intensiteit:
          <input
            type="range"
            min={0.3}
            max={2}
            step={0.1}
            value={intensity}
            onChange={(e) => setIntensity(parseFloat(e.target.value))}
          />
          <span className="tabular-nums w-10">{intensity.toFixed(1)}</span>
        </label>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={560}
        className="rounded-lg shadow-2xl border border-border"
      />
    </div>
  );
};

export default CanvasDemo;