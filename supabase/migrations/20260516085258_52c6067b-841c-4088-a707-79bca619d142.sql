CREATE OR REPLACE FUNCTION public.wega_claim_boneyard_tile(_lobby_id uuid, _tile_index integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  SELECT player_position INTO _player_pos
  FROM public.lobby_players
  WHERE lobby_id = _lobby_id AND user_id = (auth.uid())::text
  LIMIT 1;
  IF _player_pos IS NULL THEN RAISE EXCEPTION 'Not in lobby'; END IF;

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

  _tile := _boneyard->_tile_index;
  IF _tile IS NULL OR _tile = 'null'::jsonb THEN
    RAISE EXCEPTION 'Tile already taken';
  END IF;

  _hands := COALESCE(_state->'playerHands', '[]'::jsonb);
  _hand := COALESCE(_hands->_player_pos, '[]'::jsonb);
  _hand_len := jsonb_array_length(_hand);
  IF _hand_len >= 5 THEN
    RAISE EXCEPTION 'Already 5 tiles';
  END IF;

  -- Vervang het slot door null zodat de andere stenen op hun plek blijven liggen
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

  RETURN jsonb_build_object('ok', true, 'all_full', _all_full);
END;
$function$;