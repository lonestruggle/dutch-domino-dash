## Fase C — Wega di sen: vrij spelen

### 1. Steen oriëntatie in de hand (UX)
- **Tap** op een steen in `PlayerHand` (in wega-modus, fase `playing`):
  - 1e tap: selecteer steen
  - 2e tap op zelfde steen: **flip** (wisselt `value1`/`value2` visueel via een lokale `flipped`-state per steen)
  - Lang indrukken (≥400ms) of dubbel-tap-toggle: **roteer** horizontaal ↔ verticaal
- Geselecteerde steen toont een klein indicator-balkje "🔄 Flip · ↻ Draai" zodat het ontdekbaar is
- State leeft in `Lobby`/`Game` component, niet in DB (alleen de uiteindelijke zet wordt verstuurd)

### 2. Vrij plaatsen op het bord
- In `GameBoard.tsx`: wanneer `gameMode === 'wega_di_sen'` en `wegaPhase === 'playing'`:
  - **Géén** `findLegalMoves` / `placement-targets` renderen
  - Het hele bord wordt een drop-zone die `clientX/Y` → grid `(x, y)` mapt
  - Speler sleept geselecteerde steen → release op cel → cliënt roept RPC `wega_submit_move` aan met `{ hand_index, x, y, orientation, flipped }`
- Boneyard is **uitgeschakeld** zodra `wegaPhase !== 'drawing'` (geen klik, grijs/disabled, "Boneyard gesloten")

### 3. Server-side RPC `wega_submit_move`
Nieuwe Postgres functie (SECURITY DEFINER). Validatie:
1. Authenticated + speler zit in lobby + het is zijn beurt
2. `wegaPhase = 'playing'` en `isGameOver = false`
3. Hand-index bestaat, steen matcht
4. Cel `(x,y)` en zijn 2e cel (afhankelijk van orientation) zijn vrij
5. Zet sluit aan op een **open end** met matchend pip-getal (server berekent open ends uit `board`)
6. Bij **succes**: bord/dominoes/hand bijwerken, beurt door, `lastPlacerUserId` zetten, openingPasses bijwerken, changa-check
7. Bij **fout (foute positie, fout pip, niet jouw beurt)**: boete X aan **elke andere menselijke speler** via `transfer_coins`, steen blijft in hand, beurt blijft (speler mag opnieuw of passen)

### 4. Pas-knop
- Knop "Pas" zichtbaar in wega-modus tijdens jouw beurt
- Nieuwe RPC `wega_pass`:
  - Boete X aan `lastPlacerUserId` (de laatste die plaatste); als die er niet is (eerste zet) → X aan iedereen
  - **Openingsbonus**: als de huidige speler positie 2 of 3 is sinds de starter én nog niemand legaal heeft kunnen leggen op het juiste open einde → 2X bonus van passer aan starter
  - Beurt door naar volgende speler
  - Track `openingPasses` in `game_state`

### 5. Changa-detectie
- In `wega_submit_move`, na succesvolle plaatsing:
  - Bereken nieuwe open ends; check of de laatst geplaatste steen **beide** openstaande pip-waardes "sluit" (= identiek aan beide open ends die nu zijn weggevallen) → `gameEndReason = 'changa'`
  - Winnaar krijgt **2X per andere speler**
- Lege hand → `gameEndReason = 'normal'`, winnaar krijgt **X per andere speler**
- Geblokkeerd (geen open ends meer aanspreekbaar én iedereen heeft gepast) → laagste pips wint X per speler (optioneel — kunnen we later finetunen)

### 6. Eindafrekening
Eén RPC-call `wega_settle` (bestaat al) wordt automatisch aangeroepen vanuit `wega_submit_move`/`wega_pass` zodra game eindigt. Transfers worden gebundeld in de `transfers`-array.

### 7. UI
- `WegaPassButton.tsx`: knop met confirmatie en preview van de boete
- `GameBoard.tsx`: vrij-plaats drop-zone toevoegen achter een `if (gameMode === 'wega_di_sen' && wegaPhase === 'playing')` branch
- `PlayerHand.tsx`: flip/rotate gestures, visuele indicator
- `WegaPhaseOverlay.tsx`: extend met 'playing'-status (toont saldi, laatste plaatser, beurt)

### Technische details

**Nieuwe RPC's (migratie):**
- `wega_submit_move(_lobby_id uuid, _hand_index int, _x int, _y int, _orientation text, _flipped boolean) returns jsonb`
- `wega_pass(_lobby_id uuid) returns jsonb`

**Game state aanvullingen:**
```
{
  ...
  lastPlacerUserId: uuid | null,
  openingPlacements: number,   // hoeveel legale zetten sinds opener
  wegaPhase: 'drawing' | 'claiming_starter' | 'playing' | 'ended',
  gameEndReason: 'changa' | 'normal' | 'blocked'
}
```

**Open-end berekening server-side:** een SQL helper die over `board`-jsonb itereert en per bezette cel de 4 buren checkt; cellen die niet in `board` zitten zijn open ends met `value = pip aan die kant`.

### Volgorde van implementatie

1. **Migratie**: `wega_submit_move` + `wega_pass` + helper voor open-ends + extra velden in game_state defaults
2. **PlayerHand flip/rotate** in wega-modus
3. **GameBoard vrij-plaatsen** drop-zone + boneyard disable
4. **Pas-knop** component + integratie
5. **Eindscherm** met coin-transfers

### Niet in scope nu
- Animatie van coin-transfers
- Undo / "weet je het zeker"-confirm (gebruiker koos: gewoon boete + door)
- Geblokkeerd-detectie volautomatisch (alleen via pas-cyclus)

Akkoord met dit plan? Dan begin ik met de migratie + RPC's.
