## Game Debug Logs

Doel: per spel een gedetailleerde event-log bijhouden, zichtbaar in de Admin Dashboard, zodat je precies kunt nalopen waar iets misgaat.

### 1. Database

Nieuwe tabel `public.game_logs`:

| kolom | type | doel |
|---|---|---|
| id | uuid pk | |
| game_id | uuid | koppeling aan `games.id` |
| lobby_id | uuid | snel filteren per lobby |
| player_position | int null | wie de actie deed (null = systeem) |
| user_id | uuid null | wie de actie deed |
| username | text null | snapshot voor leesbaarheid |
| event_type | text | zie hieronder |
| event_data | jsonb | payload (zet, hand, board snapshot, etc.) |
| current_turn | int null | wiens beurt het was |
| wega_phase | text null | drawing/claiming_starter/playing/ended |
| created_at | timestamptz | |

RLS:
- INSERT: elke speler in de lobby (en service role)
- SELECT: alleen admin/moderator (via `can_moderate`)

Index op `(game_id, created_at)` en `(lobby_id, created_at)`.

### 2. Event-types die we loggen

**Lifecycle**
- `game_started` — aantal spelers, mode, stake, starthand per positie, boneyard size
- `game_ended` — reden (changa/normal/blocked/false_starter_claim), winner_position, eindhanden, pip-totalen

**Beurten / zetten**
- `tile_selected` (client, alleen lokale speler) — welke hand-index/steen geselecteerd
- `move_submitted` — hand_index, tile, x, y, orientation, flipped, resulterende open ends
- `move_rejected` — reden (not_your_turn, cell_occupied, no_matching_end, illegal_adjacency) + boete
- `tile_drawn` — getrokken steen (klassiek) of boneyard claim (wega)
- `pass` — boete, openingsbonus ja/nee, lastPlacer
- `turn_changed` — van → naar positie

**Wega specifiek**
- `starter_claimed` — tile, geldig of niet, eventuele boete
- `boneyard_claimed` — tile_index, tile, hand-size na

**Coins / settle**
- `coin_transfer` — from, to, amount, reden

**Debug helpers (extra die het naloopbaar maken)**
- `state_snapshot` — periodieke / on-demand volledige `game_state` dump (zware payload, alleen op key events)
- `client_error` — frontend exceptions tijdens spel
- `hand_sync_mismatch` — als client een handlengte ziet die niet matcht met server (handig voor de "kan niet leggen"-bugs)

### 3. Server-side hooks

Logging-helper `_log_game_event(_game_id, _lobby_id, _user_id, _player_pos, _event_type, _event_data, _state)` toevoegen en aanroepen in:
- `wega_submit_move` (succes + alle rejection-paden)
- `wega_pass`
- `wega_claim_starter`
- `wega_claim_boneyard_tile`
- `_wega_finalize_game` → `game_ended`
- `update_game_state_for_lobby` → optioneel `state_changed`

Voor klassieke modus: client logt `move_submitted`/`tile_drawn` direct, plus `state_snapshot` na elke server-update.

### 4. Client-side hooks

In `Game.tsx` / `useDominoGame` / `useSyncedDominoGame`:
- Bij selecteren steen → `tile_selected`
- Bij plaatsing/draw → ook clientzijde event (klassiek)
- Bij elke `setGameState` met `gameStarted` true en nieuwe `dominoes`-count → `state_snapshot` (throttle 1x per beurt)
- Window `onerror` / React errorboundary → `client_error`

Lichte util `logGameEvent(gameId, type, data)` die naar tabel `game_logs` inserts doet via supabase-js. Faalt stil zodat het nooit gameplay breekt.

### 5. Admin UI

Nieuwe sectie in `AdminDashboard.tsx`: **Game Logs**
- Lijst van recente games (laatste 50) uit `games` + lobby-naam + status + winner
- Klik op game → drawer/dialog met:
  - Metadata (mode, stake, spelers, start/eind, duur)
  - Filter: event_type (multi-select), player
  - Timeline van events (compact, timestamp · type · speler · samenvatting)
  - Klik event → JSON-detail (event_data + state_snapshot)
- Knop "Exporteer JSON" voor 1 game
- Auto-refresh elke 5s (realtime channel optioneel)

### 6. Wat we nog meer kunnen vastleggen

Extra ideeën om debug rijker te maken:
- **Latency**: client-timestamp + server-receive timestamp diff per event → opsporen van trage updates / dubbele clicks
- **Device info** bij eerste log per sessie: userAgent, viewport, devicePixelRatio, isMobile
- **Network status**: online/offline transities, supabase realtime reconnects
- **Hand-hash per beurt**: sha van speler-hand → snel zien of clients out-of-sync raken
- **Open-ends snapshot** na elke succesvolle zet (vergelijken met wat client toont)
- **Legal-moves count** die client berekent vs wat server zou accepteren
- **Boneyard contents** snapshot bij start + na elke trek
- **Bot decisions**: welke move een bot koos en waarom (score/heuristic)
- **Performance**: render-tijden GameBoard bij grote chains
- **Coin balance voor/na** bij elke transfer
- **RPC duration** per call

### 7. Onderhoud

- Cron / edge function `cleanup-game-logs` die logs ouder dan 14 dagen verwijdert (instelbaar via `app_settings`)
- Optioneel: per game een "compact" log na afloop (alleen key events) als de full log groot is

### Volgorde van implementatie

1. Migratie: tabel `game_logs` + RLS + indexes + helper functie `_log_game_event`
2. Server: log-calls toevoegen in alle wega RPC's + finalize
3. Client: util `logGameEvent` + hooks in Game/useDominoGame
4. Admin: Game Logs sectie met lijst + detail-viewer
5. Cleanup edge function (optioneel, later)

Akkoord? Dan begin ik met de migratie.