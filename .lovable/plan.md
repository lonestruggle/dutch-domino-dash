## Doel

1. Als admin/dev mag je een Wega-lobby starten met **slechts 1 echte speler** (de rest wordt automatisch aangevuld met bots).
2. De bot moet ook **Wega kunnen spelen**: stenen uit boneyard kiezen, starter claimen, leggen of passen.
3. Onderzoek waarom de melding **"Kon steen niet trekken – Not in drawing phase"** verschijnt terwijl de hand 0/5 toont.

## Aanpak

### Stap 1 — Solo-test mode (snel)
- In `Lobby.tsx` (start-knop) en aan serverkant: een lobby met `is_test = true` (of als de host een `admin`/`dev` is) mag starten met `player_count = 1`. De overige slots worden gevuld met bots via bestaande `useBotManager`.
- Geen nieuwe permissies: hergebruik `has_role(auth.uid(),'admin'|'dev')` (zoals al in je memory staat).
- UI: extra knop "Start solo-test (vul met bots)" voor admins/devs, naast de gewone Start-knop.

### Stap 2 — Bot voor Wega
Voeg in `useBotAI` / `useBotManager` Wega-fase-bewustzijn toe:
- **drawing**: bot kiest na korte delay een willekeurige tile uit `boneyard` → roept `wega_claim_boneyard_tile` aan tot zijn hand 5 is.
- **claiming_starter**: bot bekijkt zijn hand, pakt zijn hoogste dubbel of (anders) zijn hoogste som, en roept `wega_claim_starter` aan met die index. Als hij denkt er één te hebben en het is fout → server handelt dat correct af (penalty).
- **playing**: bot zoekt eerste legale zet (zelfde matcher als de UI) en roept `wega_submit_move`. Als geen legale zet → `wega_pass`.

Bot draait alleen op de **host-client** (huidige conventie). Zelfde delays als nu (1–2s).

### Stap 3 — "Not in drawing phase"
- Op het screenshot staat hand 0/5 maar server zegt geen `drawing` meer. Mogelijke oorzaak: phase overslag of stale client-state. Toevoegen:
  - In `Game.tsx`: voor de draw-knop checken op `state.wegaPhase === 'drawing'` voordat call uitgevoerd wordt (i.p.v. blindelings RPC aanroepen).
  - In `wega_claim_boneyard_tile`: bij `RAISE EXCEPTION 'Not in drawing phase'` óók een `client_error`-vriendelijk log neerzetten met de huidige phase, zodat we in de logs zien wat de server-phase op dat moment was.

### Technische details

- Bot-cycle: bij elke `game_state` change kijkt `useBotManager` of het de beurt van een bot is OR of de bot in `drawing` nog tiles moet trekken. Drawing is parallel (geen beurt-volgorde) — dus elke bot trekt onafhankelijk tot 5.
- Solo-test in `wega_start` (of waar de game wordt aangemaakt): de check op minimum aantal echte spelers wordt afhankelijk van `lobby.is_test` of `has_role`. Eenvoudigst: laat de **host-client** bots toevoegen als lobby_players vóór game start; de bestaande start-flow blijft hetzelfde.
- `lobby_players.is_bot = true` bestaat al (gezien in `_wega_finalize_game`), dus geen schema-wijziging nodig.

### Bestanden die ik wijzig
- `src/hooks/useBotManager.ts` en/of `src/hooks/useBotAI.ts` (Wega-acties toevoegen)
- `src/pages/Lobby.tsx` (solo-test knop voor admin/dev, bot-slots vullen)
- `src/pages/Game.tsx` (phase-check voor draw-knop, logging)
- DB-migratie alleen als blijkt dat er geen RPC bestaat om vanaf de client een bot in `lobby_players` te zetten met de juiste velden — anders direct insert via supabase-js.

### Wat ik NIET doe
- Starter autoplaatsen (jouw keuze: handmatig laten).
- Geen schemawijzigingen tenzij strikt nodig.

## Volgorde van uitvoering

1. Lees `useBotManager`, `useBotAI`, `Lobby.tsx`, `Game.tsx`.
2. Bouw solo-test knop + bot-spawn.
3. Bouw bot-Wega logica (drawing → claim → play/pass).
4. Fix draw-knop check + extra logging.
5. Testen via admin console.
