CREATE OR REPLACE FUNCTION public._wega_resolve_actor(_lobby_id uuid, _actor_override integer)
RETURNS TABLE(actor_pos integer, actor_uid uuid, actor_is_bot boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  _caller uuid;
  _caller_in_lobby boolean;
  _pos integer;
  _uid uuid;
  _bot boolean;
BEGIN
  _caller := auth.uid();
  IF _caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF _actor_override IS NULL THEN
    SELECT lp.player_position, lp.user_id::uuid, COALESCE(lp.is_bot,false)
      INTO _pos, _uid, _bot
      FROM public.lobby_players lp
      WHERE lp.lobby_id = _lobby_id AND lp.user_id = _caller::text
      LIMIT 1;
    IF _pos IS NULL THEN RAISE EXCEPTION 'Not in lobby'; END IF;
    actor_pos := _pos; actor_uid := _uid; actor_is_bot := _bot;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.lobby_players lp
    WHERE lp.lobby_id = _lobby_id AND lp.user_id = _caller::text
  ) INTO _caller_in_lobby;
  IF NOT _caller_in_lobby AND NOT public.can_moderate(_caller) THEN
    RAISE EXCEPTION 'Not in lobby (cannot act for others)';
  END IF;

  SELECT lp.player_position, lp.user_id::uuid, COALESCE(lp.is_bot,false)
    INTO _pos, _uid, _bot
    FROM public.lobby_players lp
    WHERE lp.lobby_id = _lobby_id AND lp.player_position = _actor_override
    LIMIT 1;
  IF _pos IS NULL THEN RAISE EXCEPTION 'Actor position not found in lobby'; END IF;
  IF NOT _bot THEN
    RAISE EXCEPTION 'Cannot impersonate a human player';
  END IF;
  actor_pos := _pos; actor_uid := _uid; actor_is_bot := _bot;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.wega_claim_boneyard_tile(_lobby_id uuid, _tile_index integer, _actor_position integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  _game record;
  _state jsonb;
  _boneyard jsonb;
  _hands jsonb;
  _tile jsonb;
  _player_pos int;
  _actor_uid uuid;
  _actor_is_bot boolean;
  _hand jsonb;
  _hand_len int;
  _all_full boolean := true;
  _i int;
BEGIN
  SELECT a.actor_pos, a.actor_uid, a.actor_is_bot
    INTO _player_pos, _actor_uid, _actor_is_bot
    FROM public._wega_resolve_actor(_lobby_id, _actor_position) a;

  SELECT * INTO _game FROM public.games WHERE lobby_id = _lobby_id
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF _game IS NULL THEN RAISE EXCEPTION 'Game not found'; END IF;

  _state := COALESCE(_game.game_state, '{}'::jsonb);
  IF COALESCE(_state->>'wegaPhase', '') <> 'drawing' THEN
    PERFORM public.log_game_event(_game.id, _lobby_id, 'move_rejected',
      jsonb_build_object('reason','not_in_drawing_phase','current_phase', _state->>'wegaPhase','tile_index', _tile_index),
      _player_pos, _game.current_player_turn, _state->>'wegaPhase');
    RAISE EXCEPTION 'Not in drawing phase (current: %)', COALESCE(_state->>'wegaPhase','null');
  END IF;

  _boneyard := COALESCE(_state->'boneyard', '[]'::jsonb);
  IF _tile_index < 0 OR _tile_index >= jsonb_array_length(_boneyard) THEN
    RAISE EXCEPTION 'Invalid tile index';
  END IF;

  _tile := _boneyard->_tile_index;
  IF _tile IS NULL OR _tile = 'null'::jsonb THEN
    RAISE EXCEPTION 'Tile already taken';
  END IF;

  _hands := COALESCE(_state->'playerHands', '[]'::jsonb);
  _hand := COALESCE(_hands->_player_pos, '[]'::jsonb);
  _hand_len := jsonb_array_length(_hand);
  IF _hand_len >= 5 THEN RAISE EXCEPTION 'Already 5 tiles'; END IF;

  _boneyard := jsonb_set(_boneyard, ARRAY[_tile_index::text], 'null'::jsonb, false);
  _hand := _hand || jsonb_build_array(_tile);
  _hands := jsonb_set(_hands, ARRAY[_player_pos::text], _hand, true);

  FOR _i IN 0..jsonb_array_length(_hands)-1 LOOP
    IF jsonb_array_length(COALESCE(_hands->_i, '[]'::jsonb)) < 5 THEN
      _all_full := false;
      EXIT;
    END IF;
  END LOOP;

  _state := jsonb_set(_state, '{boneyard}', _boneyard, true);
  _state := jsonb_set(_state, '{playerHands}', _hands, true);
  IF _all_full THEN
    _state := jsonb_set(_state, '{wegaPhase}', '"claiming_starter"'::jsonb, true);
  END IF;

  UPDATE public.games SET game_state = _state, updated_at = now() WHERE id = _game.id;

  PERFORM public.log_game_event(_game.id, _lobby_id, 'boneyard_claimed',
    jsonb_build_object('tile_index', _tile_index, 'tile', _tile, 'hand_size_after', _hand_len + 1, 'all_full', _all_full, 'by_bot', _actor_is_bot),
    _player_pos, _game.current_player_turn, _state->>'wegaPhase');

  RETURN jsonb_build_object('ok', true, 'all_full', _all_full);
END;
$$;

CREATE OR REPLACE FUNCTION public.wega_claim_starter(_lobby_id uuid, _hand_index integer, _actor_position integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  _game record;
  _lobby record;
  _state jsonb;
  _hands jsonb;
  _hand jsonb;
  _tile jsonb;
  _player_pos int;
  _actor_uid uuid;
  _actor_is_bot boolean;
  _claim_v1 int;
  _claim_v2 int;
  _is_double boolean;
  _highest_double int := -1;
  _highest_single_sum int := -1;
  _i int;
  _j int;
  _ph jsonb;
  _t jsonb;
  _v1 int;
  _v2 int;
  _valid boolean;
  _stake int;
  _other_user uuid;
  _other_pos int;
BEGIN
  SELECT a.actor_pos, a.actor_uid, a.actor_is_bot
    INTO _player_pos, _actor_uid, _actor_is_bot
    FROM public._wega_resolve_actor(_lobby_id, _actor_position) a;

  SELECT * INTO _lobby FROM public.lobbies WHERE id = _lobby_id;
  _stake := COALESCE(_lobby.wega_stake, 10);

  SELECT * INTO _game FROM public.games WHERE lobby_id = _lobby_id
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF _game IS NULL THEN RAISE EXCEPTION 'Game not found'; END IF;

  _state := COALESCE(_game.game_state, '{}'::jsonb);
  IF COALESCE(_state->>'wegaPhase', '') <> 'claiming_starter' THEN
    RAISE EXCEPTION 'Not in claiming_starter phase (current: %)', COALESCE(_state->>'wegaPhase','null');
  END IF;

  _hands := COALESCE(_state->'playerHands', '[]'::jsonb);
  _hand := COALESCE(_hands->_player_pos, '[]'::jsonb);
  IF _hand_index < 0 OR _hand_index >= jsonb_array_length(_hand) THEN
    RAISE EXCEPTION 'Invalid hand index';
  END IF;

  _tile := _hand->_hand_index;
  _claim_v1 := (_tile->>'value1')::int;
  _claim_v2 := (_tile->>'value2')::int;
  _is_double := (_claim_v1 = _claim_v2);

  FOR _i IN 0..jsonb_array_length(_hands)-1 LOOP
    _ph := _hands->_i;
    FOR _j IN 0..jsonb_array_length(_ph)-1 LOOP
      _t := _ph->_j;
      _v1 := (_t->>'value1')::int;
      _v2 := (_t->>'value2')::int;
      IF _v1 = _v2 AND _v1 > _highest_double THEN _highest_double := _v1; END IF;
      IF _v1 <> _v2 AND (_v1 + _v2) > _highest_single_sum THEN _highest_single_sum := _v1 + _v2; END IF;
    END LOOP;
  END LOOP;

  IF _highest_double >= 0 THEN
    _valid := _is_double AND _claim_v1 = _highest_double;
  ELSE
    _valid := (NOT _is_double) AND (_claim_v1 + _claim_v2 = _highest_single_sum);
  END IF;

  IF _valid THEN
    _state := jsonb_set(_state, '{wegaPhase}', '"playing"'::jsonb, true);
    _state := jsonb_set(_state, '{wegaStarterClaim}', jsonb_build_object('userId', _actor_uid, 'position', _player_pos, 'tile', _tile), true);
    UPDATE public.games SET game_state = _state, current_player_turn = _player_pos, updated_at = now() WHERE id = _game.id;
    PERFORM public.log_game_event(_game.id, _lobby_id, 'starter_claimed',
      jsonb_build_object('valid', true, 'tile', _tile, 'hand_index', _hand_index, 'by_bot', _actor_is_bot),
      _player_pos, _player_pos, 'playing');
    RETURN jsonb_build_object('ok', true, 'valid', true);
  END IF;

  IF NOT _actor_is_bot AND _actor_uid IS NOT NULL THEN
    FOR _other_pos IN 0..jsonb_array_length(_hands)-1 LOOP
      IF _other_pos <> _player_pos THEN
        SELECT user_id::uuid INTO _other_user FROM public.lobby_players
          WHERE lobby_id = _lobby_id AND player_position = _other_pos AND COALESCE(is_bot, false) = false
          LIMIT 1;
        IF _other_user IS NOT NULL THEN
          PERFORM public.transfer_coins(_actor_uid, _other_user, _stake);
        END IF;
      END IF;
    END LOOP;
  END IF;

  _state := jsonb_set(_state, '{wegaPhase}', '"ended"'::jsonb, true);
  _state := jsonb_set(_state, '{isGameOver}', 'true'::jsonb, true);
  _state := jsonb_set(_state, '{gameEndReason}', '"false_starter_claim"'::jsonb, true);
  _state := jsonb_set(_state, '{wegaPenaltyClaimer}', to_jsonb(_player_pos), true);
  UPDATE public.games SET game_state = _state, status = 'finished', updated_at = now() WHERE id = _game.id;

  PERFORM public.log_game_event(_game.id, _lobby_id, 'starter_claimed',
    jsonb_build_object('valid', false, 'tile', _tile, 'hand_index', _hand_index, 'penalty', CASE WHEN _actor_is_bot THEN 0 ELSE _stake END, 'by_bot', _actor_is_bot),
    _player_pos, _player_pos, 'ended');

  RETURN jsonb_build_object('ok', true, 'valid', false, 'penalty', CASE WHEN _actor_is_bot THEN 0 ELSE _stake END);
END;
$$;

CREATE OR REPLACE FUNCTION public.wega_submit_move(_lobby_id uuid, _hand_index integer, _x integer, _y integer, _orientation text, _flipped boolean, _actor_position integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  _game record;
  _lobby record;
  _state jsonb;
  _hands jsonb;
  _hand jsonb;
  _tile jsonb;
  _player_pos int;
  _actor_uid uuid;
  _actor_is_bot boolean;
  _stake int;
  _v1 int; _v2 int;
  _pip1 int; _pip2 int;
  _cell_keys text[];
  _board jsonb;
  _dominoes jsonb;
  _domino_id text;
  _next_id int;
  _new_state jsonb;
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
  SELECT a.actor_pos, a.actor_uid, a.actor_is_bot
    INTO _player_pos, _actor_uid, _actor_is_bot
    FROM public._wega_resolve_actor(_lobby_id, _actor_position) a;

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
    IF NOT _actor_is_bot AND _actor_uid IS NOT NULL THEN
      FOR _other_pos IN 0..jsonb_array_length(COALESCE(_state->'playerHands','[]'::jsonb))-1 LOOP
        IF _other_pos <> _player_pos THEN
          SELECT user_id::uuid INTO _other_user FROM public.lobby_players
            WHERE lobby_id = _lobby_id AND player_position = _other_pos AND COALESCE(is_bot,false)=false LIMIT 1;
          IF _other_user IS NOT NULL THEN
            PERFORM public.transfer_coins(_actor_uid, _other_user, _stake);
          END IF;
        END IF;
      END LOOP;
    END IF;
    PERFORM public.log_game_event(_game.id, _lobby_id, 'move_rejected',
      jsonb_build_object('reason','not_your_turn','attempted',jsonb_build_object('hand_index',_hand_index,'x',_x,'y',_y,'orientation',_orientation,'flipped',_flipped),'penalty', CASE WHEN _actor_is_bot THEN 0 ELSE _stake END, 'by_bot', _actor_is_bot),
      _player_pos, _game.current_player_turn, _state->>'wegaPhase');
    RETURN jsonb_build_object('ok', false, 'penalty', CASE WHEN _actor_is_bot THEN 0 ELSE _stake END, 'reason', 'not_your_turn');
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
    IF NOT _actor_is_bot AND _actor_uid IS NOT NULL THEN
      FOR _other_pos IN 0..jsonb_array_length(_hands)-1 LOOP
        IF _other_pos <> _player_pos THEN
          SELECT user_id::uuid INTO _other_user FROM public.lobby_players
            WHERE lobby_id = _lobby_id AND player_position = _other_pos AND COALESCE(is_bot,false)=false LIMIT 1;
          IF _other_user IS NOT NULL THEN
            PERFORM public.transfer_coins(_actor_uid, _other_user, _stake);
          END IF;
        END IF;
      END LOOP;
    END IF;
    PERFORM public.log_game_event(_game.id, _lobby_id, 'move_rejected',
      jsonb_build_object('reason','cell_occupied','tile',_tile,'x',_x,'y',_y,'orientation',_orientation,'flipped',_flipped,'penalty', CASE WHEN _actor_is_bot THEN 0 ELSE _stake END, 'by_bot', _actor_is_bot),
      _player_pos, _game.current_player_turn, _state->>'wegaPhase');
    RETURN jsonb_build_object('ok', false, 'penalty', CASE WHEN _actor_is_bot THEN 0 ELSE _stake END, 'reason', 'cell_occupied');
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
    IF NOT _actor_is_bot AND _actor_uid IS NOT NULL THEN
      FOR _other_pos IN 0..jsonb_array_length(_hands)-1 LOOP
        IF _other_pos <> _player_pos THEN
          SELECT user_id::uuid INTO _other_user FROM public.lobby_players
            WHERE lobby_id = _lobby_id AND player_position = _other_pos AND COALESCE(is_bot,false)=false LIMIT 1;
          IF _other_user IS NOT NULL THEN
            PERFORM public.transfer_coins(_actor_uid, _other_user, _stake);
          END IF;
        END IF;
      END LOOP;
    END IF;
    PERFORM public.log_game_event(_game.id, _lobby_id, 'move_rejected',
      jsonb_build_object('reason', CASE WHEN _adj_mismatch THEN 'illegal_adjacency' ELSE 'no_matching_end' END,
                         'tile',_tile,'x',_x,'y',_y,'orientation',_orientation,'flipped',_flipped,'penalty', CASE WHEN _actor_is_bot THEN 0 ELSE _stake END, 'by_bot', _actor_is_bot),
      _player_pos, _game.current_player_turn, _state->>'wegaPhase');
    RETURN jsonb_build_object('ok', false, 'penalty', CASE WHEN _actor_is_bot THEN 0 ELSE _stake END, 'reason', CASE WHEN _adj_mismatch THEN 'illegal_adjacency' ELSE 'no_matching_end' END);
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
  _new_state := jsonb_set(_new_state, '{lastPlacerUserId}', to_jsonb(COALESCE(_actor_uid::text, '')), true);
  _new_state := jsonb_set(_new_state, '{openingPlacements}', to_jsonb(COALESCE((_state->>'openingPlacements')::int,0)+1), true);
  _new_state := jsonb_set(_new_state, '{consecutivePasses}', to_jsonb(0), true);

  PERFORM public.log_game_event(_game.id, _lobby_id, 'move_submitted',
    jsonb_build_object('tile',_tile,'x',_x,'y',_y,'orientation',_orientation,'flipped',_flipped,
                       'hand_index',_hand_index,'hand_after',_new_hand,'domino_id',_domino_id,
                       'next_turn',_next_turn,'by_bot', _actor_is_bot),
    _player_pos, _player_pos, _new_state->>'wegaPhase');

  IF jsonb_array_length(_new_hand) = 0 THEN
    SELECT COUNT(*), COUNT(DISTINCT tvalue)
      INTO _tail_count, _tail_distinct_values
      FROM public._wega_tail_values(_board);
    _changa := (_tail_count >= 2 AND _tail_distinct_values = 1);

    PERFORM public._wega_finalize_game(_game.id, _lobby_id, _new_state, _player_pos,
      CASE WHEN _changa THEN 'changa' ELSE 'normal' END,
      CASE WHEN _changa THEN 2 ELSE 1 END);
    RETURN jsonb_build_object('ok', true, 'win', true, 'changa', _changa);
  END IF;

  UPDATE public.games SET game_state = _new_state, current_player_turn = _next_turn, updated_at = now() WHERE id = _game.id;
  RETURN jsonb_build_object('ok', true, 'win', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.wega_pass(_lobby_id uuid, _actor_position integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  _game record;
  _lobby record;
  _state jsonb;
  _hands jsonb;
  _player_pos int;
  _actor_uid uuid;
  _actor_is_bot boolean;
  _stake int;
  _last_placer uuid;
  _last_placer_pos int;
  _other_user uuid;
  _other_pos int;
  _next_turn int;
  _player_count int;
  _new_state jsonb;
  _opening int;
  _bonus boolean := false;
  _consecutive_passes int;
  _penalty int := 0;
BEGIN
  SELECT a.actor_pos, a.actor_uid, a.actor_is_bot
    INTO _player_pos, _actor_uid, _actor_is_bot
    FROM public._wega_resolve_actor(_lobby_id, _actor_position) a;

  SELECT * INTO _lobby FROM public.lobbies WHERE id = _lobby_id;
  _stake := COALESCE(_lobby.wega_stake, 10);

  SELECT * INTO _game FROM public.games WHERE lobby_id = _lobby_id ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF _game IS NULL THEN RAISE EXCEPTION 'Game not found'; END IF;

  _state := COALESCE(_game.game_state, '{}'::jsonb);
  IF COALESCE(_state->>'wegaPhase','') <> 'playing' THEN
    RAISE EXCEPTION 'Not in playing phase';
  END IF;
  IF _game.current_player_turn <> _player_pos THEN
    RAISE EXCEPTION 'Not your turn';
  END IF;

  _hands := COALESCE(_state->'playerHands','[]'::jsonb);
  _player_count := jsonb_array_length(_hands);
  _opening := COALESCE((_state->>'openingPlacements')::int, 0);

  IF NOT _actor_is_bot AND _actor_uid IS NOT NULL THEN
    IF _state ? 'lastPlacerUserId' AND (_state->>'lastPlacerUserId') IS NOT NULL AND (_state->>'lastPlacerUserId') <> '' THEN
      _last_placer := (_state->>'lastPlacerUserId')::uuid;
      _last_placer_pos := COALESCE((_state->>'lastPlacerPosition')::int, -1);
      IF _opening = 1 THEN _bonus := true; END IF;
      _penalty := _stake * CASE WHEN _bonus THEN 2 ELSE 1 END;
      PERFORM public.transfer_coins(_actor_uid, _last_placer, _penalty);
    ELSE
      _penalty := _stake;
      FOR _other_pos IN 0..jsonb_array_length(_hands)-1 LOOP
        IF _other_pos <> _player_pos THEN
          SELECT user_id::uuid INTO _other_user FROM public.lobby_players
            WHERE lobby_id = _lobby_id AND player_position = _other_pos AND COALESCE(is_bot,false)=false LIMIT 1;
          IF _other_user IS NOT NULL THEN
            PERFORM public.transfer_coins(_actor_uid, _other_user, _stake);
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  _consecutive_passes := COALESCE((_state->>'consecutivePasses')::int, 0) + 1;

  _new_state := _state;
  _new_state := jsonb_set(_new_state, '{consecutivePasses}', to_jsonb(_consecutive_passes), true);

  PERFORM public.log_game_event(_game.id, _lobby_id, 'pass',
    jsonb_build_object('penalty', _penalty,
                       'bonus', _bonus,
                       'last_placer_position', _last_placer_pos,
                       'consecutive_passes', _consecutive_passes,
                       'by_bot', _actor_is_bot),
    _player_pos, _player_pos, _state->>'wegaPhase');

  IF _consecutive_passes >= _player_count THEN
    DECLARE
      _i int;
      _ph jsonb;
      _t jsonb;
      _sum int;
      _min_sum int := 999999;
      _winner_pos int := -1;
      _j int;
    BEGIN
      FOR _i IN 0..jsonb_array_length(_hands)-1 LOOP
        _ph := _hands->_i;
        _sum := 0;
        FOR _j IN 0..jsonb_array_length(_ph)-1 LOOP
          _t := _ph->_j;
          _sum := _sum + (_t->>'value1')::int + (_t->>'value2')::int;
        END LOOP;
        IF _sum < _min_sum THEN _min_sum := _sum; _winner_pos := _i; END IF;
      END LOOP;
      PERFORM public._wega_finalize_game(_game.id, _lobby_id, _new_state, _winner_pos, 'blocked', 1);
      RETURN jsonb_build_object('ok', true, 'blocked', true, 'winner_position', _winner_pos);
    END;
  END IF;

  _next_turn := (_player_pos + 1) % _player_count;
  UPDATE public.games SET game_state = _new_state, current_player_turn = _next_turn, updated_at = now() WHERE id = _game.id;

  RETURN jsonb_build_object('ok', true, 'penalty', _penalty, 'bonus', _bonus);
END;
$$;