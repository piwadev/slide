# Kingdoms of War Launcher

Small Electron app (installer: NSIS, per-user) that installs, updates and starts the game.

## How updating works
1. On start the launcher calls `GET https://api.github.com/repos/piwadev/kingdoms-of-war/releases/latest` (unauthenticated).
2. The release must contain `manifest.json` (version, game zip name, **sha256**, size, optional launcher entry) and the game zip `kow-game-<version>.zip` (web files only, ~4 MB).
3. If the version is newer than the installed one, the zip is streamed to `%LOCALAPPDATA%\KingdomsOfWar\downloads`, its sha256 is checked while downloading, it is extracted (zip-slip safe) to `...\game\<version>.tmp`, validated (`index.html`, `version.json` must match), renamed to `...\game\<version>` and `state.json` is switched: `{current, previous}`. Only current + previous are kept (rollback in Settings).
4. Play opens the game in its own window, served from the installed folder through a private `kow://` protocol. No web server, no network needed.
5. Launcher self-update: `manifest.json` carries `launcher: {version, url, sha256}`. If newer than the running launcher, a "New launcher available" button downloads the installer (sha256-verified) and runs it (user data and saves are kept).
6. First run works offline: the installer contains a copy of the game version it was built with.

## Saves
`%APPDATA%\KingdomsOfWar\saves\kow_save.json` – outside every versioned game folder, so updates, rollbacks and reinstalls can't touch it. Writes are atomic (tmp + rename), a rotating backup (last 5) is kept in `saves\backups`, and a corrupt save falls back to the newest valid backup.
The game talks to the launcher through a preload bridge (`window.kowNative`); in a normal browser it keeps using `localStorage`. A browser/localStorage save is migrated into the file on first run in the launcher.
Launcher buttons: Open save folder, Back up save (export JSON), Restore save (import JSON, current save backed up first), Cloud backup (copy to a folder you pick, e.g. inside Google Drive / OneDrive / Dropbox; optional auto-backup when you quit the game; keeps 10 copies + `KingdomsOfWar-save-latest.json`).

## Develop / build
```bash
cd launcher && npm install
npm start                 # run the launcher from source (uses the real GitHub API; set KOW_API to point at a mock)
npm run dist              # Windows NSIS installer -> dist/KingdomsOfWar-Launcher-Setup.exe
node test/e2e.mjs         # end-to-end test against a local mock release server (needs playwright-core + Linux electron)
```
`npm run dist` on Linux/macOS needs `wine` (only to generate the NSIS uninstaller stub). Before building, `scripts/release.sh --launcher` puts the current game zip into `launcher/resources/bundled/`.

Environment overrides (testing): `KOW_API`, `KOW_ROAMING`, `KOW_LOCAL`, `KOW_TEST=1`, `KOW_NO_BUNDLE=1`.

## Publishing a game update
```bash
scripts/release.sh patch                 # or minor | major | 4.1.0 ; edit CHANGELOG.md first (## v4.0.1 section = release notes)
scripts/release.sh minor --launcher      # also builds + attaches a new launcher installer
scripts/release.sh patch --dry-run       # build everything, publish nothing
```
