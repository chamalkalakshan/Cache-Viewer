# Cache Viewer

A Windows desktop app built with Electron that scans, groups, and manages every cache on your system. See exactly how much disk space is used by browser caches, temporary files, Windows system caches, app caches, and the Recycle Bin — all in one place.

![Cache Viewer](https://img.shields.io/badge/platform-Windows-blue) ![Electron](https://img.shields.io/badge/Electron-28-47848F) ![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **Five cache groups** — Browser, Temporary Files, Windows Cache, App Cache, Recycle Bin
- **Multi-profile browser detection** — finds Chrome, Edge, Brave, Firefox, Opera, Vivaldi caches across all user profiles (Default, Profile 1, Profile 2, etc.)
- **Accurate sizes** — uses binary `$I` metadata files for Recycle Bin sizes (fixes 2 GB overflow from Shell.Application COM API)
- **File browser** — click any group to see a sortable file list with name, type, size, and modified date
- **Select All / Deselect All** — checkbox in column header with indeterminate state support
- **Bulk delete** — select specific files or delete an entire cache folder at once
- **Confirmation dialog** — prevents accidental deletions
- **Search / filter** — filter files by name within any cache group
- **Open in Explorer** — jump directly to any cache folder
- **Sidebar summary** — total cache size across all groups shown at a glance
- **Custom frameless window** with minimize, maximize, and close controls

## Cache Groups

| Group | What is scanned |
|---|---|
| Browser Cache | Chrome, Edge, Brave, Firefox, Opera, Vivaldi (all profiles, Cache_Data subfolder) |
| Temporary Files | User Temp, C:\Windows\Temp, Prefetch |
| Windows Cache | Thumbnail cache, Windows Update downloads, icon cache |
| App Cache | Teams, Discord, Spotify, VS Code, npm, pip, OneDrive, Zoom, Slack, Steam |
| Recycle Bin | Deleted files via binary $I metadata, accurate 64-bit sizes |

## Getting Started

### Run from source

```bash
git clone https://github.com/YOUR_USERNAME/show-cache.git
cd "show cache"
npm install
npm start
```

### Build standalone release

```bash
npm run dist
```

Output: `dist/Cache Viewer-win32-x64/Cache Viewer.exe`

No installer needed. Copy the folder anywhere and run `Cache Viewer.exe`.

## Requirements

- Windows 10 or later (x64)
- Node.js 18+ and npm (for building from source only)

## Project Structure

```
show cache/
├── main.js          Electron main process, IPC handlers
├── preload.js       Context bridge exposing safe APIs to renderer
├── renderer/
│   ├── index.html   App shell
│   ├── styles.css   Dark theme styles
│   └── renderer.js  UI logic
└── scanners/
    ├── index.js     Aggregates all scanners, handles file listing
    ├── browser.js   Browser cache scanner (multi-profile, Cache_Data aware)
    ├── system.js    Temp files, Windows cache, app cache scanners
    ├── recycle.js   Recycle Bin scanner using $I binary metadata
    └── utils.js     Shared helpers (getDirSize, listDir, pathExists)
```

## How It Works

**Browser detection** uses `getProfileCachePaths()` to discover all profile folders (`Default`, `Profile 1`, etc.) under each browser's `User Data` directory, then resolves modern Chromium's `Cache/Cache_Data` subfolder automatically.

**Recycle Bin sizing** reads `$I` binary metadata files directly from `C:\$Recycle.Bin\{SID}\` instead of using the Shell.Application COM API, which overflows on files larger than 2 GB.

**File listing** uses `listDir()` with depth 0 to show top-level cache entries per folder, each with its calculated subtree size.

## License

MIT
