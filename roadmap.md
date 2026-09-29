# Roadmap

## Windows desktop versie + offline bots (huidige taak)
- [x] Platform-detectie (Electron) in src/lib/platform.ts
- [x] Home: speel-tegen-bots kaart actief in desktop-app (NL/EN teksten)
- [x] useDominoGame: lokale beurten-logica (totalPlayers), passMove, winnaar bij geblokkeerd spel
- [x] Index (single player): bots keren 1-3, lokale bot-loop met useBotAI, deals 7 stenen pp
- [x] i18n sleutelwoorden NL/EN voor setup-scherm en Home
- [x] Verifiëren via Playwright op /single-player: start spel, steen plaatsen, bot reageert
- [x] Electron: vite base, electron/main.cjs (locale http server voor dist), package.json main
- [x] Dependencies installeren (electron, @electron/packager), Windows .exe pakket bouwen
- [x] Zip in Files (/mnt/documents) + instructies voor de gebruiker

## Volledige NL/EN vertaling (nieuwe taak)
- [x] Alle UI-teksten: NL + EN compleet, EN-teksten die al Engels zijn blijven staan
- [x] "Wega di sen" vertalen als "money play"
- [x] Onvertaalde/onduidelijke teksten aan gebruiker melden (Changa + CanvasDemo openstaand bij gebruiker)
- [x] Verifiëren in preview: NL/EN wissel werkt, build OK (overlays in spel nagekeken door gebruiker)

## Vertaalbeslissingen (bevestigd door gebruiker)
- Verzuim (EN): "failed to claim the highest domino ... in time"
- "laatste plaatser" (EN): "the last player to place a tile"
- Changa: nog onbekend — voorlopig onvertaald laten
- CanvasDemo: bewust niet vertalen (interne testpagina)

## Bug pc-versie: geplaatste stenen blijven in hand (huidige taak)
- [x] Reproduceren: plaatsing hield 7 stenen (bug bevestigd)
- [x] Fix: executeMove gebruikt nu localPlayerPosition als actor zonder actorPosition
- [x] Windows-pakket herbouwd (wegidomino-windows.zip)

## Hertest volledige NL/EN vertaling
- [x] Spelknoppen, beurtstatus, boneyard en eindscherm gekoppeld aan NL/EN
- [x] Wega-meldingen en claimscherm gekoppeld aan NL/EN
- [x] Profielstatus en uitnodigingen gekoppeld aan NL/EN
- [x] Engelse spelknoppen en locale-sleutels gecontroleerd; build OK

- [ ] Nieuwe mobiele ontwerpopties voor het spelscherm tonen; eerdere filmische richting niet gebruiken.

- [ ] Spelscherm mobiel herontwerpen in stijl van Domino Legends D6-voorbeeld: portret-layout, tegenstanders rond tafel met kleine stenen aan de randen, HUD bovenaan (ronde/punten/tijd), avatar onderaan, Klaar/Pas-knoppen; bestaande stenen en handrendering behouden; schaalt ook naar tablet/pc.
- [ ] Mobiel spelerscherm: voorbeelden maken op basis van Domino Legends D6-referentie (topbar RONDE/PUNTEN/TIJD, tafel met spelers eromheen, handdock onderaan) — spel zelf ongewijzigd. Wacht op keuze van de gebruiker.
- [ ] Spelerscherm-voorbeelden: platte HTML-prototypes afgewezen ("lijken niet op het voorbeeld"); realistische mockup-beelden genereren in Domino Legends D6-stijl (mahonie / tropisch / neon) en laten kiezen. Spel zelf ongewijzigd.
- [ ] Spelerscherm-voorbeelden: eerste mockups nog te ver van de Domino Legends D6-referentie; opnieuw genereren met letterlijke opbouw (vierkante tafel, handen aan 4 kanten, HUD vast bovenin, menu rechts, KLAAAR/PAS rechtsonder).
