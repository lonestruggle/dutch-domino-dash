-- 1) log_game_event: gebruik bij _player_position de naam uit lobby_players
CREATE OR REPLACE FUNCTION public.log_game_event(
  _game_id uuid,
  _lobby_id uuid,
  _event_type text,
  _event_data jsonb DEFAULT '{}'::jsonb,
  _player_position integer DEFAULT NULL,
  _current_turn integer DEFAULT NULL,
  _wega_phase text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  _uid uuid;
  _uname text;
  _lp_user_id text;
  _lp_username text;
  _lp_bot_name text;
  _lp_is_bot boolean;
  _id uuid;
BEGIN
  _uid := auth.uid();

  -- Probeer eerst naam/uid uit lobby_players te vinden voor de gegeven positie
  IF _lobby_id IS NOT NULL AND _player_position IS NOT NULL THEN
    SELECT lp.user_id, lp.username, lp.bot_name, COALESCE(lp.is_bot,false)
      INTO _lp_user_id, _lp_username, _lp_bot_name, _lp_is_bot
      FROM public.lobby_players lp
      WHERE lp.lobby_id = _lobby_id AND lp.player_position = _player_position
      LIMIT 1;

    IF _lp_is_bot THEN
      _uname := COALESCE(_lp_bot_name, _lp_username, 'Bot');
      -- bots hebben geen auth user; user_id veld in logs blijft de host (auth.uid)
    ELSIF _lp_username IS NOT NULL THEN
      _uname := _lp_username;
      -- als de positie matcht met een menselijke speler, gebruik diens uid
      BEGIN
        _uid := NULLIF(_lp_user_id,'')::uuid;
      EXCEPTION WHEN OTHERS THEN
        -- houd _uid op auth.uid()
      END;
    END IF;
  END IF;

  -- Fallback: profielnaam van de ingelogde gebruiker
  IF _uname IS NULL AND _uid IS NOT NULL THEN
    SELECT username INTO _uname FROM public.profiles WHERE user_id = _uid LIMIT 1;
  END IF;

  INSERT INTO public.game_logs (
    game_id, lobby_id, player_position, user_id, username,
    event_type, event_data, current_turn, wega_phase
  ) VALUES (
    _game_id, _lobby_id, _player_position, _uid, _uname,
    _event_type, COALESCE(_event_data,'{}'::jsonb), _current_turn, _wega_phase
  )
  RETURNING id INTO _id;

  RETURN _id;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$function$;

-- 2) wega_pass: schrijf lastPasserPosition + lastPasserAt in game_state zodat
--    clients exact weten wie er net heeft gepast (geen prevRef-races meer).
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
  _new_state := jsonb_set(_new_state, '{lastPasserPosition}', to_jsonb(_player_pos), true);
  _new_state := jsonb_set(_new_state, '{lastPasserAt}', to_jsonb(extract(epoch from now()) * 1000), true);

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

  RETURN jsonb_build_object('ok', true, 'penalty', _penalty, 'bonus', _bonus, 'passer_position', _player_pos);
END;
$$;