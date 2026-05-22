## Doel
Stap 1 van de migratie: **OBB/SAT collision-physics** toevoegen aan de klassieke mode, met **Anker = 0.000** (stenen veren niet terug naar hun grid-positie zodra ze door een botsing zijn verplaatst).

## Back-up
Klaar — gekopieerd naar `.backups/pre-physics-migration/`:
- `DominoGame.tsx`, `GameBoard.tsx`, `DominoTile.tsx`, `PlacementTarget.tsx`, `PlayerHand.tsx`
- `useDominoGame.ts`
- `CanvasDemo.tsx`, `Game.tsx`

## Aanpak

De klassieke mode is **DOM-based** (elke `DominoTile` is een `<div>` op `left/top` op basis van grid). We voegen een dunne physics-laag toe die per steen een **visuele offset** (dx, dy in px) bijhoudt en die via `transform: translate()` op de DOM-elementen wordt toegepast. De grid-coördinaten van de gameState blijven onaangetast — dit is puur visueel.

### Nieuw bestand: `src/hooks/useStonePhysics.ts`
- Houdt per `dominoId` een `{x, y, targetX, targetY, angle}` bij (in board-px-coords).
- `targetX/Y` = de grid-positie (waarheen het zou willen).
- RAF-loop:
  1. Anchor pull: `x += (targetX - x) * anchorStrength` (start = 0 → geen pull).
  2. Bouw OBB per steen (rotatie + W/H + DEPTH, zelfde logica als demo).
  3. 6 iteraties van paarsgewijze SAT-resolve; bij overlap push beide stenen langs de MTV uiteen.
  4. Schrijf resultaat naar een `Map<id, {dx, dy}>` ref en force-re-render via state-tick (1× per frame).
- Exporteert `{ getOffset(id), anchorStrength, setAnchorStrength }`.

### Aanpassing `GameBoard.tsx`
- Hook `useStonePhysics(gameState.dominoes, GRID_CELL_SIZE)` aanroepen.
- Per gerenderde `DominoTile` de offset uit de hook toepassen via een extra prop (bv. `physicsOffset={{dx, dy}}`).
- Debug-toggle "Toon collision-boxes" + slider "Anker" (0–0.25, default **0.000**) toevoegen aan de bestaande debug-controls, zodat je het stap voor stap kan testen zoals in de demo.

### Aanpassing `DominoTile.tsx`
- Extra prop `physicsOffset?: {dx: number, dy: number}`.
- Toepassen in de `transform`: bestaande `rotate(...)` blijft, we voegen `translate(dx, dy)` eraan toe.

### Wat we NU **niet** doen (volgt in latere stappen volgens je lijst)
- Anchor-based `placementPosition` (komt in een latere stap).
- 3D-DEPTH meenemen in OBB (kan in stap 1 mee, maar de klassieke tiles hebben geen visuele DEPTH-rand → we gebruiken pure W×H rechthoek).
- Soft-anchor UI buiten de debug-slider.
- Drag & drop / hand-selectie / click-to-place / magneet-zone toggle.

## Resultaat na stap 1
- Stenen botsen niet meer door elkaar als ze (later) verschoven worden.
- Bij Anker = 0.000 blijven ze waar de physics ze laat liggen; bij hogere waarde trekken ze zacht terug naar grid.
- Visuele test: hard slam (als die in klassiek bestaat) of artificiële offset → stenen duwen elkaar netjes uit elkaar i.p.v. te overlappen.

## Vraag
Akkoord met deze aanpak? Daarna implementeer ik enkel stap 1 en kunnen we testen voordat we naar de volgende uit je lijst gaan.