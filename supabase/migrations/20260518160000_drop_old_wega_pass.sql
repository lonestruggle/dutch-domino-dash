-- Drop old single-arg overload to resolve ambiguity with the newer (_lobby_id, _actor_position) version
DROP FUNCTION IF EXISTS public.wega_pass(uuid);
