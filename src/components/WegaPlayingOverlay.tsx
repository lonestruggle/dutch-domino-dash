import React, { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DominoTile } from '@/components/DominoTile';
import { Button } from '@/components/ui/button';
import { Coins, RotateCw, FlipHorizontal2, Hand, X } from 'lucide-react';
import type { DominoData } from '@/types/domino';

interface Props {
  lobbyId: string;
  gameState: any;
  playerPosition: number;
  currentPlayer: number;
  allPlayers: Array<{ username: string; position: number; is_bot: boolean; user_id?: string }>;
}

type Orientation = 'horizontal' | 'vertical';

/**
 * Overlay voor de Wega di sen "playing" fase.
 * - Toont eigen hand met flip/draai-knoppen.
 * - Toont alle open buurcellen op het bord als klikbare plaatsings-opties.
 *   Klik op een verkeerde cel of verkeerde pip = boete (server-side).
 * - Pas-knop met confirmatie.
 */
export const WegaPlayingOverlay: React.FC<Props> = ({ lobbyId, gameState, playerPosition, currentPlayer, allPlayers }) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [orientation, setOrientation] = useState<Orientation>('horizontal');

  const phase = gameState?.wegaPhase as string | undefined;
  if (phase !== 'playing') return null;
  if (gameState?.isGameOver) return null;

  const hands: DominoData[][] = Array.isArray(gameState?.playerHands) ? gameState.playerHands : [];
  const myHand: DominoData[] = hands[playerPosition] || [];
  const stake = Number(gameState?.wegaStake) || 10;
  const isMyTurn = currentPlayer === playerPosition;
  const board: Record<string, { dominoId: string; value: number }> = gameState?.board || {};

  // Bereken open buurcellen (alle lege cellen direct naast bezette cellen)
  const openCells = useMemo(() => {
    const set = new Set<string>();
    for (const k of Object.keys(board)) {
      const [cx, cy] = k.split(',').map(Number);
      [[0,-1],[0,1],[-1,0],[1,0]].forEach(([dx,dy]) => {
        const key = `${cx+dx},${cy+dy}`;
        if (!board[key]) set.add(key);
      });
    }
    return Array.from(set).map(k => {
      const [x, y] = k.split(',').map(Number);
      return { x, y };
    }).sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y);
  }, [board]);

  const handleSelect = (idx: number) => {
    if (selectedIdx === idx) {
      setFlipped(f => !f);
    } else {
      setSelectedIdx(idx);
      setFlipped(false);
      const tile = myHand[idx];
      setOrientation(tile && tile.value1 === tile.value2 ? 'vertical' : 'horizontal');
    }
  };

  const handlePlace = async (x: number, y: number) => {
    if (busy || selectedIdx === null || !isMyTurn) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('wega_submit_move' as any, {
        _lobby_id: lobbyId,
        _hand_index: selectedIdx,
        _x: x,
        _y: y,
        _orientation: orientation,
        _flipped: flipped,
      });
      if (error) throw error;
      const r = data as any;
      if (r?.ok) {
        if (r?.win) {
          toast({ title: r.changa ? '🎉 CHANGA!' : 'Je hebt gewonnen!', description: r.changa ? `Dubbele uitbetaling!` : 'Spel afgelopen.' });
        } else {
          toast({ title: 'Zet geplaatst' });
        }
        setSelectedIdx(null);
        setFlipped(false);
      } else {
        toast({
          title: `Foute zet — boete ${r?.penalty || stake} coins per speler`,
          description: r?.reason === 'cell_occupied' ? 'Cel is al bezet' :
                       r?.reason === 'no_matching_end' ? 'Geen passende open einde' :
                       r?.reason === 'illegal_adjacency' ? 'Mag niet zijdelings aansluiten of pips komen niet overeen' :
                       r?.reason === 'not_your_turn' ? 'Niet jouw beurt' : 'Ongeldige zet',
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      toast({ title: 'Fout', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handlePass = async () => {
    if (busy || !isMyTurn) return;
    if (!confirm(`Pas? Je betaalt ${stake} coins aan de laatste plaatser (of meer bij openingsbonus).`)) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('wega_pass' as any, { _lobby_id: lobbyId });
      if (error) throw error;
      const r = data as any;
      if (r?.blocked) {
        toast({ title: 'Spel geblokkeerd', description: `Speler ${r.winner_position + 1} wint met laagste pips.` });
      } else {
        toast({ title: 'Gepast', description: `Boete: ${r?.penalty || stake} coins${r?.bonus ? ' (openingsbonus x2)' : ''}` });
      }
    } catch (e: any) {
      toast({ title: 'Fout', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const currentPlayerName = allPlayers.find(p => p.position === currentPlayer)?.username || `Speler ${currentPlayer + 1}`;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
      {/* Open cells overlay — float boven het bord */}
      {isMyTurn && selectedIdx !== null && (
        <div className="pointer-events-auto fixed top-20 left-1/2 -translate-x-1/2 bg-black/85 text-white rounded-lg p-3 max-h-[40vh] overflow-auto max-w-md w-[90vw]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-yellow-300">Kies een cel om te plaatsen</span>
            <button onClick={() => setSelectedIdx(null)} className="text-white/60 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <p className="text-xs text-white/60 mb-2">Verkeerde keuze = boete van {stake} coins per andere speler. Steen blijft in je hand.</p>
          <div className="grid grid-cols-3 gap-1.5">
            {openCells.length === 0 && (
              <div className="col-span-3 text-center text-white/60 text-sm py-3">Geen open cellen — bord is leeg, kies (0,0)
                <Button size="sm" className="mt-2 w-full" onClick={() => handlePlace(0, 0)} disabled={busy}>Plaats op (0,0)</Button>
              </div>
            )}
            {openCells.map(c => (
              <Button
                key={`${c.x},${c.y}`}
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => handlePlace(c.x, c.y)}
                className="text-xs"
              >
                ({c.x}, {c.y})
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom panel: hand + acties */}
      <div className="pointer-events-auto bg-black/85 backdrop-blur-sm border-t border-yellow-400/30 p-2 sm:p-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-yellow-300">
              <Coins className="h-4 w-4" /> Inzet {stake}
            </div>
            <div className="text-white">
              {isMyTurn ? <span className="text-yellow-300 font-semibold">Jouw beurt</span> : `Wachten op ${currentPlayerName}…`}
            </div>
            <Button
              size="sm"
              variant="destructive"
              disabled={!isMyTurn || busy}
              onClick={handlePass}
            >
              Pas
            </Button>
          </div>

          {/* Flip/rotate controls (alleen als steen geselecteerd) */}
          {selectedIdx !== null && myHand[selectedIdx] && (
            <div className="flex items-center justify-center gap-2 mb-2">
              <Button size="sm" variant="outline" onClick={() => setFlipped(f => !f)} className="text-xs">
                <FlipHorizontal2 className="h-3 w-3 mr-1" /> Flip {flipped ? '(omgedraaid)' : ''}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setOrientation(o => o === 'horizontal' ? 'vertical' : 'horizontal')} className="text-xs">
                <RotateCw className="h-3 w-3 mr-1" /> {orientation === 'horizontal' ? 'Liggend' : 'Staand'}
              </Button>
            </div>
          )}

          {/* Hand */}
          <div className="flex justify-center gap-2 flex-wrap">
            {myHand.length === 0 && <span className="text-white/60 text-sm">Hand leeg</span>}
            {myHand.map((d, i) => {
              const isSel = i === selectedIdx;
              const showFlipped = isSel && flipped;
              const showOrientation = isSel ? orientation : (d.value1 === d.value2 ? 'vertical' : 'horizontal');
              const tileData = showFlipped ? { value1: d.value2, value2: d.value1 } : d;
              return (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  disabled={!isMyTurn || busy}
                  className={`transition-transform ${isSel ? 'ring-2 ring-yellow-400 scale-110' : 'hover:scale-105'} disabled:opacity-50`}
                >
                  <DominoTile data={tileData} orientation={showOrientation} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WegaPlayingOverlay;