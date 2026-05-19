## Wat ik nu zie in de code

In Wega di sen gebruiken we sinds de laatste fix exact `gameHook.findLegalMoves` van klassiek (`src/pages/Game.tsx` 2010‑2021). Die functie geeft targets terug op basis van `regenerateOpenEnds` in `src/hooks/useDominoGame.ts`.

`regenerateOpenEnds` doet voor niet-dubbele stenen al precies wat jij wil: alleen de twee end-cellen (isLeftCell/isRightCell of isTop/isBottom) geven targets. Een middenstuk geeft nooit een open end.

Maar voor **dubbele stenen** opent klassiek alle vier de zijden (spinner-gedrag). Dat is waarom je in Wega di sen nog steeds open ends ziet op middendubbels van de keten — die dubbel is een middenstuk, maar wordt toch behandeld als spinner met perpendiculaire takken.

Jouw regel: in Wega di sen mag niets aan een middenstuk, ook geen dubbel. Alleen de twee echte uiteinden (kop en staart) van de keten zijn open. Aan die uiteinden mag wel een bocht.

## De fix

Eén Wega-specifieke "tip"-filter toepassen bovenop de bestaande klassieke logica:

1. In `useDominoGame.ts` → `findLegalMoves` een nieuwe optie `wegaTipsOnly` toevoegen.
2. Wanneer die optie aanstaat:
   - Bepaal "tips" = stenen met **graad ≤ 1** in de ketengraaf (zelfde algoritme dat al bestaat in de `ignorePipMatch`-tak, regels 492‑508).
   - Filter de uiteindelijke `moves` zodat alleen zetten met een `fromDomino` die een tip is overblijven.
   - Dit elimineert automatisch ook alle perpendiculaire dubbel-targets op een dubbel die middenin de keten ligt (graad 2).
3. In `Game.tsx` (regels 2001‑2021) `wegaFindLegalMoves` en `wegaFindLegalMovesForHuman` aanroepen met `{ wegaTipsOnly: true }` in plaats van zonder opties.
4. Klassiek mode raakt niets aan — die roept zonder die optie aan en gedraagt zich exact zoals nu.

Server-side `wega_submit_move` validatie blijft zoals klassiek (end-cell connectie + spinner voor dubbel), want een placement aan een tip-dubbel is nog steeds een geldige perpendiculaire aansluiting; we beperken alleen welke targets zichtbaar/legaal zijn op de client. Als je wil dat de server dit óók afdwingt, dan voeg ik een vervolg-migratie toe die de tip-check in `wega_submit_move` inbouwt — laat me weten of dat nodig is.

## Wat je daarna ziet

- Een dubbele 6‑6 als middenstuk: geen oranje targets meer aan de zijkanten.
- Aan de echte kop/staart: nog steeds de drie klassieke opties (in-lijn + 2 dwars).
- Klassieke mode: ongewijzigd, spinners blijven werken zoals altijd.

## Technische details

Bestanden:
- `src/hooks/useDominoGame.ts` — `findLegalMoves` krijgt `opts.wegaTipsOnly`; tip-filter hergebruikt het bestaande degree-algoritme.
- `src/pages/Game.tsx` — beide Wega-wrappers geven die optie door.
