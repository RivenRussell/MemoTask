/// <reference types="vite/client" />

interface Window {
  memotaskDesktop?: {
    hideToTray: () => Promise<void>;
  };
}
