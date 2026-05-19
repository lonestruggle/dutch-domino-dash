## Doel

In **Wega di sen** gelden voor de plaatsing (positie/oriëntatie/anti-clutter) **exact dezelfde regels als in Klassieke modus**. Het enige verschil: pip-getallen hoeven niet te matchen. Probeert een speler een steen te leggen op een geldige positie maar met niet-matchende pips, dan wordt de zet **geweigerd** en gaat de **volledige inzet (wegaStake)** als boete naar de tegenpartij (zelfde model als de huidige `illegal_adjacency`). Bots mogen ook bewust mismatchen.

## Wat verandert

### 1. Klassieke regels als enige bron van waarheid (client)

In `src/pages/Game.tsx`:

- **`wegaFindLegalMoves` (strict, voor bord-targets bij geselecteerde steen)** vervangen door: gebruik `gameHook.findLegalMoves(dominoData)` direct. Dit levert al alle klassieke regels: open uiteinden, spinner-richting, doubles dwars, `hasDifferentNeighbor`, `forbiddens`, `hasIllegalSideContact`, parallel-zetten van spinner. Geen eigen geometry meer in Wega.
- **`wegaFindLegalMovesForHuman` (permissief, voor menselijke spelers)** vervangen door:
  1. Roep een variant van klassieke `findLegalMoves` aan die de pip-match check overslaat. Concreet: een nieuwe optie `ignorePipMatch: true` op `findLegalMoves` in `useDominoGame.ts`, die `if (end.value === value)` overslaat én voor beide flips (false/true) een kandidaat probeert (i.p.v. waarde-afhankelijk).
  2. Alle overige checks blijven actief, zodat de geometrie identiek is aan klassiek.

### 2. Bot-gedrag (mag mismatchen)

In `Game.tsx` (bot-tak in Wega-effect): blijft `wegaFindLegalMovesForHumanRef` gebruiken (permissieve set) zodat de bot soms een mismatch-zet kiest. Dit blijft werken zodra die functie via de nieuwe permissieve klassieke variant draait — geen aparte wijziging nodig behalve het hierboven beschreven herontwerp.

### 3. Server-side validatie (`wega_submit_move`)

Nieuwe migratie die `wega_submit_move` herschrijft zodat de **positie-validatie** overeenkomt met de klassieke regels (open uiteinde van naburige tegel, anti-clutter, doubles dwars, geen long-side aanleg, geen tweede parallel vanaf spinner). De **pip-match** wordt apart gecontroleerd en bepaalt of de zet succesvol is of een fout:

- **Positie ongeldig** → blijft `illegal_position` (of huidige naam), boete = `wegaStake` naar tegenpartij, beurt eindigt.
- **Positie geldig + pips matchen** → zet wordt geplaatst, normale flow.
- **Positie geldig + pips matchen NIET** → nieuwe `reason: 'pip_mismatch'`, zet wordt **niet geplaatst**, boete = `wegaStake` naar tegenpartij(en), beurt gaat over.

De bestaande `illegal_adjacency` reason wordt vervangen door deze nieuwe duidelijkere afsplitsing (`illegal_position` voor geometry-fouten, `pip_mismatch` voor niet-matchende pips). Toast-teksten in `Game.tsx` worden aangepast.

### 4. Boete-afhandeling

Identiek aan huidige `illegal_adjacency`-flow: `wegaStake` coins worden afgetrokken bij de overtreder en (gelijkmatig of volledig — zoals nu) toegekend aan de tegenpartij(en). Geen wijziging in bedragen, alleen in trigger-condities.

## Out of scope

- Geen wijziging aan klassieke modus.
- Geen wijziging aan claim-fase, hard slam, of stake-instelling.
- Geen UI/visuele wijzigingen, alleen toast-tekst voor de nieuwe `pip_mismatch` reden ("Pips komen niet overeen — boete naar tegenstander").

## Technische details

- `src/hooks/useDominoGame.ts`: `findLegalMoves` krijgt 2e arg `{ ignorePipMatch?: boolean }`. Wanneer true: in `check()` wordt `end.value === value` overgeslagen en `check(value1, false)` + `check(value2, true)` levert tot 2 kandidaten op (uniqueEnds blijft dedupliceren per cel).
- `src/pages/Game.tsx`: 
  - `wegaFindLegalMoves` → `gameHook.findLegalMoves(d)`.
  - `wegaFindLegalMovesForHuman` → `gameHook.findLegalMoves(d, { ignorePipMatch: true })`.
  - Verwijder de lokale `isOpenEndDirection` / `placementMatchesServerRules` helpers (dood na bovenstaande).
  - Toast voor `pip_mismatch` toevoegen.
- Nieuwe migratie `supabase/migrations/<ts>_wega_classic_geometry.sql` met herschreven `wega_submit_move` PL/pgSQL die de klassieke regels nabootst en `pip_mismatch` als reason terug kan geven met boete-uitkering.

