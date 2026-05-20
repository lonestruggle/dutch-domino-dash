
CREATE TABLE public.role_permissions (
  role public.app_role NOT NULL,
  permission_key text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, permission_key)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Alleen admin/dev/moderator mogen lezen (zelfde groep die admin pagina mag zien)
CREATE POLICY "Staff can read role permissions"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.is_dev(auth.uid())
    OR public.is_moderator(auth.uid())
  );

CREATE POLICY "Only admins can modify role permissions"
  ON public.role_permissions FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.role_permissions (role, permission_key, allowed) VALUES
  ('admin','manage_glove_skins', true),
  ('admin','assign_glove_skins', true),
  ('admin','manage_table_backgrounds', true),
  ('admin','manage_app_settings', true),
  ('admin','manage_users', true),
  ('admin','view_debug_console', true),
  ('admin','view_boneyard_all', true),
  ('admin','moderate_chat', true),
  ('admin','manage_lobbies', true),
  ('dev','manage_glove_skins', true),
  ('dev','assign_glove_skins', true),
  ('dev','manage_table_backgrounds', true),
  ('dev','manage_app_settings', true),
  ('dev','manage_users', false),
  ('dev','view_debug_console', true),
  ('dev','view_boneyard_all', true),
  ('dev','moderate_chat', true),
  ('dev','manage_lobbies', true),
  ('moderator','manage_glove_skins', false),
  ('moderator','assign_glove_skins', false),
  ('moderator','manage_table_backgrounds', false),
  ('moderator','manage_app_settings', false),
  ('moderator','manage_users', false),
  ('moderator','view_debug_console', false),
  ('moderator','view_boneyard_all', true),
  ('moderator','moderate_chat', true),
  ('moderator','manage_lobbies', true),
  ('user','manage_glove_skins', false),
  ('user','assign_glove_skins', false),
  ('user','manage_table_backgrounds', false),
  ('user','manage_app_settings', false),
  ('user','manage_users', false),
  ('user','view_debug_console', false),
  ('user','view_boneyard_all', false),
  ('user','moderate_chat', false),
  ('user','manage_lobbies', false);

-- has_permission is SECURITY DEFINER zodat normale users hun eigen rechten kunnen checken
-- zonder de role_permissions tabel direct te kunnen lezen.
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role = rp.role
    WHERE ur.user_id = _user_id
      AND rp.permission_key = _key
      AND rp.allowed = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_top_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'admin'::public.app_role THEN 1
    WHEN 'dev'::public.app_role THEN 2
    WHEN 'moderator'::public.app_role THEN 3
    ELSE 4 END
  LIMIT 1;
$$;

-- Een functie die alle effectieve permissies van de huidige user teruggeeft,
-- zodat de frontend ze in één keer kan ophalen zonder role_permissions te lezen.
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS TABLE(permission_key text, allowed boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT rp.permission_key, bool_or(rp.allowed) AS allowed
  FROM public.role_permissions rp
  JOIN public.user_roles ur ON ur.role = rp.role
  WHERE ur.user_id = auth.uid()
  GROUP BY rp.permission_key;
$$;

-- RPCs

CREATE OR REPLACE FUNCTION public.admin_set_glove_skin_active(_skin_id uuid, _active boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_permission(auth.uid(), 'manage_glove_skins') THEN
    RAISE EXCEPTION 'Geen rechten om skins te beheren';
  END IF;

  UPDATE public.glove_skins
    SET is_active = _active, updated_at = now()
    WHERE id = _skin_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Skin niet gevonden'; END IF;

  IF NOT _active THEN
    UPDATE public.profiles SET selected_glove_skin_id = NULL
      WHERE selected_glove_skin_id = _skin_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_glove_assignment(_assignment_id uuid, _enabled boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE _row record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_permission(auth.uid(), 'assign_glove_skins') THEN
    RAISE EXCEPTION 'Geen rechten om skin-toewijzingen te beheren';
  END IF;

  SELECT * INTO _row FROM public.user_glove_skins WHERE id = _assignment_id;
  IF _row IS NULL THEN RAISE EXCEPTION 'Toewijzing niet gevonden'; END IF;

  UPDATE public.user_glove_skins SET is_enabled = _enabled WHERE id = _assignment_id;

  IF NOT _enabled THEN
    UPDATE public.profiles
      SET selected_glove_skin_id = NULL
      WHERE user_id = _row.user_id AND selected_glove_skin_id = _row.skin_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_assign_glove_skin(_target_user uuid, _skin_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_permission(auth.uid(), 'assign_glove_skins') THEN
    RAISE EXCEPTION 'Geen rechten';
  END IF;

  INSERT INTO public.user_glove_skins (user_id, skin_id, source, is_enabled, created_by)
    VALUES (_target_user, _skin_id, 'assigned', true, auth.uid())
    ON CONFLICT (user_id, skin_id) DO UPDATE SET is_enabled = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(_target_user uuid, _role public.app_role, _enabled boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  _caller_top public.app_role;
  _target_top public.app_role;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_permission(auth.uid(), 'manage_users') THEN
    RAISE EXCEPTION 'Geen rechten om gebruikersrollen te wijzigen';
  END IF;

  _caller_top := public.get_user_top_role(auth.uid());
  _target_top := public.get_user_top_role(_target_user);

  IF _caller_top <> 'admin'::public.app_role
     AND _target_top IN ('admin'::public.app_role, 'dev'::public.app_role) THEN
    RAISE EXCEPTION 'Onvoldoende rechten voor deze gebruiker';
  END IF;

  IF _enabled THEN
    INSERT INTO public.user_roles (user_id, role, assigned_by)
      VALUES (_target_user, _role, auth.uid())
      ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _target_user AND role = _role;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_glove_skin_active(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_glove_assignment(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_glove_skin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.app_role, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_top_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated;
