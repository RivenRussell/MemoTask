import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface PackageJson {
  version: string;
  main?: string;
  scripts?: Record<string, string>;
  build?: {
    appId?: string;
    productName?: string;
    icon?: string;
    directories?: {
      output?: string;
    };
    win?: {
      target?: string | string[];
    };
    nsis?: {
      oneClick?: boolean;
      perMachine?: boolean;
    };
  };
}

function readPackageJson(): PackageJson {
  return JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as PackageJson;
}

describe("desktop package configuration", () => {
  it("declares the v3 Electron entrypoint and build scripts", () => {
    const packageJson = readPackageJson();

    expect(packageJson.version).toBe("3.0.0");
    expect(packageJson.main).toBe("electron/main.cjs");
    expect(packageJson.scripts).toMatchObject({
      "build:desktop": "tsc --noEmit && vite build --mode desktop",
      "desktop:build": "npm run build:desktop && cross-env ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/ electron-builder --win nsis --publish never",
      "build:android": "tsc --noEmit && vite build --mode android",
      "android:sync": "npm run build:android && cap sync android",
      "android:apk": "npm run android:sync && powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-android-apk.ps1"
    });
  });

  it("targets a Windows NSIS installer in the desktop release directory", () => {
    const packageJson = readPackageJson();

    expect(packageJson.build).toMatchObject({
      appId: "cn.rrwks.memotask",
      productName: "MemoTask",
      electronDist: "node_modules/electron/dist",
      icon: "electron/assets/icon.ico",
      directories: {
        output: "release/desktop"
      },
      win: {
        target: "nsis"
      },
      nsis: {
        oneClick: false,
        perMachine: false
      }
    });
  });
});
