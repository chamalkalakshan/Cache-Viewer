const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cacheAPI', {
  scanAll: (onProgress) => {
    if (onProgress) {
      ipcRenderer.on('scan-progress', (_, data) => onProgress(data));
    }
    return ipcRenderer.invoke('scan-all');
  },
  scanGroup: (groupId) => ipcRenderer.invoke('scan-group', groupId),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  deleteItems: (paths) => ipcRenderer.invoke('delete-items', paths),
  onScanProgress: (cb) => ipcRenderer.on('scan-progress', (_, data) => cb(data)),
  removeScanProgress: () => ipcRenderer.removeAllListeners('scan-progress'),
});

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
});
