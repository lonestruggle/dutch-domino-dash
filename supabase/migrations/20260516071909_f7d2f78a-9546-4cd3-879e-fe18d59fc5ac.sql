
-- Wega di sen Fase B: RPC's voor gelijktijdig trekken en startsteen claim

-- Helper: tel hoeveel stenen elke speler heeft in wega game_state
CREATE OR REPLACE FUNCTION public.wega_claim_boneyard_tile(_lobby_id uuid, _tile_index integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _game record;
  _state jsonb;
  _boneyard jsonb;
  _hands jsonb;
  _tile jsonb;
  _player_pos int;
  _hand jsonb;
  _hand_len int;
  _all_full boolean := true;
  _i int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- speler positie
  SELECT player_position INTO _player_pos
  FROM public.lobby_players
  WHERE lobby_id = _lobby_id AND user_id = (auth.uid())::text
  LIMIT 1;
  IF _player_pos IS NULL THEN RAISE EXCEPTION 'Not in lobby'; END IF;

  -- lock game row
  SELECT * INTO _game FROM public.games WHERE lobby_id = _lobby_id
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF _game IS NULL THEN RAISE EXCEPTION 'Game not found'; END IF;

  _state := COALESCE(_game.game_state, '{}'::jsonb);
  IF COALESCE(_state->>'wegaPhase', '') <> 'drawing' THEN
    RAISE EXCEPTION 'Not in drawing phase';
  END IF;

  _boneyard := COALESCE(_state->'boneyard', '[]'::jsonb);
  IF _tile_index < 0 OR _tile_index >= jsonb_array_length(_boneyard) THEN
    RAISE EXCEPTION 'Invalid tile index';
  END IF;

  _hands := COALESCE(_state->'playerHands', '[]'::jsonb);
  _hand := COALESCE(_hands->_player_pos, '[]'::jsonb);
  _hand_len := jsonb_array_length(_hand);
  IF _hand_len >= 5 THEN
    RAISE EXCEPTION 'Already 5 tiles';
  END IF;

  _tile := _boneyard->_tile_index;
  -- remove tile from boneyard
  _boneyard := (_boneyard - _tile_index);
  -- append to hand
  _hand := _hand || jsonb_build_array(_tile);
  _hands := jsonb_set(_hands, ARRAY[_player_pos::text], _hand, true);

  -- check if all players hebben 5
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

  RETURN jsonb_build_object('ok', true, 'all_full', _all_full);
END;
$$;

-- Claim startsteen. Als valide hoogste dubbel/steen → speler begint. Anders boete + game over.
CREATE OR REPLACE FUNCTION public.wega_claim_starter(_lobby_id uuid, _hand_index integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _game record;
  _lobby record;
  _state jsonb;
  _hands jsonb;
  _hand jsonb;
  _tile jsonb;
  _player_pos int;
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
  _claimer_user uuid;
  _other_user uuid;
  _other_pos int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT player_position INTO _player_pos
  FROM public.lobby_players
  WHERE lobby_id = _lobby_id AND user_id = (auth.uid())::text
  LIMIT 1;
  IF _player_pos IS NULL THEN RAISE EXCEPTION 'Not in lobby'; END IF;

  SELECT * INTO _lobby FROM public.lobbies WHERE id = _lobby_id;
  _stake := COALESCE(_lobby.wega_stake, 10);
  _claimer_user := auth.uid();

  SELECT * INTO _game FROM public.games WHERE lobby_id = _lobby_id
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF _game IS NULL THEN RAISE EXCEPTION 'Game not found'; END IF;

  _state := COALESCE(_game.game_state, '{}'::jsonb);
  IF COALESCE(_state->>'wegaPhase', '') <> 'claiming_starter' THEN
    RAISE EXCEPTION 'Not in claiming_starter phase';
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

  -- bepaal hoogste dubbel/steen over alle handen + boneyard rest (boneyard is leeg na drawing, maar veilig)
  FOR _i IN 0..jsonb_array_length(_hands)-1 LOOP
    _ph := _hands->_i;
    FOR _j IN 0..jsonb_array_length(_ph)-1 LOOP
      _t := _ph->_j;
      _v1 := (_t->>'value1')::int;
      _v2 := (_t->>'value2')::int;
      IF _v1 = _v2 AND _v1 > _highest_double THEN
        _highest_double := _v1;
      END IF;
      IF _v1 <> _v2 AND (_v1 + _v2) > _highest_single_sum THEN
        _highest_single_sum := _v1 + _v2;
      END IF;
    END LOOP;
  END LOOP;

  IF _highest_double >= 0 THEN
    _valid := _is_double AND _claim_v1 = _highest_double;
  ELSE
    _valid := (NOT _is_double) AND (_claim_v1 + _claim_v2 = _highest_single_sum);
  END IF;

  IF _valid THEN
    _state := jsonb_set(_state, '{wegaPhase}', '"playing"'::jsonb, true);
    _state := jsonb_set(_state, '{wegaStarterClaim}', jsonb_build_object('userId', _claimer_user, 'position', _player_pos, 'tile', _tile), true);
    UPDATE public.games SET game_state = _state, current_player_turn = _player_pos, updated_at = now() WHERE id = _game.id;
    RETURN jsonb_build_object('ok', true, 'valid', true);
  END IF;

  -- ongeldige claim → boete: stake aan elke andere menselijke speler, spel eindigt
  FOR _other_pos IN 0..jsonb_array_length(_hands)-1 LOOP
    IF _other_pos <> _player_pos THEN
      SELECT user_id::uuid INTO _other_user FROM public.lobby_players
        WHERE lobby_id = _lobby_id AND player_position = _other_pos AND COALESCE(is_bot, false) = false
        LIMIT 1;
      IF _other_user IS NOT NULL THEN
        PERFORM public.transfer_coins(_claimer_user, _other_user, _stake);
      END IF;
    END IF;
  END LOOP;

  _state := jsonb_set(_state, '{wegaPhase}', '"ended"'::jsonb, true);
  _state := jsonb_set(_state, '{isGameOver}', 'true'::jsonb, true);
  _state := jsonb_set(_state, '{gameEndReason}', '"false_starter_claim"'::jsonb, true);
  _state := jsonb_set(_state, '{wegaPenaltyClaimer}', to_jsonb(_player_pos), true);
  UPDATE public.games SET game_state = _state, status = 'finished', updated_at = now() WHERE id = _game.id;

  RETURN jsonb_build_object('ok', true, 'valid', false, 'penalty', _stake);
END;
$$;
