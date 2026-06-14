const fs = require('fs');
const path = require('path');
const os = require('os');

function getDirSize(dirPath, maxDepth = 4, depth = 0) {
  let total = 0;
  if (depth > maxDepth) return total;
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const item of items) {
      try {
        const full = path.join(dirPath, item.name);
        if (item.isSymbolicLink()) continue;
        if (item.isDirectory()) {
          total += getDirSize(full, maxDepth, depth + 1);
        } else {
          total += fs.statSync(full).size;
        }
      } catch {}
    }
  } catch {}
  return total;
}

function listDir(dirPath, maxDepth = 1, depth = 0) {
  const items = [];
  if (depth > maxDepth) return items;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      try {
        const full = path.join(dirPath, entry.name);
        if (entry.isSymbolicLink()) continue;
        const stat = fs.statSync(full);
        const isDir = entry.isDirectory();
        const size = isDir ? getDirSize(full, 3) : stat.size;
        items.push({
          name: entry.name,
          path: full,
          size,
          isDirectory: isDir,
          modified: stat.mtime.toISOString(),
        });
      } catch {}
    }
  } catch {}
  return items.sort((a, b) => b.size - a.size);
}

function pathExists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const LOCAL_APP_DATA = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const APP_DATA = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const TEMP = process.env.TEMP || process.env.TMP || path.join(os.homedir(), 'AppData', 'Local', 'Temp');
const HOME = os.homedir();

module.exports = { getDirSize, listDir, pathExists, formatBytes, LOCAL_APP_DATA, APP_DATA, TEMP, HOME };
