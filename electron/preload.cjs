const { contextBridge, ipcRenderer } = require("electron");

// Exposer des APIs sécurisées au renderer (React)
contextBridge.exposeInMainWorld("electronAPI", {
  // Écouter les événements du menu natif
  onGoHome: (callback) => ipcRenderer.on("go-home", callback),
  removeGoHome: () => ipcRenderer.removeAllListeners("go-home"),

  // Infos sur l'environnement
  isElectron: true,
  platform: process.platform,

  // ─── Stockage fichier (compatible OneDrive/Google Drive/iCloud) ───
  readClients: (userId) => ipcRenderer.invoke("read-clients", userId),
  writeClients: (userId, data) => ipcRenderer.invoke("write-clients", userId, data),
  getStorageDir: () => ipcRenderer.invoke("get-storage-dir"),
  setStorageDir: () => ipcRenderer.invoke("set-storage-dir"),

  // ─── Paramètres cabinet (logo, couleurs, coordonnées) ───
  readCabinet: () => ipcRenderer.invoke("read-cabinet"),
  writeCabinet: (data) => ipcRenderer.invoke("write-cabinet", data),
});
