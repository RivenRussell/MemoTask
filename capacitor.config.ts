import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "cn.rrwks.memotask",
  appName: "MemoTask",
  webDir: "dist",
  server: {
    androidScheme: "https"
  }
};

export default config;
