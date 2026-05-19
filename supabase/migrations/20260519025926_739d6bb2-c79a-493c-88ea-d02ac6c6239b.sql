
CREATE OR REPLACE FUNCTION public.get_co_player_glove_skins(p_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  selected_glove_skin_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.selected_glove_skin_id
  FROM public.profiles p
  WHERE p.user_id = ANY(p_user_ids)
    AND (
      p.user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.lobby_players lp_me
        JOIN public.lobby_players lp_other
          ON lp_other.lobby_id = lp_me.lobby_id
        WHERE lp_me.user_id = (auth.uid())::text
          AND lp_other.user_id = (p.user_id)::text
      )
    );
$$;
GRANT EXECUTE ON FUNCTION public.get_co_player_glove_skins(uuid[]) TO authenticated;
