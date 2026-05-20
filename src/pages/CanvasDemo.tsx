import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

interface Stone {
  id: number;
  x: number;
  y: number;
  angle: number;
  targetX: number;
  targetY: number;
  targetAngle: number;
  v1: number;
  v2: number;
  orientation: 'h' | 'v';
}

const W = 56;
const H = 56;
const DEPTH = 14;

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
  const isH = stone.orientation === 'h';
  const w = isH ? W * 2 : W;
  const h = isH ? H : H * 2;

  const shadowOffset = 8 + envelope * 30;
  const jumpOffset = -envelope * 20;

  ctx.save();
  ctx.translate(shadowOffset, shadowOffset);
  ctx.fillStyle = `rgba(0,0,0,${0.45 - envelope * 0.2})`;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 10 + envelope * 30;
  roundRect(ctx, -w / 2, -h / 2, w, h, 6);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(jumpOffset, jumpOffset);

  const gradR = ctx.createLinearGradient(w / 2, 0, w / 2 + DEPTH, 0);
  gradR.addColorStop(0, '#d8c9a8');
  gradR.addColorStop(1, '#6b5a3f');
  ctx.fillStyle = gradR;
  ctx.beginPath();
  ctx.moveTo(w / 2, -h / 2);
  ctx.lineTo(w / 2 + DEPTH, -h / 2 + DEPTH);
  ctx.lineTo(w / 2 + DEPTH, h / 2 + DEPTH);
  ctx.lineTo(w / 2, h / 2);
  ctx.closePath();
  ctx.fill();

  const gradB = ctx.createLinearGradient(0, h / 2, 0, h / 2 + DEPTH);
  gradB.addColorStop(0, '#c9b88f');
  gradB.addColorStop(1, '#5a4a30');
  ctx.fillStyle = gradB;
  ctx.beginPath();
  ctx.moveTo(-w / 2, h / 2);
  ctx.lineTo(w / 2, h / 2);
  ctx.lineTo(w / 2 + DEPTH, h / 2 + DEPTH);
  ctx.lineTo(-w / 2 + DEPTH, h / 2 + DEPTH);
  ctx.closePath();
  ctx.fill();

  const grad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  grad.addColorStop(0, '#fdf6e3');
  grad.addColorStop(1, '#e8dcb8');
  ctx.fillStyle = grad;
  roundRect(ctx, -w / 2, -h / 2, w, h, 6);
  ctx.fill();

  ctx.strokeStyle = '#5a4a30';
  ctx.lineWidth = 1.5;
  ctx.stroke();

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

const CanvasDemo: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const slamTimeRef = useRef(0);
  const isSlamActiveRef = useRef(false);
  const [intensity, setIntensity] = useState(1);

  const stonesRef = useRef<Stone[]>([
    { id: 1, x: 200, y: 250, angle: 0, targetX: 200, targetY: 250, targetAngle: 0, v1: 6, v2: 6, orientation: 'h' },
    { id: 2, x: 330, y: 250, angle: 0, targetX: 330, targetY: 250, targetAngle: 0, v1: 6, v2: 3, orientation: 'h' },
    { id: 3, x: 460, y: 250, angle: 0, targetX: 460, targetY: 250, targetAngle: 0, v1: 3, v2: 5, orientation: 'h' },
    { id: 4, x: 560, y: 190, angle: 0, targetX: 560, targetY: 190, targetAngle: 0, v1: 5, v2: 2, orientation: 'v' },
    { id: 5, x: 560, y: 320, angle: 0, targetX: 560, targetY: 320, targetAngle: 0, v1: 2, v2: 4, orientation: 'v' },
    { id: 6, x: 460, y: 380, angle: 0, targetX: 460, targetY: 380, targetAngle: 0, v1: 4, v2: 1, orientation: 'h' },
    { id: 7, x: 330, y: 380, angle: 0, targetX: 330, targetY: 380, targetAngle: 0, v1: 1, v2: 0, orientation: 'h' },
    { id: 8, x: 200, y: 380, angle: 0, targetX: 200, targetY: 380, targetAngle: 0, v1: 0, v2: 6, orientation: 'h' },
  ]);

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

      const grad = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 50, canvas.width / 2, canvas.height / 2, canvas.width / 1.2);
      grad.addColorStop(0, '#1f7a4e');
      grad.addColorStop(1, '#0a3a23');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#3d2b15';
      ctx.lineWidth = 16;
      ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

      for (const stone of stonesRef.current) {
        stone.x += (stone.targetX - stone.x) * 0.15;
        stone.y += (stone.targetY - stone.y) * 0.15;
        stone.angle += (stone.targetAngle - stone.angle) * 0.15;

        ctx.save();
        const trilX = (Math.random() - 0.5) * 45 * env;
        const trilY = (Math.random() - 0.5) * 45 * env;
        const trilR = (Math.random() - 0.5) * 0.25 * env;
        ctx.translate(stone.x + trilX, stone.y + trilY);
        ctx.rotate(stone.angle + trilR);
        const popScale = 1 + env * 0.15;
        ctx.scale(popScale, popScale);
        drawStone(ctx, stone, env);
        ctx.restore();
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [intensity]);

  const triggerSlam = () => {
    isSlamActiveRef.current = true;
    slamTimeRef.current = 0;
    stonesRef.current.forEach(stone => {
      stone.targetX += (Math.random() - 0.5) * 35 * intensity;
      stone.targetY += (Math.random() - 0.5) * 35 * intensity;
      stone.targetAngle += (Math.random() - 0.5) * 0.3 * intensity;
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 flex flex-col items-center gap-4">
      <h1 className="text-2xl font-bold">Fysica Slam Demo</h1>
      <p className="text-sm text-muted-foreground max-w-xl text-center">
        Stenen springen omhoog, worden groter, trillen én worden permanent van hun plek geslagen.
      </p>
      <div className="flex gap-3 items-center">
        <Button onClick={triggerSlam} size="lg">💥 HARD SLAM!</Button>
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
