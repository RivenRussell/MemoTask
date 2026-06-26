const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("memoTaskNative", {
  platform: "desktop",
  version: 1,
  notify(input) {
    ipcRenderer.send("memotask:notify", input);
  }
});
