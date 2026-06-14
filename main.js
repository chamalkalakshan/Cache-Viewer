const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0f0f1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Window controls
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow.close());

// Scan all cache groups
ipcMain.handle('scan-all', async (event) => {
  const scanners = require('./scanners/index');
  return await scanners.scanAll((progress) => {
    event.sender.send('scan-progress', progress);
  });
});

// Scan a specific group in detail
ipcMain.handle('scan-group', async (event, groupId) => {
  const scanners = require('./scanners/index');
  return await scanners.scanGroup(groupId);
});

// Open folder in Explorer
ipcMain.handle('open-folder', async (event, folderPath) => {
  try {
    await shell.openPath(folderPath);
  } catch {}
});

// Delete selected paths (move to recycle bin or force delete)
ipcMain.handle('delete-items', async (event, paths) => {
  const results = [];
  for (const p of paths) {
    try {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        fs.rmSync(p, { recursive: true, force: true });
      } else {
        fs.unlinkSync(p);
      }
      results.push({ path: p, success: true });
    } catch (err) {
      results.push({ path: p, success: false, error: err.message });
    }
  }
  return results;
});
