// All on-disk locations. Saves live under %APPDATA% (roaming) and are never inside the versioned game folders,
// so updating / rolling back / reinstalling the game can never touch them.
const path = require('path');
const os = require('os');
const { app } = require('electron');

const roaming = process.env.KOW_ROAMING || path.join(app.getPath('appData'), 'KingdomsOfWar');
const local = process.env.KOW_LOCAL || (process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'KingdomsOfWar')
  : path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'KingdomsOfWar'));

module.exports = {
  roaming, local,
  userData: path.join(roaming, 'launcher'),
  savesDir: path.join(roaming, 'saves'),
  saveFile: path.join(roaming, 'saves', 'kow_save.json'),
  backupsDir: path.join(roaming, 'saves', 'backups'),
  settingsFile: path.join(roaming, 'launcher-settings.json'),
  gameDir: path.join(local, 'game'),
  stateFile: path.join(local, 'state.json'),
  downloadsDir: path.join(local, 'downloads'),
  logFile: path.join(roaming, 'launcher', 'launcher.log'),
};
