## Nieuwe Spelmodus: "Wega di sen"

Een high-stakes free-play modus waarbij ongeldige zetten niet worden geblokkeerd, maar afgestraft via een coin-economie.

### 1. Database wijzigingen (migratie)

**Nieuwe kolommen op `lobbies`:**
- `game_mode` (text, default `'classic'`) — waarden: `'classic'` | `'wega_di_sen'`
- `wega_stake` (integer, default 10) — de inzet X in coins

**Nieuwe kolom op `profiles`:**
- `coins` (integer, default 1000) — speler saldo

**Nieuwe RPC functies:**
- `transfer_coins(_from_user uuid, _to_user uuid, _amount int)` — SECURITY DEFINER, atomair coins verplaatsen
- `claim_boneyard_tile(_lobby_id, _tile_index)` — atomair een steen claimen tijdens gelijktijdig trekken (voorkomt race conditions)
- `claim_starter(_lobby_id, _domino)` — speler claimt startbeurt; valideert of het écht de hoogste is; zo niet → betaalt X aan alle anderen en spel eindigt

### 2. Lobby UI

In `Lobby.tsx` / lobby aanmaken:
- Dropdown "Spelmodus": Klassiek / Wega di sen
- Bij Wega di sen: input voor inzet X (coins)
- Toon coin-saldo van elke speler

### 3. Game flow aanpassingen

**Voorbereiding (`useSyncedDominoGameState.startNewGame`):**
- Bij `wega_di_sen`: bouw set zonder 6-6 en 0-0 (26 stenen)
- Géén automatische uitdeling: alle stenen blijven in boneyard
- Nieuwe fase `'drawing'` in game state

**Drawing fase (nieuwe UI in `GameBoard.tsx`):**
- Toon boneyard zichtbaar voor iedereen
- Elke klik op een tegel → `claim_boneyard_tile` RPC
- Loopt tot elke speler 5 stenen heeft

**Starter fase:**
- Spelers zien knop "Ik begin" op elke domino in hun hand
- Klik → `claim_starter` RPC valideert
- Bij valse claim: boete + game over

**Play fase (vrij spelen):**
- `findLegalMoves` / `placement-targets` worden NIET gebruikt in deze modus
- Speler kan elke steen op elke open positie slepen
- Nieuwe RPC `wega_submit_move(_lobby_id, _domino, _x, _y, _orientation)` valideert server-side:
  - Niet jouw beurt? → boete X aan iedereen, game over
  - Niet aansluitend op open eind? → boete X aan iedereen, game over
  - Anders: zet wordt toegepast, beurt door
- "Pas" knop → boete X aan laatste plaatser; opening bonus check (2X als pos 2 of 3 na opener)

**Win conditie:**
- Lege hand of geblokkeerd → winnaar krijgt X per speler
- Changa (laatste steen sluit beide kanten) → 2X per speler

### 4. Components

- `WegaDiSenLobbySettings.tsx` — modus + stake selector
- `WegaBoneyardPicker.tsx` — gelijktijdig trekken UI
- `WegaStarterClaim.tsx` — startbeurt claim knoppen
- `WegaPassButton.tsx` — pas knop met boete confirmatie
- `CoinBalance.tsx` — saldo weergave
- Aanpassingen in `GameBoard.tsx` om vrij plaatsen toe te staan bij wega modus

### Technische details

- Alle boete/win uitbetalingen via één RPC `wega_settle(_lobby_id, _outcome jsonb)` voor atomaire transfers
- Game state krijgt extra velden: `gameMode`, `wegaStake`, `wegaPhase` (`'drawing'|'claiming_starter'|'playing'|'ended'`), `lastPlacerUserId`, `openingPasses` (om de 2X bonus te tracken voor positie 2 en 3)
- Changa detectie: na plaatsing controleren of beide open eindes nu "gesloten" zijn door dezelfde steen

### Niet in scope nu
- Coin top-up / aankoop
- Historie van wega-spellen
- Animaties voor coin-transfers (kan later)

Wil je dat ik dit zo bouw, of eerst alleen stap 1+2 (database + lobby UI) en daarna stap 3+4?
