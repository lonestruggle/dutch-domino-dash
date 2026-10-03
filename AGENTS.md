
## Desktop packaging
Electron files stay in `electron/` (main.cjs only); packaging output goes to `electron-release/`, excluded from the web build. Why: keeps desktop artifact isolated from the deployed web app.
The desktop build serves `dist/` over a local HTTP server (port 4199) instead of `file://`. Why: root-absolute asset URLs and SPA routes break under the file protocol.
The live game always renders the beta game UI; stable remains source-only as a backup. Why: legacy lobby and browser settings must not restore the old hand UI.
