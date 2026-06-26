/// <reference types="vite/client" />

interface Window {
  memoTaskNative?: {
    platform: "desktop";
    version: number;
    notify?: (input: { title: string; body: string }) => void;
  };
  Capacitor?: {
    getPlatform?: () => string;
  };
  memoTaskPendingCaptures?: unknown[];
}
