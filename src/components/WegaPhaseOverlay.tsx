import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BoneyardScatter } from '@/components/BoneyardScatter';
import { DominoTile } from '@/components/DominoTile';
import { Button } from '@/components/ui/button';
import { Coins, Hand } from 'lucide-react';
import type { DominoData } from '@/types/domino';

interface Props {
  lobbyId: string;
  gameState: any;
  playerPosition: number;
  allPlayers: Array<{ username: string; position: number; is_bot: boolean; user_id?: string }>;
  onChanged: () => void;
}

/**
 * Overlay voor "Wega di sen" tijdens drawing en claiming_starter fase.
 * Toont boneyard om uit te trekken, of toont eigen hand met claim-knoppen.
 */
export const WegaPhaseOverlay: React.FC<Props> = ({ lobbyId, gameState, playerPosition, allPlayers, onChanged }) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const phase = gameState?.wegaPhase as string | undefined;
  if (!phase || phase === 'playing' || phase === 'ended') return null;

  const hands: DominoData[][] = Array.isArray(gameState?.playerHands) ? gameState.playerHands : [];
  const myHand: DominoData[] = hands[playerPosition] || [];
  const myCount = myHand.length;
  const boneyard: Array<DominoData | null> = Array.isArray(gameState?.boneyard) ? gameState.boneyard : [];
  const slotCount = boneyard.length || 26;
  const available = boneyard.map(t => t !== null && t !== undefined);
  const stake = Number(gameState?.wegaStake) || 10;

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

  const handleClaimStarter = async (handIndex: number) => {
    if (busy) return;
    const tile = myHand[handIndex];
    const isDouble = tile.value1 === tile.value2;
    const label = isDouble ? `dubbel ${tile.value1}` : `${tile.value1}-${tile.value2}`;
    if (!confirm(`Claim startbeurt met ${label}? Bij foute claim betaal je ${stake} coins aan elke andere speler en eindigt het spel!`)) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('wega_claim_starter' as any, {
        _lobby_id: lobbyId,
        _hand_index: handIndex,
      });
      if (error) throw error;
      const result = data as any;
      if (result?.valid) {
        toast({ title: 'Correcte claim!', description: 'Jij begint het spel.' });
      } else {
        toast({ title: 'Foute claim!', description: `Je betaalt ${result?.penalty || stake} coins aan elke andere speler.`, variant: 'destructive' });
      }
      onChanged();
    } catch (e: any) {
      toast({ title: 'Kon claim niet uitvoeren', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm overflow-auto flex flex-col items-center p-4">
      <div className="max-w-4xl w-full mx-auto">
        <header className="text-center mb-4">
          <h2 className="text-2xl font-bold text-yellow-300 flex items-center justify-center gap-2">
            <Coins className="h-6 w-6" /> Wega di sen — Inzet {stake} coins
          </h2>
          <p className="text-sm text-white/80 mt-1">
            {phase === 'drawing' ? 'Trek 5 stenen uit de boneyard' : 'Claim de startbeurt met je hoogste dubbel of hoogste steen'}
          </p>
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

        {phase === 'drawing' && (
          <div className="bg-black/40 rounded-xl p-3">
            <div className="text-white/80 text-sm mb-2 text-center">
              {myCount < 5 ? `Klik op een steen — nog ${5 - myCount} te trekken` : 'Wacht tot iedereen 5 stenen heeft…'}
            </div>
            <BoneyardScatter slotCount={slotCount} available={available} onPick={handleDraw} skin={null} />
          </div>
        )}

        {phase === 'claiming_starter' && (
          <div className="bg-black/40 rounded-xl p-4">
            <div className="text-white text-sm mb-3 text-center">Jouw hand — klik op je hoogste dubbel (of hoogste steen als niemand een dubbel heeft):</div>
            <div className="flex flex-wrap justify-center gap-3">
              {myHand.map((d, i) => (
                <button
                  key={i}
                  onClick={() => handleClaimStarter(i)}
                  disabled={busy}
                  className="hover:scale-105 transition-transform disabled:opacity-50"
                >
                  <DominoTile data={d} orientation={d.value1 === d.value2 ? 'vertical' : 'horizontal'} />
                  <div className="text-yellow-300 text-xs mt-1">Ik begin</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WegaPhaseOverlay;