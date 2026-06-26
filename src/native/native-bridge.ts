export type ExternalCaptureSource = "desktop" | "android-share";

export interface ExternalCapturePayload {
  title: string;
  content: string;
  source: ExternalCaptureSource;
  receivedAt: string;
}

type ExternalCaptureInput = Partial<ExternalCapturePayload> & {
  content?: unknown;
};

export interface NativeBridge {
  platform: "web" | "desktop" | "android";
  onExternalCapture: (callback: (payload: ExternalCapturePayload) => void) => () => void;
  notifyCaptureSaved: (message: string) => void;
  notifyCaptureFailed: (message: string) => void;
}

const nativeCaptureEventName = "memotask:native-capture";

export function createNativeBridge(targetWindow: Window = window): NativeBridge {
  const platform = resolvePlatform(targetWindow);
  return {
    platform,
    onExternalCapture(callback) {
      const listener = (event: Event) => {
        const detail = event instanceof CustomEvent ? event.detail : undefined;
        const payload = normalizeExternalCapture(detail);
        if (payload) {
          callback(payload);
        }
      };

      targetWindow.addEventListener(nativeCaptureEventName, listener);
      drainPendingCaptures(targetWindow, callback);
      return () => targetWindow.removeEventListener(nativeCaptureEventName, listener);
    },
    notifyCaptureSaved(message) {
      notify(targetWindow, "MemoTask 已记录", message);
    },
    notifyCaptureFailed(message) {
      notify(targetWindow, "MemoTask 记录失败", message);
    }
  };
}

export function normalizeExternalCapture(input: ExternalCaptureInput | undefined): ExternalCapturePayload | null {
  const content = typeof input?.content === "string" ? input.content.trim() : "";
  if (!content) {
    return null;
  }

  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const source = input?.source === "android-share" ? "android-share" : "desktop";
  const receivedAt = typeof input?.receivedAt === "string" && input.receivedAt.trim() ? input.receivedAt : new Date().toISOString();

  return { title, content, source, receivedAt };
}

function drainPendingCaptures(targetWindow: Window, callback: (payload: ExternalCapturePayload) => void): void {
  const pendingCaptures = targetWindow.memoTaskPendingCaptures;
  if (!Array.isArray(pendingCaptures) || pendingCaptures.length === 0) {
    return;
  }

  targetWindow.memoTaskPendingCaptures = [];
  for (const pendingCapture of pendingCaptures) {
    const payload = normalizeExternalCapture(pendingCapture as ExternalCaptureInput);
    if (payload) {
      callback(payload);
    }
  }
}

function resolvePlatform(targetWindow: Window): NativeBridge["platform"] {
  if (targetWindow.memoTaskNative?.platform === "desktop") {
    return "desktop";
  }

  if (targetWindow.Capacitor?.getPlatform?.() === "android") {
    return "android";
  }

  return "web";
}

function notify(targetWindow: Window, title: string, body: string): void {
  if (targetWindow.memoTaskNative?.notify) {
    targetWindow.memoTaskNative.notify({ title, body });
    return;
  }

  if ("Notification" in targetWindow && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}
