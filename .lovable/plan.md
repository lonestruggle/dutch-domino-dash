## Doel
Wega di sen gebruikt exact dezelfde bord-/open-end-/oriëntatie-regels als de klassieke mode. Het enige verschil: de menselijke speler mag een steen op een open end leggen ook al matcht de waarde (pip) niet. De server controleert en als de waarde fout is, eindigt het spel met de bestaande verkeerd-gelegd-afhandeling (boete uit Wega-flow).

## Wijzigingen

### 1. `src/pages/Game.tsx` — `wegaFindLegalMovesForHuman`
Vervangen door de klassieke `findLegalMoves`-logica (zelfde als bots), met één aanpassing: de pip-match check (`end.value === value`) wordt overgeslagen. De rest blijft identiek aan klassiek:
- Open ends bepalen volgens klassieke regels (3 bij niet-dubbels, 1 centraal bij dubbels, spinner 4)
- Oriëntatie geforceerd volgens richting van de open end
- Forbiddens en neighbor-checks blijven gelden
- Beide oriëntaties van de steen (flipped/niet-flipped) worden als optie aangeboden zodat de speler kan kiezen welke kant tegen het open end komt

Resultaat: speler ziet placement-targets op álle klassieke open ends voor élke steen in z'n hand, ongeacht of de waarde matcht.

### 2. `src/pages/Game.tsx` — pass-knop / auto-pass
De `canPass`/auto-pass check gebruikt nu de **klassieke** legal-move check (mét pip-match), niet de permissieve. Zo kan een speler alleen passen als hij écht geen matchende steen heeft. Dit voorkomt de bug dat de mens moest passen terwijl de bot aan beurt was, en dat de bot 2× speelde.

### 3. Server — `wega_submit_move`
Al aanwezig: de RPC valideert pip-match en triggert game-end bij fout. Geen wijziging nodig, alleen verifiëren dat de "fout gelegd"-tak nog steeds correct het spel eindigt met de boete-flow (zoals bij bot-fout via `wega_bot_error_chance`).

### 4. Bots
Geen verandering: bots blijven via klassieke `findLegalMoves` (mét pip-match) spelen, met de admin-instelbare `wega_bot_error_chance` voor opzettelijke fouten.

## Technische details
- `wegaFindLegalMovesForHuman` wordt grotendeels gelijk aan `gameHook.findLegalMoves` (de klassieke variant) maar zonder de `end.value === dominoData.value1/2` filter — wél met flipped-varianten zodat oriëntatie/positie klassiek geforceerd blijft.
- De pass-check in `useEffect` rond regel 2312-2327 en in de UI-pass-knop gebruikt `wegaFindLegalMoves` (klassiek, mét pip) i.p.v. de permissieve variant.
- Geen DB-migraties nodig.

## Bestanden
- `src/pages/Game.tsx` (alleen `wegaFindLegalMovesForHuman` en pass-checks)
