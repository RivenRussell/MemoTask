const path = require("node:path");

const DEFAULT_LOCAL_APP_PORT = 47839;
const QUICK_CAPTURE_SHORTCUT = "CommandOrControl+Alt+M";

function getDistIndexPath(appRoot) {
  return path.join(appRoot, "dist", "index.html");
}

function getPreloadPath(appRoot) {
  return path.join(appRoot, "electron", "preload.cjs");
}

function getLocalAppUrl(port) {
  return `http://127.0.0.1:${port}/`;
}

function isPathInsideDistRoot(candidatePath, distRoot) {
  const relativePath = path.relative(distRoot, candidatePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function getMainWindowOptions(appRoot) {
  return {
    width: 1180,
    height: 820,
    minWidth: 960,
    minHeight: 680,
    title: "MemoTask",
    backgroundColor: "#eef3f5",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: getPreloadPath(appRoot)
    }
  };
}

function getQuickCaptureWindowOptions(appRoot) {
  return {
    width: 520,
    height: 620,
    minWidth: 420,
    minHeight: 520,
    title: "MemoTask 快速记录",
    backgroundColor: "#eef3f5",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: getPreloadPath(appRoot)
    }
  };
}

function shouldOpenExternally(url) {
  if (url.startsWith("http://127.0.0.1:")) {
    return false;
  }

  return url.startsWith("http://") || url.startsWith("https://");
}

module.exports = {
  DEFAULT_LOCAL_APP_PORT,
  QUICK_CAPTURE_SHORTCUT,
  getDistIndexPath,
  getLocalAppUrl,
  getMainWindowOptions,
  getQuickCaptureWindowOptions,
  getPreloadPath,
  isPathInsideDistRoot,
  shouldOpenExternally
};
