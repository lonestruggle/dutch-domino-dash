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
