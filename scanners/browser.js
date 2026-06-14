const path = require('path');
const fs = require('fs');
const { getDirSize, pathExists, LOCAL_APP_DATA, APP_DATA } = require('./utils');

// Discover all named profiles (Default, Profile 1, Profile 2, …) under a User Data dir
function getProfileCachePaths(userDataDir, cacheSubdirs) {
  const found = [];
  if (!pathExists(userDataDir)) return found;

  let profileDirs = [];
  try {
    profileDirs = fs.readdirSync(userDataDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && /^(Default|Profile \d+|Person \d+)$/i.test(e.name))
      .map(e => path.join(userDataDir, e.name));
  } catch {}

  for (const profileDir of profileDirs) {
    for (const sub of cacheSubdirs) {
      const p = path.join(profileDir, sub);
      if (pathExists(p)) found.push(p);
    }
  }
  return found;
}

// Resolve Chrome-style Cache dirs — new Chromium stores data in Cache\Cache_Data
function resolveChromeCacheDir(cacheDir) {
  const inner = path.join(cacheDir, 'Cache_Data');
  return pathExists(inner) ? inner : cacheDir;
}

function getFirefoxCachePaths() {
  // Firefox settings live in %APPDATA%, but cache lives in %LOCALAPPDATA%
  const searchRoots = [
    path.join(LOCAL_APP_DATA, 'Mozilla', 'Firefox', 'Profiles'),
    path.join(APP_DATA, 'Mozilla', 'Firefox', 'Profiles'),
  ];
  const paths = [];
  const seen = new Set();
  for (const profilesDir of searchRoots) {
    if (!pathExists(profilesDir)) continue;
    try {
      const profiles = fs.readdirSync(profilesDir, { withFileTypes: true });
      for (const p of profiles) {
        if (!p.isDirectory()) continue;
        const c2 = path.join(profilesDir, p.name, 'cache2');
        if (pathExists(c2) && !seen.has(c2)) {
          seen.add(c2);
          paths.push({ profile: p.name, path: c2 });
        }
      }
    } catch {}
  }
  return paths;
}

// Browser definitions — User Data dir + which Cache subfolders to look for
const BROWSER_DEFS = [
  {
    id: 'chrome',
    name: 'Google Chrome',
    icon: 'chrome',
    userDataDir: path.join(LOCAL_APP_DATA, 'Google', 'Chrome', 'User Data'),
    cacheSubs: ['Cache', 'Code Cache', 'GPUCache'],
  },
  {
    id: 'edge',
    name: 'Microsoft Edge',
    icon: 'edge',
    userDataDir: path.join(LOCAL_APP_DATA, 'Microsoft', 'Edge', 'User Data'),
    cacheSubs: ['Cache', 'Code Cache', 'GPUCache'],
  },
  {
    id: 'brave',
    name: 'Brave Browser',
    icon: 'brave',
    userDataDir: path.join(LOCAL_APP_DATA, 'BraveSoftware', 'Brave-Browser', 'User Data'),
    cacheSubs: ['Cache', 'Code Cache', 'GPUCache'],
  },
  {
    id: 'opera',
    name: 'Opera',
    icon: 'opera',
    userDataDir: null,
    staticPaths: [
      path.join(APP_DATA, 'Opera Software', 'Opera Stable', 'Cache'),
      path.join(APP_DATA, 'Opera Software', 'Opera GX Stable', 'Cache'),
    ],
  },
  {
    id: 'vivaldi',
    name: 'Vivaldi',
    icon: 'vivaldi',
    userDataDir: path.join(LOCAL_APP_DATA, 'Vivaldi', 'User Data'),
    cacheSubs: ['Cache', 'Code Cache'],
  },
];

function scanBrowsers() {
  const results = [];

  for (const def of BROWSER_DEFS) {
    let rawPaths = [];

    if (def.userDataDir) {
      rawPaths = getProfileCachePaths(def.userDataDir, def.cacheSubs || ['Cache']);
    } else if (def.staticPaths) {
      rawPaths = def.staticPaths.filter(pathExists);
    }

    if (rawPaths.length === 0) continue;

    // Resolve Cache_Data subfolder for Chromium caches
    const validPaths = rawPaths.map(p => {
      if (path.basename(p) === 'Cache') return resolveChromeCacheDir(p);
      return p;
    }).filter(pathExists);

    if (validPaths.length === 0) continue;

    let totalSize = 0;
    let fileCount = 0;

    for (const p of validPaths) {
      const size = getDirSize(p, 3);
      totalSize += size;
      try { fileCount += fs.readdirSync(p).length; } catch {}
    }

    if (totalSize === 0) continue;

    results.push({
      id: `browser-${def.id}`,
      parentGroup: 'browser',
      name: def.name,
      icon: def.icon,
      size: totalSize,
      fileCount,
      paths: validPaths,
    });
  }

  // Firefox
  const firefoxProfiles = getFirefoxCachePaths();
  if (firefoxProfiles.length > 0) {
    let totalSize = 0;
    let fileCount = 0;
    const paths = [];

    for (const fp of firefoxProfiles) {
      const size = getDirSize(fp.path, 3);
      totalSize += size;
      try { fileCount += fs.readdirSync(fp.path).length; } catch {}
      paths.push(fp.path);
    }

    if (totalSize > 0) {
      results.push({
        id: 'browser-firefox',
        parentGroup: 'browser',
        name: 'Firefox',
        icon: 'firefox',
        size: totalSize,
        fileCount,
        paths,
      });
    }
  }

  return results;
}

function getBrowserGroupSummary() {
  const browsers = scanBrowsers();
  const totalSize = browsers.reduce((s, b) => s + b.size, 0);
  return {
    id: 'browser',
    name: 'Browser Cache',
    icon: 'browser',
    color: '#4e9af1',
    description: 'Cached web pages, images, scripts from Chrome, Edge, Firefox and more',
    size: totalSize,
    children: browsers,
  };
}

module.exports = { getBrowserGroupSummary, scanBrowsers };
