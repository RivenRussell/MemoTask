import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const isBundledApp = mode === "desktop" || mode === "android";

  return {
    base: isBundledApp ? "./" : "/",
    plugins: [react()]
  };
});
