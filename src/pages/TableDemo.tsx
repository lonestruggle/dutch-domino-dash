import { useEffect, useRef, useState } from "react";
import { DominoTile } from "@/components/DominoTile";
import { PlayerHand } from "@/components/PlayerHand";
import { BoneyardTile } from "@/components/BoneyardTile";
import type { DominoData } from "@/types/domino";

const DEMO_HAND: DominoData[] = [
  { value1: 6, value2: 4 }, { value1: 3, value2: 3 }, { value1: 2, value2: 5 },
  { value1: 1, value2: 6 }, { value1: 0, value2: 4 }, { value1: 5, value2: 5 }, { value1: 2, value2: 3 },
];
const DEMO_CHAIN: DominoData[] = [
  { value1: 4, value2: 1 }, { value1: 1, value2: 6 }, { value1: 6, value2: 6 }, { value1: 6, value2: 2 }, { value1: 2, value2: 0 },
];

function DemoChain({ chain }: { chain: DominoData[] }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      <div className="flex items-center gap-[3px]" style={{ transform: `scale(${Math.min(0.8, 5 / Math.max(chain.length, 1))})` }}>
        {chain.map((d, i) => (
          <div key={i} style={{ transform: `rotate(${((i * 37) % 7) - 3}deg)` }}>
            <DominoTile data={d} orientation={d.value1 === d.value2 ? "vertical" : "horizontal"} />
          </div>
        ))}
      </div>
    </div>
  );
}

function OpponentTiles({ count, vertical }: { count: number; vertical?: boolean }) {
  return (
    <div className={`flex ${vertical ? "flex-col" : "flex-row"} gap-0.5 scale-50 origin-center pointer-events-none`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="relative" style={{ width: vertical ? 44 : 22, height: vertical ? 22 : 44 }}>
          <BoneyardTile index={i} onClick={() => {}} placement={{ x: 0, y: 0, rotation: vertical ? 90 : 0 }} />
        </div>
      ))}
    </div>
  );
}


/**
 * TAFEL-DEMO (voorbeeld)
 * 1-op-1 nagebouwde "3D Avatar Table Experience" demo.
 * Staat los van het spel: dit is puur een visueel voorbeeld.
 */

class TableSound {
  private ctx: AudioContext | null = null;
  private enabled = true;

  private init() {
    if (!this.ctx) {
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AudioContextCtor();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  playKnock() {
    if (!this.enabled) return;
    this.init();
    const t = this.ctx!.currentTime;
    [0, 0.14].forEach((offset) => {
      const knockT = t + offset;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(160, knockT);
      osc.frequency.exponentialRampToValueAtTime(45, knockT + 0.08);
      gain.gain.setValueAtTime(0.7, knockT);
      gain.gain.exponentialRampToValueAtTime(0.001, knockT + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(knockT);
      osc.stop(knockT + 0.09);
    });
  }

  playToast() {
    if (!this.enabled) return;
    this.init();
    const t = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.45);
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.connect(gain);
    gain.connect(this.ctx!.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  playCheer() {
    if (!this.enabled) return;
    this.init();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const t = this.ctx!.currentTime + idx * 0.09;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }
}

class TableRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = window.devicePixelRatio || 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.resize();
    window.addEventListener("resize", this.resize);
  }

  destroy() {
    window.removeEventListener("resize", this.resize);
  }

  private resize = () => {
    const container = (this.canvas.closest("main") as HTMLElement | null) ?? this.canvas.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const size = Math.min(rect.width * 1.0, rect.height * 0.96);
    this.width = Math.max(340, Math.floor(size));
    this.height = Math.max(340, Math.floor(size));
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.render();
  };

  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  private drawWoodFrame(x: number, y: number, w: number, h: number) {
    const ctx = this.ctx;
    ctx.save();
    const cornerR = 38;

    const skirtH = 26;
    const apronGrad = ctx.createLinearGradient(x, y + h, x, y + h + skirtH);
    apronGrad.addColorStop(0, "#2d1609");
    apronGrad.addColorStop(0.3, "#1c0c04");
    apronGrad.addColorStop(0.8, "#130702");
    apronGrad.addColorStop(1, "#080301");
    ctx.fillStyle = apronGrad;
    this.roundRect(x, y + skirtH - 2, w, h, cornerR);
    ctx.fill();

    ctx.strokeStyle = "rgba(160, 95, 45, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + cornerR, y + h + skirtH - 2);
    ctx.lineTo(x + w - cornerR, y + h + skirtH - 2);
    ctx.stroke();

    const topGrad = ctx.createRadialGradient(
      x + w * 0.45,
      y + h * 0.35,
      30,
      x + w * 0.5,
      y + h * 0.5,
      w * 0.75
    );
    topGrad.addColorStop(0, "#66391d");
    topGrad.addColorStop(0.4, "#492613");
    topGrad.addColorStop(0.85, "#29140a");
    topGrad.addColorStop(1, "#1b0c05");
    ctx.fillStyle = topGrad;
    this.roundRect(x, y, w, h, cornerR);
    ctx.fill();

    ctx.save();
    ctx.clip();
    ctx.strokeStyle = "rgba(255, 200, 140, 0.035)";
    ctx.lineWidth = 1;
    for (let gy = y; gy < y + h; gy += 6) {
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.bezierCurveTo(x + w * 0.3, gy + 3, x + w * 0.7, gy - 3, x + w, gy + 1);
      ctx.stroke();
    }
    ctx.restore();

    const highlightGrad = ctx.createLinearGradient(x, y, x, y + 15);
    highlightGrad.addColorStop(0, "rgba(255, 235, 190, 0.45)");
    highlightGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.strokeStyle = highlightGrad;
    ctx.lineWidth = 3;
    this.roundRect(x + 2, y + 2, w - 4, h - 4, cornerR);
    ctx.stroke();

    this.drawBrassCornerBracket(x + 14, y + 14, 0);
    this.drawBrassCornerBracket(x + w - 14, y + 14, Math.PI / 2);
    this.drawBrassCornerBracket(x + w - 14, y + h - 14, Math.PI);
    this.drawBrassCornerBracket(x + 14, y + h - 14, -Math.PI / 2);
    ctx.restore();
  }

  private drawBrassCornerBracket(
    cx: number,
    cy: number,
    rotation: number
  ) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.fillStyle = "#b8860b";
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.arc(-1.5, -1.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#5a3d00";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-3, 0);
    ctx.lineTo(3, 0);
    ctx.stroke();
    ctx.restore();
  }

  private drawCupHolder(cx: number, cy: number, r: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "rgba(10, 5, 2, 0.9)";
    ctx.beginPath();
    ctx.arc(cx, cy + 2.5, r + 2, 0, Math.PI * 2);
    ctx.fill();

    const rimGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    rimGrad.addColorStop(0, "#e2e8f0");
    rimGrad.addColorStop(0.25, "#94a3b8");
    rimGrad.addColorStop(0.5, "#475569");
    rimGrad.addColorStop(0.8, "#1e293b");
    rimGrad.addColorStop(1, "#0f172a");
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    const wellR = r - 4;
    const wallGrad = ctx.createLinearGradient(cx, cy - wellR, cx, cy + wellR);
    wallGrad.addColorStop(0, "#05070a");
    wallGrad.addColorStop(0.4, "#14181f");
    wallGrad.addColorStop(1, "#333a42");
    ctx.fillStyle = wallGrad;
    ctx.beginPath();
    ctx.arc(cx, cy + 1, wellR, 0, Math.PI * 2);
    ctx.fill();

    const bottomR = wellR - 3;
    const baseGrad = ctx.createRadialGradient(cx - 2, cy - 1, 1, cx, cy + 2, bottomR);
    baseGrad.addColorStop(0, "#475569");
    baseGrad.addColorStop(0.6, "#18202b");
    baseGrad.addColorStop(1, "#070a0e");
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.arc(cx, cy + 2.5, bottomR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1.5, Math.PI * 1.05, Math.PI * 1.55);
    ctx.stroke();
    ctx.restore();
  }

  private drawInnerField(x: number, y: number, w: number, h: number) {
    const ctx = this.ctx;
    ctx.save();
    const innerR = 18;

    ctx.fillStyle = "#120a05";
    this.roundRect(x - 2, y - 2, w + 4, h + 4, innerR);
    ctx.fill();

    const innerGrad = ctx.createRadialGradient(
      x + w * 0.5,
      y + h * 0.42,
      20,
      x + w * 0.5,
      y + h * 0.5,
      w * 0.65
    );
    innerGrad.addColorStop(0, "#442717");
    innerGrad.addColorStop(0.5, "#2f1a0e");
    innerGrad.addColorStop(1, "#1a0d06");
    ctx.fillStyle = innerGrad;
    this.roundRect(x, y, w, h, innerR);
    ctx.fill();

    ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
    ctx.lineWidth = 5;
    this.roundRect(x + 2, y + 2, w - 4, h - 4, innerR);
    ctx.stroke();

    ctx.strokeStyle = "rgba(215, 145, 90, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + innerR, y + h);
    ctx.lineTo(x + w - innerR, y + h);
    ctx.arcTo(x + w, y + h, x + w, y + h - innerR, innerR);
    ctx.lineTo(x + w, y + innerR);
    ctx.stroke();

    ctx.strokeStyle = "rgba(218, 185, 75, 0.45)";
    ctx.lineWidth = 1.6;
    this.roundRect(x + 12, y + 12, w - 24, h - 24, 12);
    ctx.stroke();

    const corners: [number, number][] = [
      [x + 16, y + 16],
      [x + w - 16, y + 16],
      [x + 16, y + h - 16],
      [x + w - 16, y + h - 16],
    ];
    ctx.fillStyle = "rgba(235, 195, 85, 0.6)";
    corners.forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    const centerX = x + w / 2;
    const centerY = y + h / 2;
    ctx.font = '800 64px "Cinzel", serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillText("VIP", centerX + 1.5, centerY + 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.065)";
    ctx.fillText("VIP", centerX, centerY);
    ctx.restore();
  }

  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    const tableSize = Math.min(this.width - 24, this.height - 24);
    const tableX = (this.width - tableSize) / 2;
    const tableY = (this.height - tableSize) / 2;

    this.drawWoodFrame(tableX, tableY, tableSize, tableSize);

    const cupMargin = 38;
    const cupRadius = 22;
    this.drawCupHolder(tableX + cupMargin, tableY + cupMargin, cupRadius);
    this.drawCupHolder(tableX + tableSize - cupMargin, tableY + cupMargin, cupRadius);
    this.drawCupHolder(tableX + cupMargin, tableY + tableSize - cupMargin, cupRadius);
    this.drawCupHolder(
      tableX + tableSize - cupMargin,
      tableY + tableSize - cupMargin,
      cupRadius
    );

    const borderThickness = 48;
    const innerX = tableX + borderThickness;
    const innerY = tableY + borderThickness;
    const innerSize = tableSize - borderThickness * 2;
    this.drawInnerField(innerX, innerY, innerSize, innerSize);
  }
}

const seatOrder = ["player", "botWest", "botNorth", "botEast"] as const;
type SeatKey = (typeof seatOrder)[number];

const botPhrases: Record<Exclude<SeatKey, "player">, string[]> = {
  botNorth: ["Mooie tafel!", "Wie deelt er?", "Gezellig potje.", "Wat een uitzicht."],
  botWest: ["Alles goed aan de overkant?", "Lekker sfeertje hier.", "Klaar voor de volgende ronde!"],
  botEast: ["Mijn beker is nog vol!", "Even goed opletten nu.", "Succes allemaal!"],
};

export default function TableDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<TableRenderer | null>(null);
  const soundRef = useRef(new TableSound());
  const toastTimer = useRef<number | undefined>(undefined);
  const avatarRefs = useRef<Record<Exclude<SeatKey, "player">, HTMLDivElement | null>>({
    botWest: null,
    botNorth: null,
    botEast: null,
  });
  const plateRefs = useRef<Record<Exclude<SeatKey, "player">, HTMLDivElement | null>>({
    botWest: null,
    botNorth: null,
    botEast: null,
  });
  const bubbleRefs = useRef<Record<Exclude<SeatKey, "player">, HTMLDivElement | null>>({
    botWest: null,
    botNorth: null,
    botEast: null,
  });

  const [is3D, setIs3D] = useState(true);
  const [hand, setHand] = useState<DominoData[]>(DEMO_HAND);
  const [chain, setChain] = useState<DominoData[]>(DEMO_CHAIN);
  const [selected, setSelected] = useState<number | null>(null);
  const handleSelect = (index: number) => {
    const d = hand[index];
    if (!d) return;
    const left = chain[0].value1;
    const right = chain[chain.length - 1].value2;
    let next: DominoData[] | null = null;
    if (d.value1 === right) next = [...chain, d];
    else if (d.value2 === right) next = [...chain, { value1: d.value2, value2: d.value1 }];
    else if (d.value2 === left) next = [d, ...chain];
    else if (d.value1 === left) next = [{ value1: d.value2, value2: d.value1 }, ...chain];
    if (next) {
      setChain(next);
      setHand((h) => h.filter((_, i) => i !== index));
      setSelected(null);
    } else {
      setSelected(index === selected ? null : index);
    }
  };
  const [soundOn, setSoundOn] = useState(true);
  const [turnIndex, setTurnIndex] = useState(0);
  const [toast, setToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [reactionText, setReactionText] = useState("Kies een actie of reactie aan tafel");

  const showToast = (msg: string) => {
    setToast(msg);
    setToastVisible(true);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastVisible(false), 2000);
  };

  const showBubble = (seatKey: Exclude<SeatKey, "player">, text: string, duration = 2000) => {
    const bubble = bubbleRefs.current[seatKey];
    if (!bubble) return;
    const span = bubble.querySelector(".bubble-text");
    if (span) span.textContent = text;
    bubble.classList.remove("opacity-0");
    bubble.classList.add("opacity-100");
    window.setTimeout(() => {
      bubble.classList.remove("opacity-100");
      bubble.classList.add("opacity-0");
    }, duration);
  };

  // Canvas renderer
  useEffect(() => {
    if (!canvasRef.current) return;
    rendererRef.current = new TableRenderer(canvasRef.current);
    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, []);

  // Actieve beurt-plaatjes
  useEffect(() => {
    const activeSeat = seatOrder[turnIndex];
    (Object.keys(plateRefs.current) as Exclude<SeatKey, "player">[]).forEach((k) => {
      plateRefs.current[k]?.classList.toggle("active-plate", activeSeat === k);
    });
  }, [turnIndex]);

  // Ambient botgesprekken
  useEffect(() => {
    const interval = window.setInterval(() => {
      const keys: Exclude<SeatKey, "player">[] = ["botWest", "botNorth", "botEast"];
      const chosenKey = keys[Math.floor(Math.random() * keys.length)];
      const list = botPhrases[chosenKey];
      showBubble(chosenKey, list[Math.floor(Math.random() * list.length)], 2200);
    }, 7000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const botNames: Record<Exclude<SeatKey, "player">, string> = {
    botWest: "Sofia",
    botNorth: "Viktor",
    botEast: "Marco",
  };

  const handleKnock = () => {
    soundRef.current.playKnock();
    showToast("Jij klopt stevig op de tafel!");
    setReactionText('Jij klopt op tafel: "Klop-klop!"');
    const bots: Exclude<SeatKey, "player">[] = ["botWest", "botNorth", "botEast"];
    const randBot = bots[Math.floor(Math.random() * bots.length)];
    window.setTimeout(() => {
      const el = avatarRefs.current[randBot];
      if (el) {
        el.classList.add("anim-avatar-knock");
        showBubble(randBot, "Ik hoor je!", 1600);
        window.setTimeout(() => el.classList.remove("anim-avatar-knock"), 600);
      }
    }, 600);
  };

  const handleCheer = () => {
    soundRef.current.playCheer();
    showToast("Iedereen aan tafel juicht!");
    setReactionText("Feest aan de tafel! 🎉");
    (["botWest", "botNorth", "botEast"] as const).forEach((seatKey, i) => {
      window.setTimeout(() => {
        const el = avatarRefs.current[seatKey];
        if (!el) return;
        el.classList.add("anim-avatar-win");
        const cheers = ["Geweldig!", "Hoera!", "Mooie pot!"];
        showBubble(seatKey, cheers[i], 2200);
        window.setTimeout(() => el.classList.remove("anim-avatar-win"), 2400);
      }, i * 200);
    });
  };

  const handleThink = () => {
    showToast("Iedereen denkt na over de volgende zet...");
    setReactionText("Tactische stilte aan tafel... 🤔");
    (["botWest", "botNorth", "botEast"] as const).forEach((seatKey) => {
      const el = avatarRefs.current[seatKey];
      if (!el) return;
      el.classList.add("anim-avatar-thinking");
      showBubble(seatKey, "Denkt na...", 2200);
      window.setTimeout(() => el.classList.remove("anim-avatar-thinking"), 2400);
    });
  };

  const handleToastAction = () => {
    soundRef.current.playToast();
    showToast("Proost op een gezellige ronde!");
    setReactionText('Bekerhouders gevuld: "Proost!" 🥂');
    const toasts = ["Proost!", "Gezondheid!", "Op de winst!"];
    (["botWest", "botNorth", "botEast"] as const).forEach((seatKey, idx) => {
      showBubble(seatKey, toasts[idx], 2000);
    });
  };

  const handleRotateTurn = () => {
    setTurnIndex((i) => (i + 1) % seatOrder.length);
    const nextSeat = seatOrder[(turnIndex + 1) % seatOrder.length];
    if (nextSeat !== "player") {
      showBubble(nextSeat as Exclude<SeatKey, "player">, "Ik ben aan zet!", 1600);
    }
    showToast("Beurt doorgeschoven");
  };

  const activeSeat = seatOrder[turnIndex];

  return (
    <div className="tdemo tdemo-wood-bg text-slate-100 h-screen w-screen flex flex-col justify-between select-none overflow-hidden">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
      />
      <style>{tdemoStyles}</style>

      {/* Top Bar */}
      <header className="tdemo-glass-bar px-4 py-2.5 mx-auto mt-2 rounded-2xl w-[96%] max-w-5xl flex items-center justify-between shadow-2xl z-30">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-600 to-amber-900 border border-amber-500/40 flex items-center justify-center shadow-inner tdemo-serif text-amber-200 font-bold text-sm">
            VIP
          </div>
          <div>
            <h1 className="tdemo-serif font-bold text-sm sm:text-base text-amber-100 tracking-wide">
              Grand Table Lounge
            </h1>
            <div className="flex items-center space-x-2 text-xs text-amber-400/80 font-medium">
              <span
                id="turn-indicator"
                className="flex items-center gap-1.5 text-emerald-400"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {activeSeat === "player"
                  ? "Jouw Beurt (Zuid)"
                  : `${botNames[activeSeat as Exclude<SeatKey, "player">]} is aan de beurt...`}
              </span>
              <span>•</span>
              <span className="text-slate-400">Walnut 3D Edition</span>
            </div>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-5 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            <span className="text-slate-300">Sofia (West)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400"></span>
            <span className="text-slate-300">Viktor (Noord)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-slate-300">Marco (Oost)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span className="text-slate-300">Jij (Zuid)</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setIs3D((v) => !v);
              showToast(is3D ? "Top-Down Weergave" : "3D Perspectief Ingeschakeld");
            }}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition active:scale-95 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            <span>{is3D ? "3D Weergave" : "2D Weergave"}</span>
          </button>
          <button
            onClick={() => {
              const enabled = soundRef.current.toggle();
              setSoundOn(enabled);
              showToast(enabled ? "Geluid Ingeschakeld" : "Geluid Gedempt");
            }}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-amber-400 border border-white/10 transition active:scale-95"
          >
            {soundOn ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z m12 0l-6-6m0 6l6-6"
                />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Table stage */}
      <main
        className={`relative flex-1 w-full h-full flex items-center justify-center p-2 sm:p-4 overflow-hidden tdemo-stage ${
          is3D ? "view-3d" : "view-flat"
        }`}
      >
        <div className="absolute w-[80%] max-w-[520px] h-32 rounded-full bg-black/60 blur-2xl pointer-events-none translate-y-36"></div>

        {/* NORTH: Viktor */}
        <div className="absolute top-1 sm:top-2 left-1/2 -translate-x-1/2 flex flex-col items-center z-20 transition-transform duration-300 pointer-events-none">
          <div
            ref={(el) => {
              bubbleRefs.current.botNorth = el;
            }}
            className="opacity-0 transition-opacity duration-200 mb-1 px-2.5 py-0.5 rounded-full bg-black/85 text-amber-200 border border-amber-500/30 text-[10px] sm:text-xs font-semibold tracking-wide shadow-xl backdrop-blur flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping"></span>
            <span className="bubble-text">Kijkt rond...</span>
          </div>
          <div className="relative flex flex-col items-center">
            <div
              ref={(el) => {
                avatarRefs.current.botNorth = el;
              }}
              className="anim-avatar-idle flex flex-col items-center transition-all duration-300 drop-shadow-[0_12px_15px_rgba(0,0,0,0.85)] filter"
            >
              <svg className="w-20 sm:w-24 h-24 sm:h-28 overflow-visible" viewBox="0 0 100 115">
                <defs>
                  <radialGradient id="skinGradViktor" cx="42%" cy="40%" r="58%">
                    <stop offset="0%" stopColor="#fed7aa" />
                    <stop offset="55%" stopColor="#fba86b" />
                    <stop offset="85%" stopColor="#dd7a3e" />
                    <stop offset="100%" stopColor="#9a4316" />
                  </radialGradient>
                  <radialGradient id="hairGradViktor" cx="35%" cy="30%" r="65%">
                    <stop offset="0%" stopColor="#7c3f1d" />
                    <stop offset="40%" stopColor="#451a03" />
                    <stop offset="90%" stopColor="#1f0902" />
                    <stop offset="100%" stopColor="#0f0401" />
                  </radialGradient>
                  <linearGradient id="shirtGradGrey" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#64748b" />
                    <stop offset="50%" stopColor="#475569" />
                    <stop offset="100%" stopColor="#1e293b" />
                  </linearGradient>
                </defs>
                <rect x="42" y="55" width="16" height="15" rx="5" fill="#cf7238" />
                <path d="M42 57 Q50 63 58 57 L58 64 L42 64 Z" fill="#994012" opacity="0.45" />
                <path
                  d="M22 68 Q50 62 78 68 Q88 78 85 106 L15 106 Q12 78 22 68 Z"
                  fill="url(#shirtGradGrey)"
                  stroke="#1e293b"
                  strokeWidth="1.2"
                />
                <path d="M38 67 Q50 75 62 67 Q50 71 38 67 Z" fill="#334155" />
                <path d="M30 82 Q42 90 40 102" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" />
                <path d="M70 82 Q58 92 60 102" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" />
                <rect x="14" y="85" width="11" height="24" rx="5.5" fill="url(#skinGradViktor)" transform="rotate(15 14 85)" />
                <rect x="75" y="85" width="11" height="24" rx="5.5" fill="url(#skinGradViktor)" transform="rotate(-15 75 85)" />
                <path d="M28 32 C28 16 72 16 72 32 C72 50 64 61 50 61 C36 61 28 50 28 32 Z" fill="url(#skinGradViktor)" />
                <circle cx="27" cy="38" r="5" fill="#fba86b" />
                <circle cx="27" cy="38" r="2.5" fill="#b95822" />
                <circle cx="73" cy="38" r="5" fill="#e89254" />
                <circle cx="73" cy="38" r="2.5" fill="#9a4316" />
                <g className="avatar-eye-blink">
                  <ellipse cx="40" cy="37" rx="4.5" ry="5.2" fill="#ffffff" />
                  <circle cx="40.5" cy="37.2" r="2.8" fill="#451a03" />
                  <circle cx="41.2" cy="36.5" r="1.1" fill="#ffffff" />
                  <ellipse cx="60" cy="37" rx="4.5" ry="5.2" fill="#ffffff" />
                  <circle cx="59.5" cy="37.2" r="2.8" fill="#451a03" />
                  <circle cx="60.2" cy="36.5" r="1.1" fill="#ffffff" />
                </g>
                <path d="M34 29 Q40 26 46 29" stroke="#371705" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                <path d="M54 29 Q60 26 66 29" stroke="#371705" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                <path d="M49 35 Q52 44 46 45 Q50 46.5 53 45" stroke="#a44b1c" strokeWidth="1.6" strokeLinecap="round" fill="none" />
                <path d="M42 51 Q50 56 58 51" stroke="#87300c" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                <path d="M26 31 C25 15 32 6 48 4 C64 2 76 10 75 25 C75 18 69 13 62 13 C52 13 45 18 42 22 C37 18 31 22 26 31 Z" fill="url(#hairGradViktor)" />
                <path d="M40 7 Q48 -1 56 6 Q50 2 44 6 Z" fill="#935327" />
                <path d="M46 3 Q54 -2 60 7 Q54 4 48 5 Z" fill="#a46132" />
              </svg>
            </div>
            <div
              ref={(el) => {
                plateRefs.current.botNorth = el;
              }}
              className="tdemo-brass-plate mt-1 px-2.5 py-0.5 rounded flex items-center gap-1.5 transition-all duration-300"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
              <span className="text-[9px] font-bold text-amber-950 tdemo-serif tracking-wider uppercase">
                Viktor (Noord)
              </span>
            </div>
          </div>
        </div>

        {/* WEST: Sofia */}
        <div className="absolute left-1 sm:left-3 top-1/2 -translate-y-1/2 flex items-center z-20 transition-transform duration-300 pointer-events-none">
          <div className="relative flex flex-col items-center">
            <div
              ref={(el) => {
                bubbleRefs.current.botWest = el;
              }}
              className="opacity-0 transition-opacity duration-200 mb-1 px-2.5 py-0.5 rounded-full bg-black/85 text-amber-200 border border-amber-500/30 text-[10px] sm:text-xs font-semibold tracking-wide shadow-xl backdrop-blur flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></span>
              <span className="bubble-text">Glimlacht...</span>
            </div>
            <div className="flex items-center">
              <div
                ref={(el) => {
                  avatarRefs.current.botWest = el;
                }}
                className="anim-avatar-idle flex flex-col items-center transition-all duration-300 drop-shadow-[0_12px_15px_rgba(0,0,0,0.85)] filter"
              >
                <svg className="w-20 sm:w-24 h-24 sm:h-28 overflow-visible" viewBox="0 0 100 115">
                  <defs>
                    <radialGradient id="skinGradSofia" cx="44%" cy="40%" r="58%">
                      <stop offset="0%" stopColor="#fff1ee" />
                      <stop offset="55%" stopColor="#fbcfe8" />
                      <stop offset="85%" stopColor="#f49dc8" />
                      <stop offset="100%" stopColor="#b64f83" />
                    </radialGradient>
                    <radialGradient id="hairGradSofia" cx="30%" cy="25%" r="70%">
                      <stop offset="0%" stopColor="#582a17" />
                      <stop offset="50%" stopColor="#2d1207" />
                      <stop offset="100%" stopColor="#140602" />
                    </radialGradient>
                    <linearGradient id="shirtGradSofia" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="50%" stopColor="#0284c7" />
                      <stop offset="100%" stopColor="#075985" />
                    </linearGradient>
                  </defs>
                  <path d="M22 28 C16 42 12 70 18 90 C22 98 32 94 30 80 C28 65 29 45 32 30 Z" fill="url(#hairGradSofia)" />
                  <path d="M78 28 C84 42 88 70 82 90 C78 98 68 94 70 80 C72 65 71 45 68 30 Z" fill="url(#hairGradSofia)" />
                  <rect x="43" y="55" width="14" height="15" rx="5" fill="#f49dc8" />
                  <path d="M24 68 Q50 63 76 68 Q86 78 82 106 L18 106 Q14 78 24 68 Z" fill="url(#shirtGradSofia)" stroke="#0369a1" strokeWidth="1.2" />
                  <path d="M38 67 Q50 76 62 67 Z" fill="#0284c7" />
                  <path d="M29 32 C29 16 71 16 71 32 C71 50 63 60 50 60 C37 60 29 50 29 32 Z" fill="url(#skinGradSofia)" />
                  <g className="avatar-eye-blink">
                    <ellipse cx="40" cy="37" rx="4.5" ry="5.2" fill="#ffffff" />
                    <circle cx="41" cy="37" r="2.8" fill="#1e3a8a" />
                    <circle cx="41.7" cy="36.3" r="1.1" fill="#ffffff" />
                    <path d="M35 34 Q40 31 46 34" stroke="#18181b" strokeWidth="1.8" fill="none" />
                    <ellipse cx="60" cy="37" rx="4.5" ry="5.2" fill="#ffffff" />
                    <circle cx="61" cy="37" r="2.8" fill="#1e3a8a" />
                    <circle cx="61.7" cy="36.3" r="1.1" fill="#ffffff" />
                    <path d="M54 34 Q60 31 65 34" stroke="#18181b" strokeWidth="1.8" fill="none" />
                  </g>
                  <path d="M49 37 Q52 43 47 44 Q50 45.5 53 44" stroke="#b64f83" strokeWidth="1.4" strokeLinecap="round" fill="none" />
                  <path d="M43 51 Q50 57 57 51" stroke="#9d174d" strokeWidth="2" strokeLinecap="round" fill="none" />
                  <path d="M27 30 C27 15 36 6 50 6 C64 6 73 15 73 30 C69 20 62 14 50 14 C38 14 31 20 27 30 Z" fill="url(#hairGradSofia)" />
                  <path d="M26 28 Q33 34 32 46 Q27 36 26 28 Z" fill="#71361e" />
                  <path d="M74 28 Q67 34 68 46 Q73 36 74 28 Z" fill="#71361e" />
                </svg>
              </div>
            </div>
            <div
              ref={(el) => {
                plateRefs.current.botWest = el;
              }}
              className="tdemo-brass-plate mt-1 px-2.5 py-0.5 rounded flex items-center gap-1.5 transition-all duration-300"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
              <span className="text-[9px] font-bold text-amber-950 tdemo-serif tracking-wider uppercase">
                Sofia (West)
              </span>
            </div>
          </div>
        </div>

        {/* EAST: Marco */}
        <div className="absolute right-1 sm:right-3 top-1/2 -translate-y-1/2 flex items-center z-20 transition-transform duration-300 pointer-events-none">
          <div className="relative flex flex-col items-center">
            <div
              ref={(el) => {
                bubbleRefs.current.botEast = el;
              }}
              className="opacity-0 transition-opacity duration-200 mb-1 px-2.5 py-0.5 rounded-full bg-black/85 text-amber-200 border border-amber-500/30 text-[10px] sm:text-xs font-semibold tracking-wide shadow-xl backdrop-blur flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="bubble-text">Neemt een slok...</span>
            </div>
            <div className="flex items-center flex-row-reverse">
              <div
                ref={(el) => {
                  avatarRefs.current.botEast = el;
                }}
                className="anim-avatar-idle flex flex-col items-center transition-all duration-300 drop-shadow-[0_12px_15px_rgba(0,0,0,0.85)] filter"
              >
                <svg className="w-20 sm:w-24 h-24 sm:h-28 overflow-visible" viewBox="0 0 100 115">
                  <defs>
                    <radialGradient id="skinGradMarco" cx="42%" cy="40%" r="58%">
                      <stop offset="0%" stopColor="#fed7aa" />
                      <stop offset="55%" stopColor="#e09b67" />
                      <stop offset="85%" stopColor="#c16a34" />
                      <stop offset="100%" stopColor="#80330a" />
                    </radialGradient>
                    <radialGradient id="hairGradMarco" cx="35%" cy="30%" r="65%">
                      <stop offset="0%" stopColor="#3f2314" />
                      <stop offset="60%" stopColor="#1e1008" />
                      <stop offset="100%" stopColor="#0a0502" />
                    </radialGradient>
                    <linearGradient id="shirtGradMarco" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="50%" stopColor="#059669" />
                      <stop offset="100%" stopColor="#064e3b" />
                    </linearGradient>
                  </defs>
                  <rect x="42" y="55" width="16" height="15" rx="5" fill="#be6631" />
                  <path d="M22 68 Q50 62 78 68 Q88 78 85 106 L15 106 Q12 78 22 68 Z" fill="url(#shirtGradMarco)" stroke="#047857" strokeWidth="1.2" />
                  <path d="M38 67 Q50 74 62 67 Z" fill="#047857" />
                  <path d="M28 32 C28 16 72 16 72 32 C72 50 64 61 50 61 C36 61 28 50 28 32 Z" fill="url(#skinGradMarco)" />
                  <g className="avatar-eye-blink">
                    <ellipse cx="40" cy="37" rx="4.5" ry="5.2" fill="#ffffff" />
                    <circle cx="39.5" cy="37" r="2.8" fill="#14532d" />
                    <circle cx="40.2" cy="36.3" r="1.1" fill="#ffffff" />
                    <ellipse cx="60" cy="37" rx="4.5" ry="5.2" fill="#ffffff" />
                    <circle cx="59.5" cy="37" r="2.8" fill="#14532d" />
                    <circle cx="60.2" cy="36.3" r="1.1" fill="#ffffff" />
                  </g>
                  <path d="M34 30 Q40 28 46 31" stroke="#261208" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                  <path d="M54 31 Q60 28 66 30" stroke="#261208" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                  <path d="M49 35 Q52 44 46 45 Q50 46.5 53 45" stroke="#80330a" strokeWidth="1.6" strokeLinecap="round" fill="none" />
                  <path d="M42 51 Q50 57 58 51" stroke="#682104" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                  <path d="M26 30 C26 15 36 6 50 6 C66 6 74 15 74 30 C70 19 62 13 48 13 C35 13 29 20 26 30 Z" fill="url(#hairGradMarco)" />
                  <path d="M35 10 Q45 5 54 9" stroke="#5c3822" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                </svg>
              </div>
            </div>
            <div
              ref={(el) => {
                plateRefs.current.botEast = el;
              }}
              className="tdemo-brass-plate mt-1 px-2.5 py-0.5 rounded flex items-center gap-1.5 transition-all duration-300"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span className="text-[9px] font-bold text-amber-950 tdemo-serif tracking-wider uppercase">
                Marco (Oost)
              </span>
            </div>
          </div>
        </div>

        {/* Table canvas */}
        <div className="tdemo-table relative z-10 max-w-full max-h-full">
          <canvas ref={canvasRef} className="max-w-full max-h-full rounded-3xl block" />
          <DemoChain chain={chain} />
          <div className="absolute top-[14%] left-1/2 -translate-x-1/2 z-10"><OpponentTiles count={7} /></div>
          <div className="absolute left-[12%] top-1/2 -translate-y-1/2 z-10"><OpponentTiles count={7} vertical /></div>
          <div className="absolute right-[12%] top-1/2 -translate-y-1/2 z-10"><OpponentTiles count={7} vertical /></div>
        </div>

        {/* Toast */}
        <div
          className={`absolute top-6 px-4 py-2 rounded-xl bg-slate-900/90 text-amber-200 border border-amber-500/30 text-xs sm:text-sm font-semibold tracking-wide shadow-2xl backdrop-blur transform transition-all duration-300 pointer-events-none z-40 ${
            toastVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-12"
          }`}
        >
          {toast || "Tafel Gereed"}
        </div>
      </main>

      {/* Eigen hand: exact dezelfde stenen/hand als in het spel */}
      <div className="relative z-30 w-full">
        <PlayerHand hand={hand} selectedIndex={selected} onDominoSelect={handleSelect} isMyTurn />
      </div>

      {/* Bottom bar */}
      <footer className="tdemo-glass-bar mx-auto mb-2.5 rounded-2xl w-[96%] max-w-4xl p-2.5 sm:p-3.5 flex flex-col items-center shadow-2xl z-30">
        <div className="flex items-center justify-between w-full px-2 mb-2">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
            <span className="text-xs font-semibold text-amber-200 tracking-wider uppercase tdemo-serif">
              Jouw Plek (Zuid)
            </span>
            <span className="text-[11px] text-slate-400">• Interactieve Avatar Tafel</span>
          </div>
          <div className="text-xs text-amber-400/90 font-medium">{reactionText}</div>
        </div>

        <div className="w-full flex flex-wrap items-center justify-center gap-2 sm:gap-3 py-1">
          <button
            onClick={handleKnock}
            className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold transition active:scale-95 flex items-center gap-2 shadow-md"
          >
            <span>✊</span>
            <span>Klop op Tafel</span>
          </button>
          <button
            onClick={handleCheer}
            className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition active:scale-95 flex items-center gap-2 shadow-md"
          >
            <span>🎉</span>
            <span>Juichen & Feest</span>
          </button>
          <button
            onClick={handleThink}
            className="px-3.5 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-semibold transition active:scale-95 flex items-center gap-2 shadow-md"
          >
            <span>🤔</span>
            <span>Nadenken</span>
          </button>
          <button
            onClick={handleToastAction}
            className="px-3.5 py-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-xs font-semibold transition active:scale-95 flex items-center gap-2 shadow-md"
          >
            <span>🥂</span>
            <span>Proosten</span>
          </button>
          <button
            onClick={handleRotateTurn}
            className="px-3.5 py-2 rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-200 border border-white/10 text-xs font-semibold transition active:scale-95 flex items-center gap-2 shadow-md"
          >
            <span>🔄</span>
            <span>Volgende Speler</span>
          </button>
        </div>
      </footer>
    </div>
  );
}

const tdemoStyles = `
.tdemo {
  font-family: "Plus Jakarta Sans", sans-serif;
  touch-action: manipulation;
}

.tdemo-serif {
  font-family: "Cinzel", serif;
}

.tdemo-stage {
  perspective: 1100px;
  perspective-origin: 50% 75%;
  transition: perspective 0.4s ease;
}

.tdemo-stage.view-3d .tdemo-table {
  transform: rotateX(23deg) scale(0.96);
  filter: drop-shadow(0 42px 35px rgba(0, 0, 0, 0.85)) drop-shadow(0 15px 15px rgba(0, 0, 0, 0.6));
}

.tdemo-stage.view-flat .tdemo-table {
  transform: rotateX(0deg) scale(1);
  filter: drop-shadow(0 25px 30px rgba(0, 0, 0, 0.75));
}

.tdemo-stage .tdemo-table {
  transition: transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.45s ease;
  transform-origin: center bottom;
}

.tdemo-glass-bar {
  background: rgba(22, 25, 33, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.tdemo-wood-bg {
  background: radial-gradient(circle at 50% 50%, #1f222b 0%, #12141a 100%);
}

@keyframes tdemo-avatar-idle {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-3px) rotate(0.6deg); }
}

@keyframes tdemo-avatar-think {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  40% { transform: translateY(-3px) rotate(-4deg); }
  75% { transform: translateY(1px) rotate(3deg); }
}

@keyframes tdemo-avatar-blink {
  0%, 94%, 100% { transform: scaleY(1); }
  97% { transform: scaleY(0.08); }
}

@keyframes tdemo-avatar-celebrate {
  0%, 100% { transform: translateY(0) scale(1); }
  25% { transform: translateY(-14px) scale(1.08) rotate(-4deg); }
  50% { transform: translateY(-6px) scale(1.04) rotate(3deg); }
  75% { transform: translateY(-12px) scale(1.06) rotate(-2deg); }
}

@keyframes tdemo-avatar-knock {
  0%, 100% { transform: translateY(0) scale(1); }
  25% { transform: translateY(8px) scale(0.97) rotate(2deg); }
  50% { transform: translateY(2px) scale(1); }
  75% { transform: translateY(8px) scale(0.97) rotate(2deg); }
}

.anim-avatar-idle {
  animation: tdemo-avatar-idle 4s ease-in-out infinite;
  transform-origin: bottom center;
}

.anim-avatar-thinking {
  animation: tdemo-avatar-think 2.4s ease-in-out infinite !important;
}

.anim-avatar-knock {
  animation: tdemo-avatar-knock 0.5s ease-in-out 1 !important;
}

.anim-avatar-win {
  animation: tdemo-avatar-celebrate 0.8s ease-in-out infinite !important;
}

.avatar-eye-blink {
  animation: tdemo-avatar-blink 4.5s ease-in-out infinite;
  transform-origin: center;
}

.tdemo-brass-plate {
  background: linear-gradient(180deg, #d4af37 0%, #aa8420 50%, #6e4e0b 100%);
  box-shadow: 0 4px 10px rgba(0,0,0,0.7), inset 0 1px 1px rgba(255,255,255,0.7);
  border: 1px solid #ffe58f;
}

.tdemo-brass-plate.active-plate {
  background: linear-gradient(180deg, #fef08a 0%, #eab308 50%, #854d0e 100%);
  box-shadow: 0 0 18px 4px rgba(245, 158, 11, 0.7), inset 0 1px 2px #fff;
  border-color: #ffffff;
}
`;
