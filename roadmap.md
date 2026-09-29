# Roadmap

## Windows desktop versie + offline bots (huidige taak)
- [ ] Platform-detectie (Electron) in src/lib/platform.ts
- [ ] Home: speel-tegen-bots kaart actief in desktop-app (NL/EN teksten)
- [ ] useDominoGame: lokale beurten-logica (totalPlayers), passMove, winnaar bij geblokkeerd spel
- [ ] Index (single player): bots keren 1-3, lokale bot-loop met useBotAI, deals 7 stenen pp
- [ ] i18n sleutelwoorden NL/EN voor setup-scherm en Home
- [ ] Verifiëren via Playwright op /single-player: start spel, steen plaatsen, bot reageert
- [ ] Electron: vite base, electron/main.cjs (locale http server voor dist), package.json main
- [ ] Dependencies installeren (electron, @electron/packager), Windows .exe pakket bouwen
- [ ] Zip in Files (/mnt/documents) + instructies voor de gebruiker
