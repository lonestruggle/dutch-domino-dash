CREATE OR REPLACE FUNCTION public.update_game_state_for_lobby(
  _lobby_id uuid,
  _game_state jsonb,
  _current_player_turn integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.can_moderate(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.lobby_players lp
      WHERE lp.lobby_id = _lobby_id
        AND lp.user_id = (auth.uid())::text
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to update this game';
  END IF;

  UPDATE public.games
  SET
    game_state = _game_state,
    current_player_turn = _current_player_turn,
    updated_at = now()
  WHERE lobby_id = _lobby_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;
END;
$$;