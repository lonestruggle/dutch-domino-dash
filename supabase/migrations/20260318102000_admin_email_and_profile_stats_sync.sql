BEGIN;

-- Ensure admin UI can execute the existing email lookup RPC.
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO authenticated;

-- Recalculate profile counters from authoritative per-game stats.
CREATE OR REPLACE FUNCTION public.recalculate_profile_game_stats(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  _games_played integer := 0;
  _games_won integer := 0;
BEGIN
  IF _user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COUNT(DISTINCT gps.game_id)::integer,
    COUNT(*) FILTER (WHERE gps.won)::integer
  INTO _games_played, _games_won
  FROM public.game_player_stats gps
  WHERE gps.user_id = _user_id;

  UPDATE public.profiles p
  SET
    games_played = COALESCE(_games_played, 0),
    games_won = COALESCE(_games_won, 0),
    updated_at = NOW()
  WHERE p.user_id = _user_id;
END;
$function$;

-- Keep profile counters synced on every stats row mutation.
CREATE OR REPLACE FUNCTION public.sync_profile_game_stats_from_rows()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalculate_profile_game_stats(NEW.user_id);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      PERFORM public.recalculate_profile_game_stats(OLD.user_id);
    END IF;
    PERFORM public.recalculate_profile_game_stats(NEW.user_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_profile_game_stats(OLD.user_id);
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_profile_game_stats ON public.game_player_stats;

CREATE TRIGGER trg_sync_profile_game_stats
AFTER INSERT OR UPDATE OR DELETE ON public.game_player_stats
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_game_stats_from_rows();

-- One-time backfill so existing users immediately get correct totals.
UPDATE public.profiles p
SET
  games_played = COALESCE(s.games_played, 0),
  games_won = COALESCE(s.games_won, 0),
  updated_at = NOW()
FROM (
  SELECT
    gps.user_id,
    COUNT(DISTINCT gps.game_id)::integer AS games_played,
    COUNT(*) FILTER (WHERE gps.won)::integer AS games_won
  FROM public.game_player_stats gps
  GROUP BY gps.user_id
) s
WHERE p.user_id = s.user_id;

UPDATE public.profiles p
SET
  games_played = 0,
  games_won = 0,
  updated_at = NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM public.game_player_stats gps
  WHERE gps.user_id = p.user_id
);

COMMIT;
