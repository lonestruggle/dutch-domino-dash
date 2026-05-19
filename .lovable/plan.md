
## Het probleem

In de vorige iteratie heb ik de open-uiteinden-regel té streng gemaakt. Voor een niet-dubbele steen (bv. horizontale 5-3) liet ik alleen aanleggen in dezelfde lijnrichting toe:
- west-uiteinde → alleen W
- oost-uiteinde → alleen E

Daardoor kun je niet meer **de hoek omslaan** (een steen verticaal naar boven of onder leggen aan een horizontaal uiteinde) — terwijl dat in klassieke domino wél mag en ook in Wega di sen hoort te kunnen.

## Wat de regel eigenlijk moet zijn

> Een nieuwe steen mag alleen aan een **open uiteinde** worden aangelegd — niet aan de lange zijde van een niet-dubbele steen.

De **end-cel** van een niet-dubbele steen heeft 3 vrije zijden (één zijde is bezet door de andere helft van dezelfde steen). Aan elk van die 3 vrije zijden mag je aanleggen, mits de pip matcht:

- **Horizontale niet-dubbele steen:**
  - west-end-cel (dom.x, dom.y): toegestaan W, N, S
  - oost-end-cel (dom.x+1, dom.y): toegestaan E, N, S
  - lange zijdes (N en S in het midden): **geblokkeerd**
- **Verticale niet-dubbele steen:**
  - noord-end-cel: toegestaan N, W, E
  - zuid-end-cel: toegestaan S, W, E
  - lange zijdes (W en E in het midden): **geblokkeerd**
- **Dubbele steen (spinner):** alle 4 zijden van beide cellen blijven open uiteinden (ongewijzigd).

## Wijzigingen

### Server — nieuwe migratie op `wega_submit_move`

In de adjacency-check de "open-end direction"-logica versoepelen:
- Doubles: 4 zijden blijven open (ongewijzigd).
- Niet-doubles: de end-cellen geven nu 3 toegestane richtingen (de drie niet-buur-richtingen), niet alleen de in-lijn richting. De lange zijdes blijven geblokkeerd met `illegal_adjacency`.

### Client — `src/pages/Game.tsx`

In `wegaFindLegalMovesForHuman` (en de identieke `isOpenEndDirection` in de bot-versie rond regel 2040) dezelfde versoepeling toepassen: vanaf een end-cel van een niet-dubbele steen alle 3 niet-buur-richtingen toestaan in plaats van alleen de in-lijn richting.

### Niet aangeraakt

- Klassieke mode, UI, bot-orkestratie, claim-fase, pip-matching, en de cel-bezet-check blijven gelijk.
