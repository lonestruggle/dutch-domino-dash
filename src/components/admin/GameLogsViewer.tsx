import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, RefreshCw, Search, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GameRow {
  id: string;
  lobby_id: string;
  status: string;
  winner_position: number | null;
  created_at: string;
  updated_at: string;
  lobby_name?: string | null;
  log_count?: number;
}

interface LogRow {
  id: string;
  game_id: string;
  lobby_id: string | null;
  player_position: number | null;
  user_id: string | null;
  username: string | null;
  event_type: string;
  event_data: any;
  current_turn: number | null;
  wega_phase: string | null;
  created_at: string;
}

const EVENT_COLORS: Record<string, string> = {
  move_submitted: 'bg-green-500/20 text-green-300 border-green-500/40',
  move_rejected: 'bg-red-500/20 text-red-300 border-red-500/40',
  pass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  boneyard_claimed: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  starter_claimed: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  game_ended: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  coin_transfer: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  state_snapshot: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  tile_selected: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  client_error: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
};

function summarize(log: LogRow): string {
  const d = log.event_data || {};
  switch (log.event_type) {
    case 'move_submitted':
      return `Plaats ${d.tile?.value1}-${d.tile?.value2} op (${d.x},${d.y}) ${d.orientation}${d.flipped ? ' flipped' : ''}`;
    case 'move_rejected':
      return `Geweigerd: ${d.reason}${d.penalty ? ` · boete ${d.penalty}` : ''}`;
    case 'pass':
      return `Pas · boete ${d.penalty}${d.bonus ? ' (2x bonus)' : ''} · ${d.consecutive_passes}x op rij`;
    case 'boneyard_claimed':
      return `Steen ${d.tile?.value1}-${d.tile?.value2} uit boneyard (slot ${d.tile_index})`;
    case 'starter_claimed':
      return `${d.valid ? 'Geldige' : 'Ongeldige'} starter-claim ${d.tile?.value1}-${d.tile?.value2}`;
    case 'game_ended':
      return `Einde · ${d.reason} · winnaar pos ${d.winner_position} · stake ${d.stake}x${d.multiplier}`;
    case 'coin_transfer':
      return `${d.amount} coins · ${d.reason}`;
    case 'tile_selected':
      return `Selecteer ${d.tile?.value1}-${d.tile?.value2} (hand ${d.hand_index})`;
    case 'state_snapshot':
      return `Snapshot · dominoes ${d.domino_count} · phase ${d.wega_phase ?? '-'}`;
    case 'client_error':
      return d.message ?? 'Client error';
    default:
      return log.event_type;
  }
}

export const GameLogsViewer: React.FC = () => {
  const { toast } = useToast();
  const [games, setGames] = React.useState<GameRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedGame, setSelectedGame] = React.useState<GameRow | null>(null);
  const [logs, setLogs] = React.useState<LogRow[]>([]);
  const [logsLoading, setLogsLoading] = React.useState(false);
  const [filterType, setFilterType] = React.useState<string>('');
  const [filterPlayer, setFilterPlayer] = React.useState<string>('');
  const [selectedLog, setSelectedLog] = React.useState<LogRow | null>(null);
  const [search, setSearch] = React.useState('');

  const fetchGames = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data: gameData, error } = await supabase
        .from('games')
        .select('id, lobby_id, status, winner_position, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const lobbyIds = Array.from(new Set((gameData || []).map((g: any) => g.lobby_id).filter(Boolean)));
      let lobbyNames: Record<string, string> = {};
      if (lobbyIds.length) {
        const { data: lobs } = await supabase.from('lobbies').select('id, name').in('id', lobbyIds);
        (lobs || []).forEach((l: any) => { lobbyNames[l.id] = l.name; });
      }
      // Counts via log table per-game (lichte query)
      const gameIds = (gameData || []).map((g: any) => g.id);
      let counts: Record<string, number> = {};
      if (gameIds.length) {
        const { data: logRows } = await supabase
          .from('game_logs' as any)
          .select('game_id')
          .in('game_id', gameIds);
        (logRows || []).forEach((r: any) => { counts[r.game_id] = (counts[r.game_id] || 0) + 1; });
      }
      setGames((gameData || []).map((g: any) => ({ ...g, lobby_name: lobbyNames[g.lobby_id], log_count: counts[g.id] || 0 })));
    } catch (e: any) {
      toast({ title: 'Fout bij laden games', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchLogs = React.useCallback(async (gameId: string) => {
    setLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from('game_logs' as any)
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: true })
        .limit(2000);
      if (error) throw error;
      setLogs((data || []) as any);
    } catch (e: any) {
      toast({ title: 'Fout bij laden logs', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setLogsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => { fetchGames(); }, [fetchGames]);

  // Auto-refresh van logs voor open game elke 5s
  React.useEffect(() => {
    if (!selectedGame) return;
    const t = setInterval(() => fetchLogs(selectedGame.id), 5000);
    return () => clearInterval(t);
  }, [selectedGame, fetchLogs]);

  const openGame = (g: GameRow) => {
    setSelectedGame(g);
    setFilterType('');
    setFilterPlayer('');
    setSelectedLog(null);
    fetchLogs(g.id);
  };

  const exportJson = () => {
    if (!selectedGame) return;
    const blob = new Blob([JSON.stringify({ game: selectedGame, logs }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game-log-${selectedGame.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = React.useMemo(() => {
    return logs.filter(l => {
      if (filterType && l.event_type !== filterType) return false;
      if (filterPlayer && String(l.player_position) !== filterPlayer) return false;
      return true;
    });
  }, [logs, filterType, filterPlayer]);

  const filteredGames = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return games;
    return games.filter(g =>
      (g.lobby_name || '').toLowerCase().includes(q) ||
      g.id.toLowerCase().includes(q) ||
      g.lobby_id.toLowerCase().includes(q),
    );
  }, [games, search]);

  const uniqueTypes = React.useMemo(() => Array.from(new Set(logs.map(l => l.event_type))).sort(), [logs]);
  const uniquePositions = React.useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => { if (l.player_position != null) set.add(String(l.player_position)); });
    return Array.from(set).sort();
  }, [logs]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Game Logs</CardTitle>
            <CardDescription>Per spel zie je alle zetten, fouten en gebeurtenissen. Handig om bugs na te lopen.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Zoek lobby/id..." className="pl-8 w-48" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button size="sm" variant="outline" onClick={fetchGames} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Mobiele kaartlijst */}
          <div className="space-y-2 sm:hidden">
            {filteredGames.map((g) => (
              <button
                key={g.id}
                onClick={() => openGame(g)}
                className="w-full text-left rounded-md border p-3 hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{g.lobby_name || g.lobby_id.slice(0, 8)}</span>
                  <Badge variant={g.status === 'finished' ? 'secondary' : 'default'}>{g.status}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                  <span>{g.log_count} events</span>
                  {g.winner_position != null ? <span>winnaar pos {g.winner_position}</span> : null}
                  <span>{new Date(g.created_at).toLocaleString('nl-NL')}</span>
                </div>
                <div className="mt-2 flex justify-end">
                  <span className="inline-flex items-center text-xs text-primary"><Eye className="h-3 w-3 mr-1" /> Bekijk log</span>
                </div>
              </button>
            ))}
            {filteredGames.length === 0 && !loading ? (
              <div className="py-6 text-center text-muted-foreground text-sm">Geen games gevonden.</div>
            ) : null}
          </div>

          {/* Desktop tabel */}
          <div className="overflow-x-auto hidden sm:block">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr>
                  <th className="py-2 pr-3">Lobby</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Winnaar</th>
                  <th className="py-2 pr-3">Events</th>
                  <th className="py-2 pr-3">Gestart</th>
                  <th className="py-2 pr-3">Laatst</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredGames.map((g) => (
                  <tr key={g.id} className="border-b hover:bg-muted/40">
                    <td className="py-2 pr-3 font-medium">{g.lobby_name || g.lobby_id.slice(0, 8)}</td>
                    <td className="py-2 pr-3"><Badge variant={g.status === 'finished' ? 'secondary' : 'default'}>{g.status}</Badge></td>
                    <td className="py-2 pr-3">{g.winner_position != null ? `pos ${g.winner_position}` : '—'}</td>
                    <td className="py-2 pr-3">{g.log_count}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{new Date(g.created_at).toLocaleString('nl-NL')}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{new Date(g.updated_at).toLocaleString('nl-NL')}</td>
                    <td className="py-2 pr-3"><Button size="sm" variant="outline" onClick={() => openGame(g)}><Eye className="h-4 w-4 mr-1" /> Bekijk</Button></td>
                  </tr>
                ))}
                {filteredGames.length === 0 && !loading ? (
                  <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Geen games gevonden.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedGame} onOpenChange={(o) => !o && setSelectedGame(null)}>
        <DialogContent className="max-w-5xl w-[calc(100vw-1rem)] sm:w-full p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle>{selectedGame?.lobby_name || selectedGame?.lobby_id?.slice(0, 8)} — Log</DialogTitle>
            <DialogDescription>
              Game ID: <code className="text-xs">{selectedGame?.id}</code>
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2 mb-2">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="">Alle event types</option>
              {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterPlayer} onChange={(e) => setFilterPlayer(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="">Alle spelers</option>
              {uniquePositions.map(p => <option key={p} value={p}>positie {p}</option>)}
            </select>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => selectedGame && fetchLogs(selectedGame.id)} disabled={logsLoading}>
                <RefreshCw className={`h-4 w-4 ${logsLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button size="sm" variant="outline" onClick={exportJson}><Download className="h-4 w-4 mr-1" /> Export</Button>
            </div>
          </div>

          <ScrollArea className="h-[60vh] border rounded-md">
            <div className="divide-y">
              {filteredLogs.map((l) => (
                <button key={l.id} onClick={() => setSelectedLog(l)} className="w-full text-left p-2 hover:bg-muted/40 flex flex-col sm:grid sm:grid-cols-[110px_140px_1fr_80px] gap-1 sm:gap-2 sm:items-center">
                  <div className="flex items-center gap-2 sm:contents">
                    <span className="text-xs text-muted-foreground tabular-nums">{new Date(l.created_at).toLocaleTimeString('nl-NL')}</span>
                    <Badge variant="outline" className={EVENT_COLORS[l.event_type] || ''}>{l.event_type}</Badge>
                  </div>
                  <span className="text-sm break-words sm:truncate">{summarize(l)}</span>
                  <span className="text-xs sm:text-right text-muted-foreground">{l.username ? l.username : (l.player_position != null ? `p${l.player_position}` : '—')}</span>
                </button>
              ))}
              {filteredLogs.length === 0 && !logsLoading ? (
                <div className="p-6 text-center text-muted-foreground text-sm">Geen logs.</div>
              ) : null}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedLog} onOpenChange={(o) => !o && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedLog?.event_type}</DialogTitle>
            <DialogDescription>
              {selectedLog ? new Date(selectedLog.created_at).toLocaleString('nl-NL') : ''}
              {selectedLog?.username ? ` · ${selectedLog.username}` : ''}
              {selectedLog?.player_position != null ? ` · positie ${selectedLog.player_position}` : ''}
              {selectedLog?.wega_phase ? ` · ${selectedLog.wega_phase}` : ''}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <pre className="text-xs bg-muted p-3 rounded-md whitespace-pre-wrap break-words">{JSON.stringify(selectedLog?.event_data, null, 2)}</pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GameLogsViewer;
