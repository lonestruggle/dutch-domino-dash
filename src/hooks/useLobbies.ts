import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

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

  const botNames = [
    "Domino Dave 🤖",
    "Robot Raja 🤖", 
    "Bot Betty 🤖",
    "AI Alex 🤖",
    "Cyber Sam 🤖",
    "Digital Dina 🤖"
  ];

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
      player_count: lobby.lobby_players?.[0]?.count || 0
    })) || [];

    setLobbies(lobbiesWithCount);
    setLoading(false);
  };

  const createLobby = async (name: string, user: User, maxPlayers: number = 4) => {
    if (!user) return { error: 'Not authenticated' };

    // Get username from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('user_id', user.id)
      .single();

    const username = profile?.username || user.email || 'Unknown';

    const { data: lobby, error: lobbyError } = await supabase
      .from('lobbies')
      .insert({
        name,
        created_by: user.id,
        created_by_username: username,
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
         username: username,
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

    // Get username from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('user_id', user.id)
      .single();

    const username = profile?.username || user.email || 'Player';

    // Try positions 0-3 until we find one that works (atomic operation)
    for (let position = 0; position < 4; position++) {
      const { error } = await supabase
        .from('lobby_players')
        .insert({
          lobby_id: lobbyId,
          user_id: user.id,
          username: username,
          player_position: position
        });

      if (!error) {
        // Successfully joined at this position
        return { error: null };
      }

      // If it's not a unique constraint violation, return the error
      if (!error.message.includes('duplicate key value violates unique constraint')) {
        return { error };
      }

      // Otherwise, try next position
    }

    // All positions are taken
    return { error: 'Lobby is vol' };
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

  const adminDeleteLobby = async (lobbyId: string, user: User) => {
    if (!user) return { error: 'Not authenticated' };
    
    // Check if user is admin
    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!adminRole) return { error: 'Not authorized - admin access required' };
    
    // First delete all lobby players
    const { error: playersError } = await supabase
      .from('lobby_players')
      .delete()
      .eq('lobby_id', lobbyId);

    if (playersError) return { error: playersError };

    // Then delete the lobby (no creator restriction for admins)
    const { error: lobbyError } = await supabase
      .from('lobbies')
      .delete()
      .eq('id', lobbyId);

    if (lobbyError) return { error: lobbyError };

    // Immediately update the local state
    setLobbies(prevLobbies => prevLobbies.filter(lobby => lobby.id !== lobbyId));
    
    return { error: null };
  };

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

  const addBot = async (lobbyId: string, user: User) => {
    if (!user) return { error: 'Not authenticated' };

    // Check if user is lobby creator
    const { data: lobby } = await supabase
      .from('lobbies')
      .select('created_by')
      .eq('id', lobbyId)
      .single();

    if (!lobby || lobby.created_by !== user.id) {
      return { error: 'Only lobby creator can add bots' };
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

    // Get a random bot name that's not already used
    const { data: existingBots } = await supabase
      .from('lobby_players')
      .select('bot_name')
      .eq('lobby_id', lobbyId)
      .eq('is_bot', true);

    const usedBotNames = existingBots?.map(b => b.bot_name) || [];
    const availableBotNames = botNames.filter(name => !usedBotNames.includes(name));
    
    if (availableBotNames.length === 0) {
      return { error: 'No more bot names available' };
    }

    const selectedBotName = availableBotNames[Math.floor(Math.random() * availableBotNames.length)];

    // Add bot to lobby
    const { error } = await supabase
      .from('lobby_players')
      .insert({
        lobby_id: lobbyId,
        user_id: null,
        username: selectedBotName,
        bot_name: selectedBotName,
        is_bot: true,
        player_position: nextPosition
      });

    return { error };
  };

  const removeBot = async (lobbyId: string, botPosition: number, user: User) => {
    if (!user) return { error: 'Not authenticated' };

    // Check if user is lobby creator
    const { data: lobby } = await supabase
      .from('lobbies')
      .select('created_by')
      .eq('id', lobbyId)
      .single();

    if (!lobby || lobby.created_by !== user.id) {
      return { error: 'Only lobby creator can remove bots' };
    }

    // Remove bot from lobby
    const { error } = await supabase
      .from('lobby_players')
      .delete()
      .eq('lobby_id', lobbyId)
      .eq('player_position', botPosition)
      .eq('is_bot', true);

    return { error };
  };

  return {
    lobbies,
    loading,
    createLobby,
    joinLobby,
    deleteLobby,
    adminDeleteLobby,
    addBot,
    removeBot,
    refetch: fetchLobbies
  };
};