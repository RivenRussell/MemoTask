import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

describe("Capacitor Android configuration", () => {
  it("packages the Vite build output into a MemoTask Android app", async () => {
    const configModule = (await import(pathToFileURL(`${process.cwd()}/capacitor.config.ts`).href)) as {
      default: {
        appId: string;
        appName: string;
        webDir: string;
        server?: {
          androidScheme?: string;
        };
      };
    };

    expect(configModule.default).toMatchObject({
      appId: "cn.rrwks.memotask",
      appName: "MemoTask",
      webDir: "dist",
      server: {
        androidScheme: "https"
      }
    });
  });
});
