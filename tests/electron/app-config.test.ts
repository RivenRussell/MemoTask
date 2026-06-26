import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

interface ElectronAppConfig {
  DEFAULT_LOCAL_APP_PORT: number;
  getDistIndexPath(appRoot: string): string;
  getLocalAppUrl(port: number): string;
  getMainWindowOptions(appRoot: string): unknown;
  getQuickCaptureWindowOptions(appRoot: string): unknown;
  isPathInsideDistRoot(candidatePath: string, distRoot: string): boolean;
  shouldOpenExternally(url: string): boolean;
  QUICK_CAPTURE_SHORTCUT: string;
}

describe("Electron app configuration", () => {
  it("loads the bundled React index from dist", () => {
    const { getDistIndexPath } = require("../../electron/app-config.cjs") as ElectronAppConfig;

    expect(getDistIndexPath("C:/MemoTask")).toBe(path.join("C:/MemoTask", "dist", "index.html"));
  });

  it("loads bundled assets through a loopback app origin instead of file URLs", () => {
    const { getLocalAppUrl, shouldOpenExternally } = require("../../electron/app-config.cjs") as ElectronAppConfig;

    expect(getLocalAppUrl(48231)).toBe("http://127.0.0.1:48231/");
    expect(shouldOpenExternally("http://127.0.0.1:48231/")).toBe(false);
  });

  it("uses isolated renderer settings for the main window", () => {
    const { getMainWindowOptions } = require("../../electron/app-config.cjs") as ElectronAppConfig;

    expect(getMainWindowOptions("C:/MemoTask")).toMatchObject({
      width: 1180,
      height: 820,
      minWidth: 960,
      minHeight: 680,
      title: "MemoTask",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join("C:/MemoTask", "electron", "preload.cjs")
      }
    });
  });

  it("opens http links outside the app shell", () => {
    const { shouldOpenExternally } = require("../../electron/app-config.cjs") as ElectronAppConfig;

    expect(shouldOpenExternally("https://memotask.rrwks.cn/reset-password")).toBe(true);
    expect(shouldOpenExternally("http://127.0.0.1:48231/api")).toBe(false);
    expect(shouldOpenExternally("file:///C:/MemoTask/dist/index.html")).toBe(false);
  });

  it("uses a stable default loopback port so app localStorage survives desktop restarts", () => {
    const { DEFAULT_LOCAL_APP_PORT, getLocalAppUrl } = require("../../electron/app-config.cjs") as ElectronAppConfig;

    expect(DEFAULT_LOCAL_APP_PORT).toBe(47839);
    expect(getLocalAppUrl(DEFAULT_LOCAL_APP_PORT)).toBe("http://127.0.0.1:47839/");
  });

  it("keeps loopback static file resolution inside the dist root", () => {
    const { isPathInsideDistRoot } = require("../../electron/app-config.cjs") as ElectronAppConfig;

    expect(isPathInsideDistRoot(path.join("C:/MemoTask", "dist", "assets", "index.js"), path.join("C:/MemoTask", "dist"))).toBe(true);
    expect(isPathInsideDistRoot(path.join("C:/MemoTask", "distx", "secret.txt"), path.join("C:/MemoTask", "dist"))).toBe(false);
    expect(isPathInsideDistRoot(path.join("C:/MemoTask", "secrets.txt"), path.join("C:/MemoTask", "dist"))).toBe(false);
  });

  it("defines the desktop quick capture shortcut and compact window", () => {
    const { getQuickCaptureWindowOptions, QUICK_CAPTURE_SHORTCUT } = require("../../electron/app-config.cjs") as ElectronAppConfig;

    expect(QUICK_CAPTURE_SHORTCUT).toBe("CommandOrControl+Alt+M");
    expect(getQuickCaptureWindowOptions("C:/MemoTask")).toMatchObject({
      width: 520,
      height: 620,
      title: "MemoTask 快速记录",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join("C:/MemoTask", "electron", "preload.cjs")
      }
    });
  });
});
