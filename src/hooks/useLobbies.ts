import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from './useSimpleAuth';

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

  const createLobby = async (name: string, user: User, maxPlayers: number = 4) => {
    if (!user) return { error: 'Not authenticated' };

    const { data: lobby, error: lobbyError } = await supabase
      .from('lobbies')
      .insert({
        name,
        created_by: user.id,
        created_by_username: user.username,
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
        username: user.username,
        player_position: 0
      });

    if (joinError) return { error: joinError };

    return { data: lobby, error: null };
  };

  const joinLobby = async (lobbyId: string, user: User) => {
    if (!user) return { error: 'Not authenticated' };

    // Check if user is already in this lobby
    const { data: existingPlayer } = await supabase
      .from('lobby_players')
      .select('id')
      .eq('lobby_id', lobbyId)
      .eq('user_id', user.id)
      .single();

    if (existingPlayer) {
      // User is already in lobby, return success so they can navigate to it
      return { error: null };
    }

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
        username: user.username,
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

  const deleteLobby = async (lobbyId: string, user: User) => {
    if (!user) return { error: 'Not authenticated' };
    
    // First delete all lobby players
    const { error: playersError } = await supabase
      .from('lobby_players')
      .delete()
      .eq('lobby_id', lobbyId);

    if (playersError) return { error: playersError };

    // Then delete the lobby
    const { error: lobbyError } = await supabase
      .from('lobbies')
      .delete()
      .eq('id', lobbyId)
      .eq('created_by', user.id); // Only allow creator to delete

    if (lobbyError) return { error: lobbyError };

    // Immediately update the local state
    setLobbies(prevLobbies => prevLobbies.filter(lobby => lobby.id !== lobbyId));
    
    return { error: null };
  };

  return {
    lobbies,
    loading,
    createLobby,
    joinLobby,
    deleteLobby,
    refetch: fetchLobbies
  };
};