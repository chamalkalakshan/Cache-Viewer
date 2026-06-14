const fs = require('fs');
const path = require('path');
const { pathExists } = require('./utils');

// Read original file size from $I metadata file (64-bit LE at offset 8)
function readIFileSize(iPath) {
  try {
    const buf = fs.readFileSync(iPath);
    if (buf.length < 16) return 0;
    const size = Number(buf.readBigInt64LE(8));
    return size > 0 ? size : 0;
  } catch { return 0; }
}

// Read original file path from $I metadata file
function readIFilePath(iPath) {
  try {
    const buf = fs.readFileSync(iPath);
    if (buf.length < 28) return null;
    const version = Number(buf.readBigInt64LE(0));
    // v1: path starts at 24 (fixed 520 bytes); v2: 4-byte char count at 24, path at 28
    let offset, maxLen;
    if (version === 2) {
      const charCount = buf.readUInt32LE(24);
      offset = 28;
      maxLen = charCount * 2;
    } else {
      offset = 24;
      maxLen = 520;
    }
    const slice = buf.slice(offset, offset + maxLen);
    const chars = [];
    for (let i = 0; i + 1 < slice.length; i += 2) {
      const code = slice.readUInt16LE(i);
      if (code === 0) break;
      chars.push(String.fromCharCode(code));
    }
    return chars.length ? chars.join('') : null;
  } catch { return null; }
}

function getRecycleBinItems() {
  const items = [];
  const drives = ['C', 'D', 'E', 'F'];

  for (const drive of drives) {
    const binPath = `${drive}:\\$Recycle.Bin`;
    if (!pathExists(binPath)) continue;

    let userDirs = [];
    try { userDirs = fs.readdirSync(binPath, { withFileTypes: true }); } catch { continue; }

    for (const userDir of userDirs) {
      if (!userDir.isDirectory()) continue;
      const userBinPath = path.join(binPath, userDir.name);

      let binFiles = [];
      try { binFiles = fs.readdirSync(userBinPath, { withFileTypes: true }); } catch { continue; }

      for (const f of binFiles) {
        // Only process $I metadata files
        if (!f.name.startsWith('$I')) continue;

        const iPath = path.join(userBinPath, f.name);
        const rPath = path.join(userBinPath, '$R' + f.name.slice(2));

        const size = readIFileSize(iPath);
        const originalPath = readIFilePath(iPath);
        const displayName = originalPath ? path.basename(originalPath) : f.name;

        let modified = '';
        let isDirectory = false;
        try {
          const stat = fs.statSync(rPath);
          modified = stat.mtime.toISOString();
          isDirectory = stat.isDirectory();
        } catch {
          try { modified = fs.statSync(iPath).mtime.toISOString(); } catch {}
        }

        items.push({
          name: displayName,
          path: rPath,
          originalPath: originalPath || '',
          size,
          modified,
          isDirectory,
        });
      }
    }
  }

  return items;
}

function getRecycleBinGroupSummary() {
  const items = getRecycleBinItems();
  const totalSize = items.reduce((s, i) => s + (i.size || 0), 0);

  return {
    id: 'recycle',
    name: 'Recycle Bin',
    icon: 'recycle',
    color: '#f87171',
    description: 'Deleted files waiting to be permanently removed',
    size: totalSize,
    children: items.map((item, idx) => ({
      id: `recycle-${idx}-${item.name.slice(0, 8).replace(/\W/g, '')}`,
      parentGroup: 'recycle',
      name: item.name,
      path: item.path,
      originalPath: item.originalPath,
      size: item.size,
      fileCount: 1,
      modified: item.modified,
      isDirectory: item.isDirectory,
    })),
  };
}

module.exports = { getRecycleBinGroupSummary };
