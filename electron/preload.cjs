const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("memotaskDesktop", {
  hideToTray: () => ipcRenderer.invoke("memotask:hide-to-tray")
});
