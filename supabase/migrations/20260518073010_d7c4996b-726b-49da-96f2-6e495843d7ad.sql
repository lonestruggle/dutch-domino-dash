
-- 1. Bot claim chance setting
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES ('wega_bot_claim_chance', '0.95'::jsonb, 'Kans (0-1) dat een bot een Wega claim succesvol uitvoert. 1 = altijd, 0 = nooit.')
ON CONFLICT (setting_key) DO NOTHING;

-- 2. Helper: bouw claim-sequence uit alle handen
CREATE OR REPLACE FUNCTION public._wega_build_claim_sequence(_hands jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO ''
AS $$
DECLARE
  _i int;
  _j int;
  _ph jsonb;
  _t jsonb;
  _v1 int;
  _v2 int;
  _doubles jsonb := '[]'::jsonb;
  _singles jsonb := '[]'::jsonb;
  _result jsonb := '[]'::jsonb;
  _val int;
  _sum int;
  _hi int;
BEGIN
  FOR _i IN 0..jsonb_array_length(_hands)-1 LOOP
    _ph := _hands->_i;
    IF _ph IS NULL THEN CONTINUE; END IF;
    FOR _j IN 0..jsonb_array_length(_ph)-1 LOOP
      _t := _ph->_j;
      _v1 := (_t->>'value1')::int;
      _v2 := (_t->>'value2')::int;
      IF _v1 = _v2 THEN
        _doubles := _doubles || jsonb_build_array(jsonb_build_object('value1',_v1,'value2',_v2));
      ELSE
        _singles := _singles || jsonb_build_array(jsonb_build_object('value1', GREATEST(_v1,_v2), 'value2', LEAST(_v1,_v2)));
      END IF;
    END LOOP;
  END LOOP;

  -- doubles desc by value
  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'value1')::int DESC), '[]'::jsonb)
    INTO _doubles
    FROM jsonb_array_elements(_doubles) t;
  -- singles desc by sum, then by high pip
  SELECT COALESCE(jsonb_agg(t ORDER BY ((t->>'value1')::int + (t->>'value2')::int) DESC, (t->>'value1')::int DESC, (t->>'value2')::int DESC), '[]'::jsonb)
    INTO _singles
    FROM jsonb_array_elements(_singles) t;

  _result := _doubles || _singles;
  RETURN _result;
END;
$$;

-- 3. Update wega_claim_boneyard_tile to seed claim sequence on transition
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
  _seq jsonb;
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
    _seq := public._wega_build_claim_sequence(_hands);
    _state := jsonb_set(_state, '{wegaPhase}', '"claiming_starter"'::jsonb, true);
    _state := jsonb_set(_state, '{wegaClaimSequence}', _seq, true);
    _state := jsonb_set(_state, '{wegaClaimIndex}', '0'::jsonb, true);
    _state := jsonb_set(_state, '{wegaClaimStartedAt}', to_jsonb(extract(epoch from now()) * 1000), true);
    _state := jsonb_set(_state, '{wegaClaimMissed}', '[]'::jsonb, true);
  END IF;

  UPDATE public.games SET game_state = _state, updated_at = now() WHERE id = _game.id;

  PERFORM public.log_game_event(_game.id, _lobby_id, 'boneyard_claimed',
    jsonb_build_object('tile_index', _tile_index, 'tile', _tile, 'hand_size_after', _hand_len + 1, 'all_full', _all_full, 'by_bot', _actor_is_bot),
    _player_pos, _game.current_player_turn, _state->>'wegaPhase');

  RETURN jsonb_build_object('ok', true, 'all_full', _all_full);
END;
$$;

-- 4. wega_advance_claim: host-driven timeout step
CREATE OR REPLACE FUNCTION public.wega_advance_claim(_lobby_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  _caller uuid;
  _game record;
  _state jsonb;
  _idx int;
  _seq jsonb;
  _started_ms bigint;
  _now_ms bigint;
  _current_tile jsonb;
  _hands jsonb;
  _i int;
  _j int;
  _ph jsonb;
  _t jsonb;
  _owner_pos int := -1;
  _missed jsonb;
BEGIN
  _caller := auth.uid();
  IF _caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lobby_players WHERE lobby_id = _lobby_id AND user_id = _caller::text) THEN
    RAISE EXCEPTION 'Not in lobby';
  END IF;

  SELECT * INTO _game FROM public.games WHERE lobby_id = _lobby_id ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF _game IS NULL THEN RAISE EXCEPTION 'Game not found'; END IF;
  _state := COALESCE(_game.game_state, '{}'::jsonb);
  IF COALESCE(_state->>'wegaPhase','') <> 'claiming_starter' THEN
    RETURN jsonb_build_object('ok', false, 'reason','not_claiming');
  END IF;

  _started_ms := COALESCE((_state->>'wegaClaimStartedAt')::bigint, 0);
  _now_ms := (extract(epoch from now()) * 1000)::bigint;
  IF _now_ms - _started_ms < 3000 THEN
    RETURN jsonb_build_object('ok', false, 'reason','too_soon', 'elapsed_ms', _now_ms - _started_ms);
  END IF;

  _seq := COALESCE(_state->'wegaClaimSequence', '[]'::jsonb);
  _idx := COALESCE((_state->>'wegaClaimIndex')::int, 0);
  IF _idx >= jsonb_array_length(_seq) THEN
    RETURN jsonb_build_object('ok', false, 'reason','sequence_exhausted');
  END IF;

  _current_tile := _seq->_idx;
  _hands := COALESCE(_state->'playerHands', '[]'::jsonb);
  -- find owner of current tile
  FOR _i IN 0..jsonb_array_length(_hands)-1 LOOP
    _ph := _hands->_i;
    FOR _j IN 0..jsonb_array_length(_ph)-1 LOOP
      _t := _ph->_j;
      IF (_t->>'value1')::int = (_current_tile->>'value1')::int AND (_t->>'value2')::int = (_current_tile->>'value2')::int THEN
        _owner_pos := _i;
        EXIT;
      END IF;
      IF (_t->>'value1')::int = (_current_tile->>'value2')::int AND (_t->>'value2')::int = (_current_tile->>'value1')::int THEN
        _owner_pos := _i;
        EXIT;
      END IF;
    END LOOP;
    IF _owner_pos >= 0 THEN EXIT; END IF;
  END LOOP;

  _missed := COALESCE(_state->'wegaClaimMissed', '[]'::jsonb);
  IF _owner_pos >= 0 THEN
    _missed := _missed || jsonb_build_array(jsonb_build_object('position', _owner_pos, 'tile', _current_tile, 'expired_at', _now_ms));
  END IF;

  _state := jsonb_set(_state, '{wegaClaimMissed}', _missed, true);
  _state := jsonb_set(_state, '{wegaClaimIndex}', to_jsonb(_idx + 1), true);
  _state := jsonb_set(_state, '{wegaClaimStartedAt}', to_jsonb(_now_ms), true);

  UPDATE public.games SET game_state = _state, updated_at = now() WHERE id = _game.id;

  PERFORM public.log_game_event(_game.id, _lobby_id, 'wega_claim_advanced',
    jsonb_build_object('skipped_tile', _current_tile, 'index', _idx, 'owner_pos', _owner_pos),
    NULL, _game.current_player_turn, 'claiming_starter');

  RETURN jsonb_build_object('ok', true, 'new_index', _idx + 1, 'skipped_owner', _owner_pos);
END;
$$;

-- 5. wega_claim_current: claim the currently-shown tile
CREATE OR REPLACE FUNCTION public.wega_claim_current(_lobby_id uuid, _actor_position integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  _game record;
  _lobby record;
  _state jsonb;
  _player_pos int;
  _actor_uid uuid;
  _actor_is_bot boolean;
  _stake int;
  _seq jsonb;
  _idx int;
  _current_tile jsonb;
  _hands jsonb;
  _hand jsonb;
  _has_tile boolean := false;
  _hand_index int := -1;
  _j int;
  _t jsonb;
  _missed jsonb;
  _verzuimer_pos int;
  _verzuimer_tile jsonb;
  _verzuimer_uid uuid;
  _verzuimer_username text;
  _other_user uuid;
  _other_pos int;
  _player_count int;
BEGIN
  SELECT a.actor_pos, a.actor_uid, a.actor_is_bot
    INTO _player_pos, _actor_uid, _actor_is_bot
    FROM public._wega_resolve_actor(_lobby_id, _actor_position) a;

  SELECT * INTO _lobby FROM public.lobbies WHERE id = _lobby_id;
  _stake := COALESCE(_lobby.wega_stake, 10);

  SELECT * INTO _game FROM public.games WHERE lobby_id = _lobby_id ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF _game IS NULL THEN RAISE EXCEPTION 'Game not found'; END IF;

  _state := COALESCE(_game.game_state, '{}'::jsonb);
  IF COALESCE(_state->>'wegaPhase','') <> 'claiming_starter' THEN
    RAISE EXCEPTION 'Not in claiming_starter phase (current: %)', COALESCE(_state->>'wegaPhase','null');
  END IF;

  _seq := COALESCE(_state->'wegaClaimSequence', '[]'::jsonb);
  _idx := COALESCE((_state->>'wegaClaimIndex')::int, 0);
  IF _idx >= jsonb_array_length(_seq) THEN
    RAISE EXCEPTION 'Claim sequence exhausted';
  END IF;
  _current_tile := _seq->_idx;

  _hands := COALESCE(_state->'playerHands', '[]'::jsonb);
  _hand := COALESCE(_hands->_player_pos, '[]'::jsonb);
  FOR _j IN 0..jsonb_array_length(_hand)-1 LOOP
    _t := _hand->_j;
    IF ((_t->>'value1')::int = (_current_tile->>'value1')::int AND (_t->>'value2')::int = (_current_tile->>'value2')::int)
       OR ((_t->>'value1')::int = (_current_tile->>'value2')::int AND (_t->>'value2')::int = (_current_tile->>'value1')::int) THEN
      _has_tile := true;
      _hand_index := _j;
      EXIT;
    END IF;
  END LOOP;

  IF NOT _has_tile THEN
    PERFORM public.log_game_event(_game.id, _lobby_id, 'wega_claim_rejected',
      jsonb_build_object('reason','dont_have_tile','tile', _current_tile, 'by_bot', _actor_is_bot),
      _player_pos, _game.current_player_turn, 'claiming_starter');
    RAISE EXCEPTION 'Je hebt deze steen niet in je hand';
  END IF;

  _missed := COALESCE(_state->'wegaClaimMissed', '[]'::jsonb);

  -- BLOCKED GAME path: an earlier player missed
  IF jsonb_array_length(_missed) > 0 THEN
    _verzuimer_pos := ((_missed->0)->>'position')::int;
    _verzuimer_tile := (_missed->0)->'tile';

    SELECT lp.user_id::uuid, COALESCE(lp.username, lp.bot_name, 'Speler')
      INTO _verzuimer_uid, _verzuimer_username
      FROM public.lobby_players lp
      WHERE lp.lobby_id = _lobby_id AND lp.player_position = _verzuimer_pos
      LIMIT 1;

    -- Penalty: verzuimer pays stake to every other human player
    IF _verzuimer_uid IS NOT NULL THEN
      _player_count := jsonb_array_length(_hands);
      FOR _other_pos IN 0.._player_count-1 LOOP
        IF _other_pos <> _verzuimer_pos THEN
          SELECT user_id::uuid INTO _other_user FROM public.lobby_players
            WHERE lobby_id = _lobby_id AND player_position = _other_pos AND COALESCE(is_bot,false) = false
            LIMIT 1;
          IF _other_user IS NOT NULL THEN
            -- Only transfer if verzuimer is human (bot has no balance)
            IF EXISTS (SELECT 1 FROM public.lobby_players WHERE lobby_id = _lobby_id AND player_position = _verzuimer_pos AND COALESCE(is_bot,false) = false) THEN
              PERFORM public.transfer_coins(_verzuimer_uid, _other_user, _stake);
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;

    _state := jsonb_set(_state, '{wegaPhase}', '"ended"'::jsonb, true);
    _state := jsonb_set(_state, '{isGameOver}', 'true'::jsonb, true);
    _state := jsonb_set(_state, '{gameEndReason}', '"claim_verzuim"'::jsonb, true);
    _state := jsonb_set(_state, '{wegaVerzuimer}', jsonb_build_object(
      'position', _verzuimer_pos,
      'username', _verzuimer_username,
      'tile', _verzuimer_tile,
      'claimedBy', _player_pos,
      'claimedTile', _current_tile,
      'penalty', _stake
    ), true);

    UPDATE public.games SET game_state = _state, status = 'finished', updated_at = now() WHERE id = _game.id;

    PERFORM public.log_game_event(_game.id, _lobby_id, 'wega_blocked_verzuim',
      jsonb_build_object('verzuimer_pos', _verzuimer_pos, 'missed_tile', _verzuimer_tile,
                         'claimer_pos', _player_pos, 'claimed_tile', _current_tile, 'penalty', _stake),
      _player_pos, _player_pos, 'ended');

    RETURN jsonb_build_object('ok', true, 'blocked', true, 'verzuimer_pos', _verzuimer_pos);
  END IF;

  -- Normal claim: this player starts
  _state := jsonb_set(_state, '{wegaPhase}', '"playing"'::jsonb, true);
  _state := jsonb_set(_state, '{wegaStarterClaim}', jsonb_build_object(
    'userId', _actor_uid, 'position', _player_pos, 'tile', _current_tile, 'handIndex', _hand_index
  ), true);
  UPDATE public.games SET game_state = _state, current_player_turn = _player_pos, updated_at = now() WHERE id = _game.id;

  PERFORM public.log_game_event(_game.id, _lobby_id, 'wega_claim_success',
    jsonb_build_object('tile', _current_tile, 'hand_index', _hand_index, 'by_bot', _actor_is_bot),
    _player_pos, _player_pos, 'playing');

  RETURN jsonb_build_object('ok', true, 'blocked', false, 'hand_index', _hand_index);
END;
$$;
