const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { app, BrowserWindow, Menu, Notification, Tray, globalShortcut, ipcMain, shell } = require("electron");
const {
  DEFAULT_LOCAL_APP_PORT,
  QUICK_CAPTURE_SHORTCUT,
  getDistIndexPath,
  getLocalAppUrl,
  getMainWindowOptions,
  getQuickCaptureWindowOptions,
  isPathInsideDistRoot,
  shouldOpenExternally
} = require("./app-config.cjs");

let mainWindow = null;
let quickCaptureWindow = null;
let localServer = null;
let tray = null;

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".webmanifest", "application/manifest+json; charset=utf-8"]
]);

function startLocalServer(appRoot) {
  const distRoot = path.dirname(getDistIndexPath(appRoot));
  let triedFallbackPort = false;
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      const pathname = decodeURIComponent(url.pathname);
      const candidatePath = path.normalize(path.join(distRoot, pathname === "/" ? "index.html" : pathname));
      const filePath = isPathInsideDistRoot(candidatePath, distRoot) && fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()
        ? candidatePath
        : getDistIndexPath(appRoot);
      response.setHeader("content-type", contentTypes.get(path.extname(filePath)) || "application/octet-stream");
      fs.createReadStream(filePath).pipe(response);
    });

    server.on("error", (error) => {
      if (!triedFallbackPort && error.code === "EADDRINUSE") {
        triedFallbackPort = true;
        server.listen(0, "127.0.0.1");
        return;
      }

      reject(error);
    });
    server.listen(DEFAULT_LOCAL_APP_PORT, "127.0.0.1", () => resolve(server));
  });
}

function createMainWindow(port) {
  mainWindow = new BrowserWindow(getMainWindowOptions(app.getAppPath()));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (shouldOpenExternally(url)) {
      shell.openExternal(url);
      return { action: "deny" };
    }

    return { action: "allow" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (shouldOpenExternally(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.loadURL(getLocalAppUrl(port));
}

function createQuickCaptureWindow(port) {
  if (quickCaptureWindow && !quickCaptureWindow.isDestroyed()) {
    quickCaptureWindow.show();
    quickCaptureWindow.focus();
    return quickCaptureWindow;
  }

  quickCaptureWindow = new BrowserWindow(getQuickCaptureWindowOptions(app.getAppPath()));
  quickCaptureWindow.loadURL(`${getLocalAppUrl(port)}capture`);
  quickCaptureWindow.once("ready-to-show", () => {
    quickCaptureWindow?.show();
    quickCaptureWindow?.focus();
  });
  quickCaptureWindow.on("closed", () => {
    quickCaptureWindow = null;
  });
  return quickCaptureWindow;
}

function showMainWindow(port) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow(port);
    return;
  }

  mainWindow.show();
  mainWindow.focus();
}

function setupTray(port) {
  const iconPath = path.join(app.getAppPath(), "electron", "assets", "tray.png");
  tray = new Tray(iconPath);
  tray.setToolTip("MemoTask");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "打开 MemoTask", click: () => showMainWindow(port) },
      { label: "快速记录", click: () => createQuickCaptureWindow(port) },
      { type: "separator" },
      { label: "退出", click: () => app.quit() }
    ])
  );
  tray.on("click", () => showMainWindow(port));
}

function setupShortcuts(port) {
  globalShortcut.register(QUICK_CAPTURE_SHORTCUT, () => {
    createQuickCaptureWindow(port);
  });
}

app.whenReady().then(async () => {
  localServer = await startLocalServer(app.getAppPath());
  const port = localServer.address().port;
  createMainWindow(port);
  setupTray(port);
  setupShortcuts(port);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(port);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  localServer?.close();
  localServer = null;
});

ipcMain.on("memotask:notify", (_event, input) => {
  if (!Notification.isSupported()) {
    return;
  }

  const title = typeof input?.title === "string" ? input.title : "MemoTask";
  const body = typeof input?.body === "string" ? input.body : "";
  new Notification({ title, body }).show();
});
