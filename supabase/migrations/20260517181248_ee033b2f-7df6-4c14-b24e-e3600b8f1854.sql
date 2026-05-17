
-- 1) Wega di sen toggle setting
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES ('wega_di_sen_enabled', 'true'::jsonb, 'Wega di sen game mode beschikbaar in lobbies')
ON CONFLICT (setting_key) DO NOTHING;

-- 2) Allow any authenticated user to view lobby_players (needed for accurate player counts in the lobby list)
DROP POLICY IF EXISTS "Authenticated can view lobby players" ON public.lobby_players;
CREATE POLICY "Authenticated can view lobby players"
ON public.lobby_players
FOR SELECT
TO authenticated
USING (true);

-- 3) Fix Changa detection so it also fires with spinners (any number of tails, all same value)
CREATE OR REPLACE FUNCTION public.wega_submit_move(_lobby_id uuid, _hand_index integer, _x integer, _y integer, _orientation text, _flipped boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  _game record;
  _lobby record;
  _state jsonb;
  _hands jsonb;
  _hand jsonb;
  _tile jsonb;
  _player_pos int;
  _stake int;
  _v1 int; _v2 int;
  _pip1 int; _pip2 int;
  _cell_keys text[];
  _board jsonb;
  _dominoes jsonb;
  _domino_id text;
  _next_id int;
  _new_state jsonb;
  _claimer uuid;
  _other_user uuid;
  _other_pos int;
  _adj_match boolean := false;
  _adj_mismatch boolean := false;
  _is_double boolean := false;
  _i int;
  _tail_count int := 0;
  _tail_distinct_values int := 0;
  _changa boolean := false;
  _next_turn int;
  _player_count int;
  _new_hand jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  _claimer := auth.uid();

  SELECT player_position INTO _player_pos FROM public.lobby_players
    WHERE lobby_id = _lobby_id AND user_id = (auth.uid())::text LIMIT 1;
  IF _player_pos IS NULL THEN RAISE EXCEPTION 'Not in lobby'; END IF;

  SELECT * INTO _lobby FROM public.lobbies WHERE id = _lobby_id;
  _stake := COALESCE(_lobby.wega_stake, 10);

  SELECT * INTO _game FROM public.games WHERE lobby_id = _lobby_id ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF _game IS NULL THEN RAISE EXCEPTION 'Game not found'; END IF;

  _state := COALESCE(_game.game_state, '{}'::jsonb);
  IF COALESCE(_state->>'wegaPhase','') <> 'playing' THEN
    RAISE EXCEPTION 'Not in playing phase';
  END IF;
  IF COALESCE((_state->>'isGameOver')::boolean, false) THEN
    RAISE EXCEPTION 'Game already over';
  END IF;

  IF COALESCE(_game.current_player_turn, -1) <> _player_pos THEN
    FOR _other_pos IN 0..jsonb_array_length(COALESCE(_state->'playerHands','[]'::jsonb))-1 LOOP
      IF _other_pos <> _player_pos THEN
        SELECT user_id::uuid INTO _other_user FROM public.lobby_players
          WHERE lobby_id = _lobby_id AND player_position = _other_pos AND COALESCE(is_bot,false)=false LIMIT 1;
        IF _other_user IS NOT NULL THEN
          PERFORM public.transfer_coins(_claimer, _other_user, _stake);
        END IF;
      END IF;
    END LOOP;
    RETURN jsonb_build_object('ok', false, 'penalty', _stake, 'reason', 'not_your_turn');
  END IF;

  _hands := COALESCE(_state->'playerHands','[]'::jsonb);
  _hand := COALESCE(_hands->_player_pos,'[]'::jsonb);
  IF _hand_index < 0 OR _hand_index >= jsonb_array_length(_hand) THEN
    RAISE EXCEPTION 'Invalid hand index';
  END IF;
  _tile := _hand->_hand_index;
  _v1 := (_tile->>'value1')::int;
  _v2 := (_tile->>'value2')::int;
  _is_double := (_v1 = _v2);
  IF _flipped THEN _pip1 := _v2; _pip2 := _v1; ELSE _pip1 := _v1; _pip2 := _v2; END IF;

  _board := COALESCE(_state->'board','{}'::jsonb);
  _dominoes := COALESCE(_state->'dominoes','{}'::jsonb);

  IF _orientation = 'horizontal' THEN
    _cell_keys := ARRAY[_x::text||','||_y::text, (_x+1)::text||','||_y::text];
  ELSIF _orientation = 'vertical' THEN
    _cell_keys := ARRAY[_x::text||','||_y::text, _x::text||','||(_y+1)::text];
  ELSE
    RAISE EXCEPTION 'Invalid orientation';
  END IF;

  IF _board ? _cell_keys[1] OR _board ? _cell_keys[2] THEN
    FOR _other_pos IN 0..jsonb_array_length(_hands)-1 LOOP
      IF _other_pos <> _player_pos THEN
        SELECT user_id::uuid INTO _other_user FROM public.lobby_players
          WHERE lobby_id = _lobby_id AND player_position = _other_pos AND COALESCE(is_bot,false)=false LIMIT 1;
        IF _other_user IS NOT NULL THEN
          PERFORM public.transfer_coins(_claimer, _other_user, _stake);
        END IF;
      END IF;
    END LOOP;
    RETURN jsonb_build_object('ok', false, 'penalty', _stake, 'reason', 'cell_occupied');
  END IF;

  IF (SELECT COUNT(*) FROM jsonb_object_keys(_board)) = 0 THEN
    _adj_match := true;
  ELSE
    DECLARE
      cell_x int;
      cell_y int;
      other_cell_x int;
      other_cell_y int;
      pip int;
      idx int;
      nb_x int;
      nb_y int;
      nb_val int;
      nb_cell jsonb;
      is_end_dir boolean;
    BEGIN
      FOR idx IN 1..2 LOOP
        cell_x := split_part(_cell_keys[idx], ',', 1)::int;
        cell_y := split_part(_cell_keys[idx], ',', 2)::int;
        other_cell_x := split_part(_cell_keys[3-idx], ',', 1)::int;
        other_cell_y := split_part(_cell_keys[3-idx], ',', 2)::int;
        pip := CASE WHEN idx=1 THEN _pip1 ELSE _pip2 END;
        FOR nb_x, nb_y IN VALUES (cell_x, cell_y-1),(cell_x, cell_y+1),(cell_x-1, cell_y),(cell_x+1, cell_y) LOOP
          IF nb_x = other_cell_x AND nb_y = other_cell_y THEN CONTINUE; END IF;
          nb_cell := _board -> (nb_x::text||','||nb_y::text);
          IF nb_cell IS NULL THEN CONTINUE; END IF;
          nb_val := (nb_cell->>'value')::int;
          is_end_dir := (_orientation = 'horizontal' AND nb_y = cell_y) OR (_orientation = 'vertical' AND nb_x = cell_x);
          IF _is_double THEN
            IF nb_val = pip THEN _adj_match := true; ELSE _adj_mismatch := true; END IF;
          ELSE
            IF is_end_dir THEN
              IF nb_val = pip THEN _adj_match := true; ELSE _adj_mismatch := true; END IF;
            ELSE
              _adj_mismatch := true;
            END IF;
          END IF;
        END LOOP;
      END LOOP;
    END;
  END IF;

  IF NOT _adj_match OR _adj_mismatch THEN
    FOR _other_pos IN 0..jsonb_array_length(_hands)-1 LOOP
      IF _other_pos <> _player_pos THEN
        SELECT user_id::uuid INTO _other_user FROM public.lobby_players
          WHERE lobby_id = _lobby_id AND player_position = _other_pos AND COALESCE(is_bot,false)=false LIMIT 1;
        IF _other_user IS NOT NULL THEN
          PERFORM public.transfer_coins(_claimer, _other_user, _stake);
        END IF;
      END IF;
    END LOOP;
    RETURN jsonb_build_object('ok', false, 'penalty', _stake, 'reason', CASE WHEN _adj_mismatch THEN 'illegal_adjacency' ELSE 'no_matching_end' END);
  END IF;

  _next_id := COALESCE((_state->>'nextDominoId')::int, 0);
  _domino_id := 'd' || _next_id;
  _next_id := _next_id + 1;

  _dominoes := _dominoes || jsonb_build_object(_domino_id, jsonb_build_object(
    'data', jsonb_build_object('value1', _v1, 'value2', _v2),
    'x', _x, 'y', _y,
    'orientation', _orientation,
    'flipped', _flipped,
    'isSpinner', (_v1 = _v2)
  ));
  _board := _board || jsonb_build_object(
    _cell_keys[1], jsonb_build_object('dominoId', _domino_id, 'value', _pip1),
    _cell_keys[2], jsonb_build_object('dominoId', _domino_id, 'value', _pip2)
  );

  _new_hand := '[]'::jsonb;
  FOR _i IN 0..jsonb_array_length(_hand)-1 LOOP
    IF _i <> _hand_index THEN
      _new_hand := _new_hand || jsonb_build_array(_hand->_i);
    END IF;
  END LOOP;
  _hands := jsonb_set(_hands, ARRAY[_player_pos::text], _new_hand, true);

  _player_count := jsonb_array_length(_hands);
  _next_turn := (_player_pos + 1) % _player_count;

  _new_state := _state;
  _new_state := jsonb_set(_new_state, '{board}', _board, true);
  _new_state := jsonb_set(_new_state, '{dominoes}', _dominoes, true);
  _new_state := jsonb_set(_new_state, '{playerHands}', _hands, true);
  _new_state := jsonb_set(_new_state, '{nextDominoId}', to_jsonb(_next_id), true);
  _new_state := jsonb_set(_new_state, '{lastPlacerPosition}', to_jsonb(_player_pos), true);
  _new_state := jsonb_set(_new_state, '{lastPlacerUserId}', to_jsonb(_claimer::text), true);
  _new_state := jsonb_set(_new_state, '{openingPlacements}', to_jsonb(COALESCE((_state->>'openingPlacements')::int,0)+1), true);
  _new_state := jsonb_set(_new_state, '{consecutivePasses}', to_jsonb(0), true);

  IF jsonb_array_length(_new_hand) = 0 THEN
    SELECT COUNT(*), COUNT(DISTINCT tvalue)
      INTO _tail_count, _tail_distinct_values
      FROM public._wega_tail_values(_board);
    -- Changa = alle openstaande uiteinden (>=2) tonen dezelfde waarde,
    -- ook bij spinner-layouts met 3 of 4 uiteinden.
    _changa := (_tail_count >= 2 AND _tail_distinct_values = 1);

    PERFORM public._wega_finalize_game(_game.id, _lobby_id, _new_state, _player_pos,
      CASE WHEN _changa THEN 'changa' ELSE 'normal' END,
      CASE WHEN _changa THEN 2 ELSE 1 END);
    RETURN jsonb_build_object('ok', true, 'win', true, 'changa', _changa);
  END IF;

  UPDATE public.games SET game_state = _new_state, current_player_turn = _next_turn, updated_at = now() WHERE id = _game.id;
  RETURN jsonb_build_object('ok', true, 'win', false);
END;
$function$;
