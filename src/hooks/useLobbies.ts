import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Lobby {
  id: string;
  name: string;
  created_by: string;
  max_players: number;
  status: 'waiting' | 'playing' | 'finished';
  player_count: number;
  created_at: string;
}

export const useLobbies = () => {
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLobbies = async () => {
    const { data, error } = await supabase
      .from('lobbies')
      .select(`
        *,
        lobby_players(count)
      `)
      .eq('status', 'waiting')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching lobbies:', error);
      return;
    }

    const lobbiesWithCount: Lobby[] = data?.map(lobby => ({
      id: lobby.id,
      name: lobby.name,
      created_by: lobby.created_by,
      max_players: lobby.max_players,
      status: lobby.status as 'waiting' | 'playing' | 'finished',
      created_at: lobby.created_at,
      player_count: lobby.lobby_players?.length || 0
    })) || [];

    setLobbies(lobbiesWithCount);
    setLoading(false);
  };

  const createLobby = async (name: string, maxPlayers: number = 4) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    const { data: lobby, error: lobbyError } = await supabase
      .from('lobbies')
      .insert({
        name,
        created_by: user.id,
        max_players: maxPlayers
      })
      .select()
      .single();

    if (lobbyError) return { error: lobbyError };

    // Join the lobby as the first player
    const { error: joinError } = await supabase
      .from('lobby_players')
      .insert({
        lobby_id: lobby.id,
        user_id: user.id,
        player_position: 0
      });

    if (joinError) return { error: joinError };

    return { data: lobby, error: null };
  };

  const joinLobby = async (lobbyId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    // Get current players count and find next available position
    const { data: players, error: playersError } = await supabase
      .from('lobby_players')
      .select('player_position')
      .eq('lobby_id', lobbyId)
      .order('player_position');

    if (playersError) return { error: playersError };

    // Find next available position
    let nextPosition = 0;
    const usedPositions = players?.map(p => p.player_position) || [];
    while (usedPositions.includes(nextPosition) && nextPosition < 4) {
      nextPosition++;
    }

    if (nextPosition >= 4) {
      return { error: 'Lobby is full' };
    }

    const { error } = await supabase
      .from('lobby_players')
      .insert({
        lobby_id: lobbyId,
        user_id: user.id,
        player_position: nextPosition
      });

    return { error };
  };

  useEffect(() => {
    fetchLobbies();

    // Subscribe to lobby changes
    const channel = supabase
      .channel('lobbies-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lobbies' },
        () => fetchLobbies()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lobby_players' },
        () => fetchLobbies()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    lobbies,
    loading,
    createLobby,
    joinLobby,
    refetch: fetchLobbies
  };
};