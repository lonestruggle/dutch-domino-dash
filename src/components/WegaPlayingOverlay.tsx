import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Coins } from 'lucide-react';

interface Props {
  lobbyId: string;
  gameState: any;
  playerPosition: number;
  currentPlayer: number;
  allPlayers: Array<{ username: string; position: number; is_bot: boolean; user_id?: string }>;
}

const AUTO_PASS_KEY = 'wega:autoPass';

export const getWegaAutoPass = () => {
  try { return localStorage.getItem(AUTO_PASS_KEY) === '1'; } catch { return false; }
};

/**
 * Klein info-/pas-paneel voor Wega di sen "playing" fase.
 * Plaatsings-targets worden via Game.tsx in de bestaande GameBoard-flow gerenderd
 * (zoals in klassieke mode), zodat elk open einde speelbaar is.
 */
export const WegaPlayingOverlay: React.FC<Props> = ({ lobbyId, gameState, currentPlayer, playerPosition, allPlayers }) => {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [autoPass, setAutoPass] = React.useState<boolean>(getWegaAutoPass());

  // Notify everyone when someone passes (detected via consecutivePasses increase)
  const prevPassesRef = React.useRef<number>(Number(gameState?.consecutivePasses) || 0);
  const prevTurnRef = React.useRef<number>(Number(gameState?.currentPlayer ?? currentPlayer) || 0);
  React.useEffect(() => {
    const cp = Number(gameState?.consecutivePasses) || 0;
    if (cp > prevPassesRef.current) {
      const passerPos = prevTurnRef.current;
      const passer = allPlayers?.find((p) => p.position === passerPos);
      const name = passer?.username || `Speler ${passerPos + 1}`;
      toast({ title: `${name} heeft gepast`, duration: 2000 });
    }
    prevPassesRef.current = cp;
    prevTurnRef.current = Number(currentPlayer) || 0;
  }, [gameState?.consecutivePasses, currentPlayer, allPlayers, toast]);

  const phase = gameState?.wegaPhase as string | undefined;
  if (phase !== 'playing' || gameState?.isGameOver) return null;

  const stake = Number(gameState?.wegaStake) || 10;
  const isMyTurn = currentPlayer === playerPosition;

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

  const toggleAutoPass = (v: boolean) => {
    setAutoPass(v);
    try { localStorage.setItem(AUTO_PASS_KEY, v ? '1' : '0'); } catch {}
    window.dispatchEvent(new CustomEvent('wega:autoPassChanged', { detail: v }));
  };

  return (
    <div className="fixed top-20 right-4 z-40 bg-black/80 backdrop-blur-sm border border-yellow-400/40 rounded-lg px-3 py-2 flex items-center gap-3 text-xs text-white shadow-lg">
      <span className="flex items-center gap-1 text-yellow-300 font-semibold">
        <Coins className="h-3.5 w-3.5" /> Wega — Inzet {stake}
      </span>
      <label className="flex items-center gap-1 cursor-pointer select-none" title="Past automatisch als je geen zet hebt">
        <input
          type="checkbox"
          checked={autoPass}
          onChange={(e) => toggleAutoPass(e.target.checked)}
          className="accent-yellow-400"
        />
        Auto-pas
      </label>
      <Button size="sm" variant="destructive" disabled={!isMyTurn || busy} onClick={handlePass} className="h-7 px-3 text-xs">
        Pas
      </Button>
    </div>
  );
};

export default WegaPlayingOverlay;
