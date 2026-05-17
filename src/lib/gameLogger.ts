import { supabase } from '@/integrations/supabase/client';

/**
 * Logs een gebeurtenis naar public.game_logs.
 * Faalt stil: gameplay mag hier nooit op breken.
 */
export async function logGameEvent(params: {
  gameId: string;
  lobbyId?: string | null;
  eventType: string;
  data?: Record<string, any>;
  playerPosition?: number | null;
  currentTurn?: number | null;
  wegaPhase?: string | null;
}): Promise<void> {
  try {
    if (!params.gameId || !params.eventType) return;
    await supabase.rpc('log_game_event' as any, {
      _game_id: params.gameId,
      _lobby_id: params.lobbyId ?? null,
      _event_type: params.eventType,
      _event_data: params.data ?? {},
      _player_position: params.playerPosition ?? null,
      _current_turn: params.currentTurn ?? null,
      _wega_phase: params.wegaPhase ?? null,
    });
  } catch (err) {
    // bewust stil
    console.debug('[gameLogger] insert failed', err);
  }
}
