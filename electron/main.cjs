const { app, BrowserWindow, Menu, shell, ipcMain, dialog, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { autoUpdater } = require("electron-updater");
const APP_ICON_B64 = "PHN2ZyB3aWR0aD0iMjUxIiBoZWlnaHQ9IjI3NiIgdmlld0JveD0iMCAwIDI1MSAyNzYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGNsaXAtcGF0aD0idXJsKCNjbGlwMF8xNjdfMTA0KSI+CjxwYXRoIGQ9Ik0xMDAuMjMgMjIwLjA4Qzg5LjAyMDEgMjIwLjA4IDc5LjYzMDEgMjE0Ljg3IDc0LjQ2MDEgMjA1Ljc5QzY1LjcxMDEgMTkwLjQxIDc0LjYzMDEgMTc3LjI4IDgxLjgwMDEgMTY2LjcyQzg2Ljk2MDEgMTU5LjEyIDkyLjgxMDEgMTUwLjUxIDk1LjkwMDEgMTM4LjU3Qzk3LjgwMDEgMTMxLjIyIDk3LjY0MDEgMTE3LjYxIDk2LjA4MDEgMTE5LjgyQzkzLjE0MDEgMTIzLjk4IDg3LjY2MDEgMTMxLjczIDc3LjMwMDEgMTMxLjczQzc0LjgzMDEgMTMxLjczIDcyLjM2MDEgMTMxLjI1IDY5Ljk1MDEgMTMwLjMxQzYyLjcyMDEgMTI3LjQ4IDU4Ljg0MDEgMTE5LjYxIDYwLjk4MDEgMTEyLjE2QzY0Ljc2MDEgOTkuMDIwMSA3NC44MDAxIDY0LjEyIDExMC43NyA2NC4wM0MxMTAuNzcgNjQuMDMgMjA2LjUgNjMuOCAyMDYuNTEgNjMuOEMyMTIuMjggNjMuOCAyMTcuNyA2Ny4xMTAxIDIyMC4yNCA3Mi42OTAxQzIyMS4yIDc0Ljc5MDEgMjIxLjU2IDc3LjEyMDEgMjIxLjU0IDc5LjQzTDIyMS4zNCA5OC4xN0MyMjEuMjUgMTA2LjMyIDIxNC42OSAxMTIuOTEgMjA2LjU0IDExMy4wNEwxOTAuMiAxMTMuMjlDMTg5Ljg0IDExMy4yOSAxODkuNTUgMTEzLjU3IDE4OS41MyAxMTMuOTNMMTg3LjAyIDE1Mi4xOEMxODYuNzQgMTU2LjUxIDE4OC45NiAxNjEuMTYgMTkwLjY3IDE1OC45OUMxOTMuODIgMTU0Ljk5IDE5OC43OSAxNTIuNiAyMDMuOTYgMTUyLjZDMjA5LjkyIDE1Mi42IDIxNS40IDE1NS42NyAyMTguNjEgMTYwLjgyQzIyNS4yMiAxNzEuNDEgMjE5LjYgMTg2LjA0IDIxMy45NiAxOTcuNjFDMjA3LjA1IDIxMS43NyAxOTMuMTMgMjIwLjIzIDE3Ni43MSAyMjAuMjNDMTc2LjcxIDIyMC4yMyAxMDIuMzkgMjIwLjEgMTAwLjI0IDIyMC4xTDEwMC4yMyAyMjAuMDhaIiBmaWxsPSIjMTAxQjNCIi8+CjxwYXRoIGQ9Ik0xNTYuNDkgMTAxLjM1QzE0Ny4yNSA5OS41OSAxMzguOTUgMTAwLjUyIDEyOS42NCAxMDAuODVDMTI3LjYyIDEyNi41OSAxMjUuOTEgMTY4LjU1IDExNy4zNSAxOTAuOTFDMTE1LjIxIDE5Ni41IDExMC45NyAyMDAuNDUgMTA2LjMxIDIwMS4yNEMxMDAgMjAyLjMxIDkzLjcxIDIwMC45NiA5MC40NiAxOTUuMjVDODMuMTUgMTgyLjQxIDEwNC41NiAxNzEuNTggMTEyLjEzIDE0Mi4zMUMxMTUuNjUgMTI4LjcgMTE3LjIyIDExNS4zOSAxMTguMTIgMTAxLjI4Qzg2LjAzIDk1LjMyIDg4LjU3IDEyMS40NSA3OS4wMyAxMTcuNzJDODQuMDMgMTAwLjMzIDkxLjkxIDgyLjU3IDExMi40NiA4Mi41MkwyMDIuOSA4Mi4zTDIwMi43IDEwMC40MkwxNzMuNTcgMTAwLjg2TDE3MC4zIDE1MC42N0MxNjkuNzggMTU4LjUyIDE2OS44NiAxNjYuNSAxNzIuMTMgMTc0LjAyQzE3NC4wMyAxODAuMzIgMTgwLjQ2IDE4Mi4zNCAxODYuMyAxODEuODdDMTk3LjU0IDE4MC45NiAxOTguNjcgMTY2LjcyIDE5OC44OSAxNjcuNjNDMTk4LjI4IDE2NS4xMiAyMDkuNSAxNjMuMDIgMTk3LjE3IDE4OC4zMUMxOTIuNzQgMTk3LjM5IDE4NC4yMSAyMDEuODQgMTc0LjMgMjAxLjdDMTU5Ljk5IDIwMS41MSAxNTAuMzcgMTkxIDE1MC42NCAxNzYuNEMxNTEuMDkgMTUxLjY1IDE1NC41MSAxMjcuODcgMTU2LjUxIDEwMS4zNkwxNTYuNDkgMTAxLjM1WiIgZmlsbD0iI0Y4RjZGNyIvPgo8cGF0aCBkPSJNMTE0Ljk5IDI2Mi45OEM4NC4wNCAyNTcuMSA1Ni43NiAyNDAuMTkgMzcuNjggMjE0Ljg2QzE3LjM0IDE4Ny44NyA4LjczMDAyIDE1NC41NyAxMy40MyAxMjEuMUMxOC4xMyA4Ny42MyAzNS41OSA1OCA2Mi41OCAzNy42NUM4OC4zMSAxOC4yNiAxMTkuNzcgOS41Mzk5NiAxNTEuNjUgMTIuODRDMTUzLjIxIDEzIDE1NC43OCAxMy4xOCAxNTYuMzQgMTMuNEMxODkuODEgMTguMSAyMTkuNDQgMzUuNTYgMjM5Ljc5IDYyLjU1TDI0Ny43MiA1Ni41OEMyMjUuMDQgMjYuNDkgMTkyLjMxIDguNDI5OTYgMTU3LjczIDMuNTY5OTZDMTU2LjE3IDMuMzQ5OTYgMTU0LjYxIDMuMTY5OTYgMTUzLjA0IDIuOTk5OTZDMTE5Ljg2IC0wLjUwMDA0NSA4NS4zNCA4LjA2OTk2IDU2LjYgMjkuNzJDLTMuNTg5OTggNzUuMDggLTE1LjYxIDE2MC42NCAyOS43NCAyMjAuODNDNTEuMDcgMjQ5LjE0IDgxLjMxIDI2Ni43OCAxMTMuNjEgMjcyLjgyTDExNC45OCAyNjIuOThIMTE0Ljk5WiIgZmlsbD0iIzEwMUIzQiIvPgo8cGF0aCBkPSJNNDAuNyAyMzYuODRDMzYuMTQgMjMyLjI4IDMxLjg4IDIyNy4zOCAyNy45NSAyMjIuMTdDNS42NjAwMSAxOTIuNTkgLTMuNzc5OTkgMTU2LjA5IDEuMzgwMDEgMTE5LjRDNi41MzAwMSA4Mi43MSAyNS42NyA1MC4yMyA1NS4yNSAyNy45M0M4My40MSA2LjcyMDAxIDExOC4yMSAtMi45Mjk5OSAxNTMuMjYgMC43ODAwMTRDMTU1LjA3IDAuOTcwMDE0IDE1Ni41OSAxLjE1MDAxIDE1OC4wMyAxLjM2MDAxQzE5NC43MiA2LjUyMDAxIDIyNy4yIDI1LjY1IDI0OS41IDU1LjI0TDI1MC44NSA1Ny4wM0wyMzkuMzUgNjUuN0wyMzggNjMuOTFDMjE4LjAyIDM3LjQgMTg4LjkxIDIwLjI1IDE1Ni4wMyAxNS42M0MxNTQuNjUgMTUuNDQgMTUzLjE0IDE1LjI1IDE1MS40MiAxNS4wOEMxMjAuMTUgMTEuODQgODkuMDggMjAuNSA2My45MyAzOS40NUMzNy40MiA1OS40MyAyMC4yNyA4OC41NCAxNS42NSAxMjEuNDJDMTEuMDMgMTU0LjMgMTkuNDkgMTg3LjAxIDM5LjQ3IDIxMy41MkM1OC4xIDIzOC4yNCA4NS4wNyAyNTUuMDMgMTE1LjQxIDI2MC43OUwxMTcuNTEgMjYxLjE5TDExNS41MiAyNzUuNDZMMTEzLjIxIDI3NS4wM0M4NS41MyAyNjkuODUgNjAuMzcgMjU2LjUxIDQwLjcxIDIzNi44Nkw0MC43IDIzNi44NFpNMjMzLjQ1IDQzLjU4QzIxMi45OSAyMy4xMiAxODYuNTcgOS44OTAwMSAxNTcuNCA1Ljc5MDAxQzE1Ni4wMSA1LjYwMDAxIDE1NC41NSA1LjQyMDAxIDE1Mi43OSA1LjIzMDAxQzExOC44NyAxLjY1MDAxIDg1LjE5IDEwLjk4IDU3Ljk1IDMxLjUxQzI5LjMyIDUzLjA5IDEwLjggODQuNTIgNS44MTAwMSAxMjAuMDJDMC44MjAwMDkgMTU1LjUyIDkuOTUwMDEgMTkwLjg0IDMxLjUzIDIxOS40N0M1MS4yNiAyNDUuNjUgNzkuNjYgMjYzLjU4IDExMS43MiAyNzAuMTVMMTEyLjQ3IDI2NC43NUM4MS44OCAyNTguNDIgNTQuNzUgMjQxLjIzIDM1Ljg4IDIxNi4xOUMxNS4xOCAxODguNzIgNi40MjAwMSAxNTQuODMgMTEuMiAxMjAuNzdDMTUuOTkgODYuNzEgMzMuNzUgNTYuNTUgNjEuMjIgMzUuODVDODcuMjggMTYuMjEgMTE5LjQ3IDcuMjUwMDEgMTUxLjg3IDEwLjZDMTUzLjY1IDEwLjc4IDE1NS4yMSAxMC45NyAxNTYuNjUgMTEuMTdDMTg5Ljk3IDE1Ljg1IDIxOS41NiAzMi45NSAyNDAuMjEgNTkuNDJMMjQ0LjU2IDU2LjE0QzI0MS4wOSA1MS42OSAyMzcuMzggNDcuNSAyMzMuNDYgNDMuNTdMMjMzLjQ1IDQzLjU4WiIgZmlsbD0iIzEwMUIzQiIvPgo8cGF0aCBkPSJNMjA2LjczIDQ5LjQ5OTlDMjE5LjI4OSA0OS40OTk5IDIyOS40NyAzOS4zMTg5IDIyOS40NyAyNi43NTk5QzIyOS40NyAxNC4yMDA5IDIxOS4yODkgNC4wMTk5IDIwNi43MyA0LjAxOTlDMTk0LjE3MSA0LjAxOTkgMTgzLjk5IDE0LjIwMDkgMTgzLjk5IDI2Ljc1OTlDMTgzLjk5IDM5LjMxODkgMTk0LjE3MSA0OS40OTk5IDIwNi43MyA0OS40OTk5WiIgZmlsbD0iI0UzQUY2NCIvPgo8cGF0aCBkPSJNMjI0LjI2IDkuMTk5OTVMMjE3LjkyIDE1LjUzOTlDMjIxLjQ4IDE5LjA5OTkgMjIzLjEyIDIzLjk4OTkgMjIyLjQyIDI4Ljk1OTlDMjIxLjIgMzcuNjA5OSAyMTMuMTcgNDMuNjYgMjA0LjUyIDQyLjQ1QzIwMS4wOCA0MS45NyAxOTcuOTggNDAuNDE5OSAxOTUuNTMgMzcuOTc5OUMxOTEuOTcgMzQuNDE5OSAxOTAuMzMgMjkuNTI5OSAxOTEuMDMgMjQuNTQ5OUMxOTIuMjUgMTUuODk5OSAyMDAuMjggOS44NDk5NSAyMDguOTMgMTEuMDU5OUMyMTIuMzcgMTEuNTM5OSAyMTUuNDcgMTMuMDg5OSAyMTcuOTIgMTUuNTI5OUwyMjQuMjYgOS4xODk5NU0yMjQuMjYgOS4xOTk5NUMyMjAuNTggNS41MTk5NSAyMTUuNzMgMi45Njk5NSAyMTAuMTggMi4xODk5NUMxOTYuNjEgMC4yNzk5NDkgMTg0LjA2IDkuNzM5OTUgMTgyLjE2IDIzLjMwOTlDMTgxLjAzIDMxLjMzOTkgMTgzLjg4IDM5IDE4OS4yIDQ0LjMyQzE5Mi44OCA0OCAxOTcuNzMgNTAuNTUgMjAzLjI4IDUxLjMzQzIxNi44NSA1My4yNCAyMjkuNCA0My43Nzk5IDIzMS4zIDMwLjIwOTlDMjMyLjQzIDIyLjE3OTkgMjI5LjU4IDE0LjUxOTkgMjI0LjI2IDkuMTk5OTVaIiBmaWxsPSIjMTAxQjNCIi8+CjwvZz4KPGRlZnM+CjxjbGlwUGF0aCBpZD0iY2xpcDBfMTY3XzEwNCI+CjxyZWN0IHdpZHRoPSIyNTAuODUiIGhlaWdodD0iMjc1LjQ1IiBmaWxsPSJ3aGl0ZSIvPgo8L2NsaXBQYXRoPgo8L2RlZnM+Cjwvc3ZnPgo=";

const isDev = process.env.NODE_ENV === "development";

let mainWindow;

// ─── Stockage fichier ─────────────────────────────────────────────────────────

const STORAGE_CONFIG_FILE = path.join(app.getPath("userData"), "storage-config.json");

function getStorageDir() {
  try {
    if (fs.existsSync(STORAGE_CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(STORAGE_CONFIG_FILE, "utf-8"));
      if (config.storageDir && fs.existsSync(config.storageDir)) {
        return config.storageDir;
      }
    }
  } catch {}
  // Dossier par défaut : Documents/Ploutos
  return path.join(os.homedir(), "Documents", "Ploutos");
}

function ensureStorageDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getClientsFile(userId, storageDir) {
  ensureStorageDir(storageDir);
  return path.join(storageDir, `clients_${userId}.json`);
}

// IPC — Lire les clients
ipcMain.handle("read-clients", (_event, userId) => {
  try {
    const dir = getStorageDir();
    const file = getClientsFile(userId, dir);
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (err) {
    console.error("read-clients error:", err);
    return [];
  }
});

// IPC — Écrire les clients
ipcMain.handle("write-clients", (_event, userId, data) => {
  try {
    const dir = getStorageDir();
    const file = getClientsFile(userId, dir);
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
    return { success: true };
  } catch (err) {
    console.error("write-clients error:", err);
    return { success: false, error: err.message };
  }
});

// IPC — Obtenir le dossier actuel
ipcMain.handle("get-storage-dir", () => {
  return getStorageDir();
});

// IPC — Choisir un nouveau dossier (ex: OneDrive)
ipcMain.handle("set-storage-dir", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choisir le dossier de stockage Ploutos",
    defaultPath: getStorageDir(),
    properties: ["openDirectory", "createDirectory"],
    buttonLabel: "Choisir ce dossier",
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const newDir = result.filePaths[0];
    fs.writeFileSync(STORAGE_CONFIG_FILE, JSON.stringify({ storageDir: newDir }), "utf-8");
    return { success: true, path: newDir };
  }
  return { success: false };
});


// ─── Stockage paramètres cabinet ─────────────────────────────────────────────

function getCabinetFile(storageDir) {
  ensureStorageDir(storageDir);
  return path.join(storageDir, "cabinet.json");
}

ipcMain.handle("read-cabinet", (_event) => {
  try {
    const dir = getStorageDir();
    const file = getCabinetFile(dir);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (err) {
    console.error("read-cabinet error:", err);
    return null;
  }
});

ipcMain.handle("write-cabinet", (_event, data) => {
  try {
    const dir = getStorageDir();
    const file = getCabinetFile(dir);
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
    return { success: true };
  } catch (err) {
    console.error("write-cabinet error:", err);
    return { success: false, error: err.message };
  }
});

// ─── Fenêtre principale ───────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Ploutos",
    icon: nativeImage.createFromDataURL(`data:image/svg+xml;base64,${APP_ICON_B64}`),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    backgroundColor: "#F8F6F7",
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Autoriser les popups internes (PDFs générés en blob://)
    if (url.startsWith("blob:") || url === "about:blank") {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 1000,
          height: 800,
          title: "Ploutos — Document",
          webPreferences: { contextIsolation: true, nodeIntegration: false },
        }
      };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ─── Menu natif ───────────────────────────────────────────────────────────────

function buildMenu() {
  const template = [
    {
      label: "Fichier",
      submenu: [
        {
          label: "Accueil — Dossiers clients",
          accelerator: "CmdOrCtrl+H",
          click: () => mainWindow?.webContents.send("go-home"),
        },
        { type: "separator" },
        {
          label: "Changer le dossier de stockage...",
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              title: "Choisir le dossier de stockage Ploutos",
              defaultPath: getStorageDir(),
              properties: ["openDirectory", "createDirectory"],
              buttonLabel: "Choisir ce dossier",
            });
            if (!result.canceled && result.filePaths.length > 0) {
              const newDir = result.filePaths[0];
              fs.writeFileSync(STORAGE_CONFIG_FILE, JSON.stringify({ storageDir: newDir }), "utf-8");
              dialog.showMessageBox(mainWindow, {
                type: "info",
                title: "Dossier modifié",
                message: "Dossier de stockage mis à jour",
                detail: `Les données seront désormais stockées dans :\n${newDir}\n\nRedémarrez l'application pour appliquer le changement.`,
              });
            }
          },
        },
        {
          label: "Ouvrir le dossier de stockage",
          click: () => shell.openPath(getStorageDir()),
        },
        { type: "separator" },
        {
          label: "Quitter",
          accelerator: "CmdOrCtrl+Q",
          click: () => app.quit(),
        },
      ],
    },
    {
      label: "Affichage",
      submenu: [
        { role: "reload", label: "Recharger" },
        { role: "forceReload", label: "Forcer le rechargement" },
        { type: "separator" },
        { role: "resetZoom", label: "Zoom par défaut" },
        { role: "zoomIn", label: "Zoom +" },
        { role: "zoomOut", label: "Zoom -" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Plein écran" },
      ],
    },
    {
      label: "Aide",
      submenu: [
        {
          label: "Signaler un bug",
          click: () => {
            // Récupérer le nom du conseiller depuis le fichier cabinet
            let conseillerName = "Utilisateur";
            try {
              const dir = getStorageDir();
              const cabinetFile = getCabinetFile(dir);
              if (fs.existsSync(cabinetFile)) {
                const cabinet = JSON.parse(fs.readFileSync(cabinetFile, "utf-8"));
                if (cabinet.conseiller) conseillerName = cabinet.conseiller;
              }
            } catch {}

            const subject = encodeURIComponent(`Bug découvert par ${conseillerName}`);
            const body = encodeURIComponent(
`Bonjour,

Je souhaite signaler un bug sur l'application Ploutos.

────────────────────────────────
Description du bug :
[Décrivez ici le problème rencontré]

Étapes pour reproduire :
1. 
2. 
3. 

Page / module concerné :
[Ex : Collecte patrimoniale, Immobilier, Succession, PDF Rapport...]

Comportement observé :
[Ce qui se passe actuellement]

Comportement attendu :
[Ce qui devrait se passer]
────────────────────────────────

Version de l'application : ${app.getVersion()}
Système : ${process.platform} ${process.arch}

Cordialement,
${conseillerName}`
            );
            shell.openExternal(`mailto:contact@ecopatrimoine-conseil.com?subject=${subject}&body=${body}`);
          },
        },
        {
          label: "Faire une suggestion",
          click: () => {
            let conseillerName = "Utilisateur";
            try {
              const dir = getStorageDir();
              const cabinetFile = getCabinetFile(dir);
              if (fs.existsSync(cabinetFile)) {
                const cabinet = JSON.parse(fs.readFileSync(cabinetFile, "utf-8"));
                if (cabinet.conseiller) conseillerName = cabinet.conseiller;
              }
            } catch {}

            const subject = encodeURIComponent(`Suggestion de ${conseillerName}`);
            const body = encodeURIComponent(
`Bonjour,

Je souhaite soumettre une suggestion d'amélioration pour l'application Ploutos.

────────────────────────────────
Ma suggestion :
[Décrivez ici votre idée]

Module / fonctionnalité concerné(e) :
[Ex : Collecte patrimoniale, Immobilier, Succession, PDF Rapport...]

Pourquoi cette amélioration serait utile :
[Expliquez le bénéfice attendu]

Contexte d'utilisation :
[Dans quelle situation avez-vous ressenti ce besoin ?]
────────────────────────────────

Version de l'application : ${app.getVersion()}
Système : ${process.platform} ${process.arch}

Cordialement,
${conseillerName}`
            );
            shell.openExternal(`mailto:contact@ecopatrimoine-conseil.com?subject=${subject}&body=${body}`);
          },
        },
        { type: "separator" },
        {
          label: "À propos de Ploutos",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "Ploutos",
              message: "Ploutos",
              detail: `Version ${app.getVersion()}\n\nLogiciel de gestion patrimoniale pour CGP.\n\n© Ploutos`,
            });
          },
        },
        {
          label: "Site web",
          click: () => shell.openExternal("https://ecopatrimoine-conseil.com"),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ─── App events ───────────────────────────────────────────────────────────────

// ─── Auto-updater ─────────────────────────────────────────────────────────────

function setupAutoUpdater() {
  // Ne pas vérifier en mode dev
  if (process.env.NODE_ENV === "development") return;

  autoUpdater.autoDownload = true;        // Téléchargement silencieux
  autoUpdater.autoInstallOnAppQuit = true; // Installer à la fermeture

  // Logs pour débogage
  autoUpdater.logger = require("electron-log");
  autoUpdater.logger.transports.file.level = "info";

  // Vérifier les MAJ au démarrage (après 3 secondes)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error("Erreur vérification MAJ:", err.message);
    });
  }, 3000);

  // MAJ disponible → téléchargement silencieux automatique
  autoUpdater.on("update-available", (info) => {
    console.log("Mise à jour disponible :", info.version);
    // Notifier l'interface React (optionnel)
    mainWindow?.webContents.send("update-available", info.version);
  });

  // MAJ téléchargée → notifier à la fermeture
  autoUpdater.on("update-downloaded", (info) => {
    console.log("Mise à jour téléchargée :", info.version);
    // Proposer de redémarrer
    dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Mise à jour prête",
      message: `Ploutos ${info.version} est prêt à installer`,
      detail: "La mise à jour sera installée automatiquement à la prochaine fermeture de l'application.\n\nVoulez-vous redémarrer maintenant ?",
      buttons: ["Redémarrer maintenant", "Plus tard"],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

  autoUpdater.on("error", (err) => {
    console.error("Auto-updater error:", err.message);
  });
}


app.setAppUserModelId("com.ploutos.app");

app.whenReady().then(() => {
  // Icône barre des tâches Windows
  if (process.platform === "win32") {
    app.setAppUserModelId("com.ploutos.app");
  }
  createWindow();
  buildMenu();
  setupAutoUpdater();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("web-contents-created", (_, contents) => {
  contents.on("will-navigate", (event, url) => {
    const parsedUrl = new URL(url);
    if (isDev && parsedUrl.hostname === "localhost") return;
    event.preventDefault();
    shell.openExternal(url);
  });
});
