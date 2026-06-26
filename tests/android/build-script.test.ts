import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Android APK build script", () => {
  it("uses a local JDK 11+ before invoking Gradle", () => {
    const scriptPath = path.join(process.cwd(), "scripts", "build-android-apk.ps1");

    expect(existsSync(scriptPath)).toBe(true);

    const script = readFileSync(scriptPath, "utf8");
    expect(script).toContain("C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.11.10-hotspot");
    expect(script).toContain("C:\\Program Files\\Android\\Android Studio\\jbr");
    expect(script).toContain("JAVA_HOME");
    expect(script).toContain("--init-script");
    expect(script).toContain("mirror-repositories.gradle");
    expect(script).toContain("assembleRelease");
    expect(script).not.toContain("assembleDebug");
  });
});
