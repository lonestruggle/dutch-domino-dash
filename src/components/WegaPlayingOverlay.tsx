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

/**
 * Klein info-/pas-paneel voor Wega di sen "playing" fase.
 * Plaatsings-targets worden via Game.tsx in de bestaande GameBoard-flow gerenderd
 * (zoals in klassieke mode), zodat elk open einde speelbaar is.
 */
export const WegaPlayingOverlay: React.FC<Props> = ({ lobbyId, gameState, currentPlayer, playerPosition }) => {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
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

  return (
    <div className="fixed top-20 right-4 z-40 bg-black/80 backdrop-blur-sm border border-yellow-400/40 rounded-lg px-3 py-2 flex items-center gap-3 text-xs text-white shadow-lg">
      <span className="flex items-center gap-1 text-yellow-300 font-semibold">
        <Coins className="h-3.5 w-3.5" /> Wega — Inzet {stake}
      </span>
      <Button size="sm" variant="destructive" disabled={!isMyTurn || busy} onClick={handlePass} className="h-7 px-3 text-xs">
        Pas
      </Button>
    </div>
  );
};

export default WegaPlayingOverlay;
