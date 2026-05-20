# Rollen, rechten & skin-deactivatie

## Probleem
1. Als admin lukt het niet om skins te (de)activeren of toewijzingen aan te passen.
   - **Oorzaak skin (de)activeren**: nog te bevestigen, maar waarschijnlijk RLS WITH CHECK of een Realtime/replica probleem. Ik los het op door een SECURITY DEFINER RPC `admin_set_glove_skin_active(skin_id, active)` te gebruiken die de permissie zelf controleert.
   - **Oorzaak toewijzing aan/uit**: bij uitschakelen van actieve skin probeert de code `profiles.selected_glove_skin_id` van een **andere** user te resetten. De `profiles` UPDATE policy laat alleen eigen profiel toe → fout. Fix via dezelfde SECURITY DEFINER RPC.

2. Er is nog geen centrale, door admin instelbare lijst van wat elke rol mag.

## Oplossing

### 1. Nieuwe tabel `role_permissions`
Kolommen: `role app_role`, `permission_key text`, `allowed boolean`. Uniek op (role, permission_key).

Permissies (initieel):
- `manage_glove_skins` (upload, (de)activeer, uitlijning)
- `assign_glove_skins` (skin toewijzen aan speler)
- `manage_table_backgrounds`
- `manage_app_settings`
- `manage_users` (rollen wijzigen, deactiveren)
- `view_debug_console`
- `view_boneyard_all`
- `moderate_chat`
- `manage_lobbies`

Standaard:
- **admin**: alles
- **dev**: alles behalve `manage_users`
- **moderator**: `moderate_chat`, `manage_lobbies`, `view_boneyard_all`
- **user**: niets

### 2. Helper functies (SECURITY DEFINER)
- `has_permission(_user uuid, _key text)` → bool
- `get_user_top_role(_user uuid)` → app_role (admin > dev > moderator > user) – voor "mod mag geen admin/dev aanpassen"-check.

### 3. RPC's
- `admin_set_glove_skin_active(skin_id uuid, active boolean)`
- `admin_set_user_glove_assignment(assignment_id uuid, enabled boolean)` – reset ook `profiles.selected_glove_skin_id` indien nodig.
- `admin_set_user_role(target_user uuid, new_role app_role, enabled boolean)` – moderator mag target met admin/dev rol niet wijzigen.

### 4. UI: nieuwe sectie "Rollen & rechten" in `/admin`
Alleen zichtbaar voor admins. Matrix (rijen = rol, kolommen = permissie) met checkboxes. Wijzigingen direct opgeslagen via upsert in `role_permissions`.

### 5. Frontend
- `useRolePermissions()` hook die `role_permissions` cached.
- `GloveSkinManager` schakelt over op de nieuwe RPC's.
- Knoppen verbergen/disablen op basis van `has_permission` resultaat (via een `usePermission(key)` hook die de huidige user's permissies leest).

## Bestanden
- nieuwe migratie (tabel, seed, functies, policies)
- nieuwe component `src/components/RolePermissionsMatrix.tsx`
- nieuwe hook `src/hooks/useRolePermissions.ts`
- aanpassing `src/components/GloveSkinManager.tsx` (RPC's gebruiken)
- aanpassing `src/pages/AdminDashboard.tsx` (nieuwe sectie tonen)

Akkoord? Dan begin ik met de migratie.
