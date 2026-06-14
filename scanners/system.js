const path = require('path');
const fs = require('fs');
const { getDirSize, pathExists, LOCAL_APP_DATA, TEMP } = require('./utils');

function scanTempFolders() {
  const folders = [
    { name: 'User Temp', path: TEMP },
    { name: 'Windows Temp', path: 'C:\\Windows\\Temp' },
    { name: 'Prefetch', path: 'C:\\Windows\\Prefetch' },
  ];

  const results = [];
  for (const f of folders) {
    if (!pathExists(f.path)) continue;
    const size = getDirSize(f.path, 2);
    let fileCount = 0;
    try {
      fileCount = fs.readdirSync(f.path).length;
    } catch {}
    if (size > 0 || fileCount > 0) {
      results.push({ id: `temp-${f.name.replace(/\s+/g, '-').toLowerCase()}`, parentGroup: 'temp', name: f.name, path: f.path, size, fileCount });
    }
  }
  return results;
}

function scanWindowsCache() {
  const items = [
    { name: 'Thumbnail Cache', path: path.join(LOCAL_APP_DATA, 'Microsoft', 'Windows', 'Explorer') },
    { name: 'Windows Update Download', path: 'C:\\Windows\\SoftwareDistribution\\Download' },
    { name: 'Delivery Optimization', path: path.join(LOCAL_APP_DATA, 'Packages') + '\\..\\ConnectedDevicesPlatform', fallback: 'C:\\Windows\\ServiceProfiles\\NetworkService\\AppData\\Local\\Microsoft\\Windows\\DeliveryOptimization\\Cache' },
    { name: 'Icon Cache', path: path.join(LOCAL_APP_DATA, 'Microsoft', 'Windows', 'Explorer') },
    { name: 'DNS Cache', path: null, virtual: true, icon: 'dns' },
    { name: 'Font Cache', path: 'C:\\Windows\\System32', filter: 'FNTCACHE' },
  ];

  const results = [];
  for (const item of items) {
    if (item.virtual) {
      results.push({ id: `wincache-${item.name.replace(/\s+/g, '-').toLowerCase()}`, parentGroup: 'windows', name: item.name, path: null, size: 0, fileCount: 0, virtual: true });
      continue;
    }
    const p = pathExists(item.path) ? item.path : (item.fallback && pathExists(item.fallback) ? item.fallback : null);
    if (!p) continue;
    const size = getDirSize(p, 2);
    let fileCount = 0;
    try {
      const entries = fs.readdirSync(p);
      fileCount = item.filter ? entries.filter(e => e.startsWith(item.filter)).length : entries.length;
    } catch {}
    if (size > 0) {
      results.push({ id: `wincache-${item.name.replace(/\s+/g, '-').toLowerCase()}`, parentGroup: 'windows', name: item.name, path: p, size, fileCount });
    }
  }
  return results;
}

function scanAppCaches() {
  const appCacheDirs = [
    { name: 'Microsoft Teams', path: path.join(LOCAL_APP_DATA, 'Packages', 'MSTeams_8wekyb3d8bbwe', 'LocalCache') },
    { name: 'Spotify', path: path.join(LOCAL_APP_DATA, 'Spotify', 'Data') },
    { name: 'Discord', path: path.join(LOCAL_APP_DATA, 'Discord', 'Cache') },
    { name: 'Slack', path: path.join(LOCAL_APP_DATA, 'slack', 'Cache') },
    { name: 'Zoom', path: path.join(LOCAL_APP_DATA, 'Zoom', 'data') },
    { name: 'VS Code', path: path.join(LOCAL_APP_DATA, 'Programs', 'Microsoft VS Code', 'resources') + '\\..\\..\\cache', fallback: path.join(LOCAL_APP_DATA, 'Code', 'Cache') },
    { name: 'Steam', path: path.join(LOCAL_APP_DATA, 'Steam', 'htmlcache') },
    { name: 'OneDrive', path: path.join(LOCAL_APP_DATA, 'Microsoft', 'OneDrive', 'logs') },
    { name: 'Windows Store (AppCache)', path: path.join(LOCAL_APP_DATA, 'Packages') },
    { name: 'npm Cache', path: path.join(LOCAL_APP_DATA, 'npm-cache') },
    { name: 'pip Cache', path: path.join(LOCAL_APP_DATA, 'pip', 'Cache') },
  ];

  const results = [];
  for (const app of appCacheDirs) {
    const p = pathExists(app.path) ? app.path : (app.fallback && pathExists(app.fallback) ? app.fallback : null);
    if (!p) continue;
    const size = getDirSize(p, 3);
    if (size === 0) continue;
    let fileCount = 0;
    try { fileCount = fs.readdirSync(p).length; } catch {}
    results.push({ id: `app-${app.name.replace(/\s+/g, '-').toLowerCase()}`, parentGroup: 'apps', name: app.name, path: p, size, fileCount });
  }
  return results;
}

function getTempGroupSummary() {
  const items = scanTempFolders();
  return {
    id: 'temp',
    name: 'Temporary Files',
    icon: 'temp',
    color: '#f1c94e',
    description: 'Windows Temp folders, Prefetch data, and other temporary system files',
    size: items.reduce((s, i) => s + i.size, 0),
    children: items,
  };
}

function getWindowsCacheGroupSummary() {
  const items = scanWindowsCache();
  return {
    id: 'windows',
    name: 'Windows Cache',
    icon: 'windows',
    color: '#00b4d8',
    description: 'Thumbnail cache, Windows Update downloads, icon cache, and other OS caches',
    size: items.reduce((s, i) => s + i.size, 0),
    children: items,
  };
}

function getAppCacheGroupSummary() {
  const items = scanAppCaches();
  return {
    id: 'apps',
    name: 'App Cache',
    icon: 'apps',
    color: '#a78bfa',
    description: 'Cache data from installed apps: Teams, Discord, Spotify, VS Code, npm and more',
    size: items.reduce((s, i) => s + i.size, 0),
    children: items,
  };
}

module.exports = { getTempGroupSummary, getWindowsCacheGroupSummary, getAppCacheGroupSummary };
