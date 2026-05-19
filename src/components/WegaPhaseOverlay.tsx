import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BoneyardScatter } from '@/components/BoneyardScatter';
import { DominoTile } from '@/components/DominoTile';
import { Coins, Hand, AlertTriangle } from 'lucide-react';
import type { DominoData } from '@/types/domino';

interface Props {
  lobbyId: string;
  gameState: any;
  playerPosition: number;
  allPlayers: Array<{ username: string; position: number; is_bot: boolean; user_id?: string }>;
  onChanged: () => void;
  adminFaceUp?: boolean;
  skin?: { image_url: string | null; css_background: string | null } | null;
}

const CLAIM_TIMER_MS = 3000;

/**
 * Overlay voor "Wega di sen" tijdens drawing en claiming_starter fase.
 * - drawing: speler trekt zelf stenen uit boneyard
 * - claiming_starter: gestuurde pop-up; per steen 3s; speler moet actief op Claim drukken
 * - ended (claim_verzuim): rode verzuim-overlay met boete
 */
export const WegaPhaseOverlay: React.FC<Props> = ({ lobbyId, gameState, playerPosition, allPlayers, onChanged, adminFaceUp, skin }) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());

  const phase = gameState?.wegaPhase as string | undefined;
  const endReason = gameState?.gameEndReason as string | undefined;
  const verzuim = gameState?.wegaVerzuimer as any | undefined;

  // tick voor timer
  useEffect(() => {
    if (phase !== 'claiming_starter' && !(phase === 'ended' && endReason === 'claim_verzuim')) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [phase, endReason]);

  const hands: DominoData[][] = Array.isArray(gameState?.playerHands) ? gameState.playerHands : [];
  const myHand: DominoData[] = hands[playerPosition] || [];
  const myCount = myHand.length;
  const boneyard: Array<DominoData | null> = Array.isArray(gameState?.boneyard) ? gameState.boneyard : [];
  const slotCount = boneyard.length || 26;
  const available = boneyard.map(t => t !== null && t !== undefined);
  const stake = Number(gameState?.wegaStake) || 10;

  // === Verzuim/blocked overlay ===
  if (phase === 'ended' && endReason === 'claim_verzuim' && verzuim) {
    return <VerzuimOverlay verzuim={verzuim} stake={stake} />;
  }

  if (!phase || phase === 'playing' || phase === 'ended') return null;

  const handleDraw = async (index: number) => {
    if (busy || myCount >= 5) return;
    if (phase !== 'drawing') {
      toast({ title: 'Kon steen niet trekken', description: `Niet meer in trekfase (huidige fase: ${phase})`, variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc('wega_claim_boneyard_tile' as any, {
        _lobby_id: lobbyId,
        _tile_index: index,
      });
      if (error) throw error;
      onChanged();
    } catch (e: any) {
      toast({ title: 'Kon steen niet trekken', description: `${e?.message || String(e)} · fase=${phase}`, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  // === Claiming-starter view ===
  if (phase === 'claiming_starter') {
    const seq: Array<{ value1: number; value2: number }> = Array.isArray(gameState?.wegaClaimSequence) ? gameState.wegaClaimSequence : [];
    const idx = Number(gameState?.wegaClaimIndex || 0);
    const startedAt = Number(gameState?.wegaClaimStartedAt || 0);
    const currentTile = seq[idx];
    const elapsed = Math.max(0, now - startedAt);
    const remaining = Math.max(0, CLAIM_TIMER_MS - elapsed);
    const remainingPct = Math.max(0, Math.min(100, (remaining / CLAIM_TIMER_MS) * 100));
    const remainingSec = (remaining / 1000).toFixed(1);
    const missed: any[] = Array.isArray(gameState?.wegaClaimMissed) ? gameState.wegaClaimMissed : [];

    const iHaveIt = !!currentTile && myHand.some(t =>
      (t.value1 === currentTile.value1 && t.value2 === currentTile.value2) ||
      (t.value1 === currentTile.value2 && t.value2 === currentTile.value1)
    );

    const handleClaim = async () => {
      if (busy || !iHaveIt) return;
      setBusy(true);
      try {
        const { data, error } = await supabase.rpc('wega_claim_current' as any, { _lobby_id: lobbyId });
        if (error) throw error;
        const res = data as any;
        if (res?.blocked) {
          toast({ title: 'Spel stilgelegd!', description: 'Iemand heeft een eerdere steen verzuimd te claimen.', variant: 'destructive' });
        }
        onChanged();
      } catch (e: any) {
        toast({ title: 'Kon niet claimen', description: e?.message || String(e), variant: 'destructive' });
      } finally {
        setBusy(false);
      }
    };

    const tileLabel = currentTile ? `${currentTile.value1}-${currentTile.value2}` : '...';

    return (
      <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm overflow-auto flex flex-col items-center p-4">
        <div className="max-w-2xl w-full mx-auto">
          <header className="text-center mb-3">
            <h2 className="text-2xl font-bold text-yellow-300 flex items-center justify-center gap-2">
              <Coins className="h-6 w-6" /> Claim de startbeurt
            </h2>
            <p className="text-sm text-white/70 mt-1">Stap {idx + 1} van {seq.length} · Inzet {stake} coins</p>
          </header>

          <div className="bg-black/50 rounded-2xl p-6 flex flex-col items-center gap-4 ring-1 ring-white/10">
            <div className="text-white/80 text-lg">Wie heeft de <span className="text-yellow-300 font-bold">{tileLabel}</span>?</div>

            {currentTile && (
              <div className={`transition-transform ${iHaveIt ? 'animate-pulse scale-110' : 'opacity-50'}`}>
                <DominoTile data={currentTile as any} orientation={currentTile.value1 === currentTile.value2 ? 'vertical' : 'horizontal'} />
              </div>
            )}

            <div className="w-full">
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-[width] duration-100 ${remaining < 1000 ? 'bg-red-500' : 'bg-yellow-400'}`}
                  style={{ width: `${remainingPct}%` }}
                />
              </div>
              <div className="text-center text-white/70 text-xs mt-1">{remainingSec}s</div>
            </div>

            <button
              onClick={handleClaim}
              disabled={!iHaveIt || busy}
              className={`px-8 py-4 rounded-xl text-lg font-bold transition-all ${
                iHaveIt
                  ? 'bg-yellow-400 text-black hover:bg-yellow-300 shadow-lg shadow-yellow-500/40 animate-pulse'
                  : 'bg-white/10 text-white/40 cursor-not-allowed'
              }`}
            >
              {iHaveIt ? `Claim ${tileLabel}!` : 'Niet jouw steen'}
            </button>

            {missed.length > 0 && (
              <div className="text-xs text-orange-300/80 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {missed.length} steen/stenen verzuimd — spel wordt geblokkeerd bij volgende claim
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            {allPlayers.map(p => {
              const cnt = (hands[p.position] || []).length;
              return (
                <div key={p.position} className={`rounded-md p-2 text-center text-sm ${p.position === playerPosition ? 'bg-yellow-500/20 ring-1 ring-yellow-400' : 'bg-white/10'}`}>
                  <div className="text-white font-medium truncate">{p.username}</div>
                  <div className="text-white/70 flex items-center justify-center gap-1"><Hand className="h-3 w-3" /> {cnt}/5</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // === Drawing view (unchanged) ===
  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm overflow-auto flex flex-col items-center p-4">
      <div className="max-w-4xl w-full mx-auto">
        <header className="text-center mb-4">
          <h2 className="text-2xl font-bold text-yellow-300 flex items-center justify-center gap-2">
            <Coins className="h-6 w-6" /> Wega di sen — Inzet {stake} coins
          </h2>
          <p className="text-sm text-white/80 mt-1">Trek 5 stenen uit de boneyard</p>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {allPlayers.map(p => {
            const cnt = (hands[p.position] || []).length;
            return (
              <div key={p.position} className={`rounded-md p-2 text-center text-sm ${p.position === playerPosition ? 'bg-yellow-500/20 ring-1 ring-yellow-400' : 'bg-white/10'}`}>
                <div className="text-white font-medium truncate">{p.username}</div>
                <div className="text-white/70 flex items-center justify-center gap-1"><Hand className="h-3 w-3" /> {cnt}/5</div>
              </div>
            );
          })}
        </div>

        <div className="bg-black/40 rounded-xl p-3">
          <div className="text-white/80 text-sm mb-2 text-center">
            {myCount < 5 ? `Klik op een steen — nog ${5 - myCount} te trekken` : 'Wacht tot iedereen 5 stenen heeft…'}
          </div>
          <BoneyardScatter
            slotCount={slotCount}
            available={available}
            onPick={handleDraw}
            skin={skin ?? null}
            faceUpTiles={adminFaceUp ? (boneyard as any) : undefined}
          />
        </div>
      </div>
    </div>
  );
};

// === Verzuim overlay ===
const VerzuimOverlay: React.FC<{ verzuim: any; stake: number }> = ({ verzuim, stake }) => {
  const tile = verzuim?.tile;
  const tileLabel = tile ? `${tile.value1}-${tile.value2}` : '?';
  return (
    <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md overflow-auto flex flex-col items-center justify-center p-4 animate-in fade-in">
      <div className="max-w-xl w-full mx-auto bg-red-950/80 border-2 border-red-500 rounded-2xl p-6 text-center ring-4 ring-red-500/40 shadow-2xl shadow-red-900/60">
        <div className="flex items-center justify-center gap-2 text-red-300 mb-2">
          <AlertTriangle className="h-7 w-7" />
          <h2 className="text-2xl font-extrabold uppercase tracking-wider">Spel stilgelegd!</h2>
        </div>
        <p className="text-white text-lg mt-3">
          <span className="font-bold text-yellow-300">{verzuim?.username || 'Speler'}</span> heeft verzuimd om de{' '}
          <span className="font-bold text-yellow-300">{tileLabel}</span> tijdig te claimen.
        </p>
        <div className="flex justify-center my-4 animate-pulse">
          {tile && (
            <div className="ring-4 ring-red-500 rounded-md p-1 bg-white/5">
              <DominoTile data={tile} orientation={tile.value1 === tile.value2 ? 'vertical' : 'horizontal'} />
            </div>
          )}
        </div>
        <p className="text-red-200 text-base">
          Boete: <span className="font-bold text-yellow-300">{verzuim?.penalty || stake}</span> coins aan elke andere speler aan tafel.
        </p>
      </div>
    </div>
  );
};

export default WegaPhaseOverlay;
