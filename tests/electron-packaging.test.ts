import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readText(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("Electron packaging contract", () => {
  it("declares the Electron entry point and build scripts", () => {
    const packageJson = JSON.parse(readText("package.json")) as {
      main?: string;
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.main).toBe("electron/main.cjs");
    expect(packageJson.scripts?.["electron:pack"]).toBe(
      "npm run build && electron-builder --dir --config electron-builder.yml"
    );
    expect(packageJson.scripts?.["electron:build"]).toBe(
      "npm run build && electron-builder --win --config electron-builder.yml"
    );
    expect(packageJson.devDependencies?.electron).toBeDefined();
    expect(packageJson.devDependencies?.["electron-builder"]).toBeDefined();
  });

  it("packages the Vite dist directory with a local Electron main process", () => {
    expect(existsSync(path.join(root, "electron", "main.cjs"))).toBe(true);
    expect(existsSync(path.join(root, "electron", "preload.cjs"))).toBe(true);
    expect(existsSync(path.join(root, "electron-builder.yml"))).toBe(true);

    const mainProcess = readText("electron/main.cjs");
    const preload = readText("electron/preload.cjs");
    const builderConfig = readText("electron-builder.yml");

    expect(mainProcess).toContain("BrowserWindow");
    expect(mainProcess).toContain("loadFile");
    expect(mainProcess).toContain("dist");
    expect(mainProcess).toContain("preload:");
    expect(mainProcess).toContain("ipcMain.handle");
    expect(mainProcess).toContain("memotask:hide-to-tray");
    expect(mainProcess).toContain("Tray");
    expect(mainProcess).toContain("Menu.buildFromTemplate");
    expect(mainProcess).toContain("mainWindow.on(\"minimize\"");
    expect(mainProcess).toContain("app.isPackaged");
    expect(mainProcess).toContain("process.resourcesPath");
    expect(mainProcess).toContain("app.asar.unpacked");
    expect(mainProcess).toContain("src-tauri");
    expect(mainProcess).toContain("icon.ico");
    expect(preload).toContain("contextBridge.exposeInMainWorld");
    expect(preload).toContain("memotaskDesktop");
    expect(preload).toContain("hideToTray");
    expect(builderConfig).toContain("appId: cn.rrwks.memotask");
    expect(builderConfig).toContain("directories:");
    expect(builderConfig).toContain("output: release/electron");
    expect(builderConfig).toContain("electronDist: node_modules/electron/dist");
    expect(builderConfig).toContain("signAndEditExecutable: false");
    expect(builderConfig).toContain("signExecutable: false");
    expect(builderConfig).toContain("dist/**/*");
    expect(builderConfig).toContain("electron/**/*");
    expect(builderConfig).toContain("src-tauri/icons/**/*");
    expect(builderConfig).toContain("asarUnpack:");
    expect(builderConfig).toContain("src-tauri/icons/icon.ico");
  });
});
