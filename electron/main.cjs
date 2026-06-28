const { app, BrowserWindow, Menu, Tray, ipcMain, shell } = require("electron");
const path = require("node:path");

let tray = null;
let isQuitting = false;

function getTrayIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app.asar.unpacked", "src-tauri", "icons", "icon.ico");
  }
  return path.join(__dirname, "..", "src-tauri", "icons", "icon.ico");
}

function showWindow(window) {
  if (!window || window.isDestroyed()) {
    return;
  }
  window.show();
  if (window.isMinimized()) {
    window.restore();
  }
  window.focus();
}

function ensureTray(window) {
  if (tray) {
    return tray;
  }

  tray = new Tray(getTrayIconPath());
  tray.setToolTip("MemoTask");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "显示 MemoTask",
        click: () => showWindow(window)
      },
      {
        label: "退出",
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ])
  );
  tray.on("click", () => showWindow(window));
  return tray;
}

function hideWindowToTray(window) {
  ensureTray(window);
  window.hide();
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 960,
    minHeight: 640,
    title: "MemoTask",
    backgroundColor: "#f7f4ef",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.on("minimize", (event) => {
    if (isQuitting) {
      return;
    }
    event.preventDefault();
    hideWindowToTray(mainWindow);
  });

  mainWindow.on("close", (event) => {
    if (isQuitting) {
      return;
    }
    event.preventDefault();
    hideWindowToTray(mainWindow);
  });
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle("memotask:hide-to-tray", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      return;
    }
    hideWindowToTray(window);
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      showWindow(BrowserWindow.getAllWindows()[0]);
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
