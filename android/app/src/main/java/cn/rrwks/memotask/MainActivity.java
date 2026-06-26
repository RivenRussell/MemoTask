package cn.rrwks.memotask;

import android.content.Intent;
import org.json.JSONObject;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private JSONObject pendingShareDetail;
    private int pendingShareAttempts;

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        captureSharedText(intent);
        flushPendingShare();
    }

    @Override
    public void onResume() {
        super.onResume();
        captureSharedText(getIntent());
        flushPendingShare();
    }

    private void captureSharedText(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) {
            return;
        }

        String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (sharedText == null || sharedText.trim().isEmpty()) {
            return;
        }

        try {
            JSONObject detail = new JSONObject();
            detail.put("title", intent.getStringExtra(Intent.EXTRA_SUBJECT) == null ? "" : intent.getStringExtra(Intent.EXTRA_SUBJECT));
            detail.put("content", sharedText);
            detail.put("source", "android-share");
            detail.put("receivedAt", new java.util.Date().toInstant().toString());
            pendingShareDetail = detail;
            pendingShareAttempts = 0;
        } catch (Exception ignored) {
        }
    }

    private void flushPendingShare() {
        if (pendingShareDetail == null || getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        getBridge().getWebView().postDelayed(() -> {
            if (pendingShareDetail == null || getBridge() == null || getBridge().getWebView() == null) {
                return;
            }

            JSONObject detail = pendingShareDetail;
            String script =
                "(function(){"
                    + "if(document.readyState==='loading'||!window.dispatchEvent){return false;}"
                    + "window.memoTaskPendingCaptures=window.memoTaskPendingCaptures||[];"
                    + "window.memoTaskPendingCaptures.push(" + detail.toString() + ");"
                    + "window.dispatchEvent(new CustomEvent('memotask:native-capture',{detail:" + detail.toString() + "}));"
                    + "return true;"
                    + "})()";
            getBridge().getWebView().evaluateJavascript(script, value -> {
                if ("true".equals(value)) {
                    pendingShareDetail = null;
                    pendingShareAttempts = 0;
                    Intent intent = getIntent();
                    if (intent != null) {
                        intent.setAction(Intent.ACTION_MAIN);
                    }
                    return;
                }

                pendingShareAttempts += 1;
                if (pendingShareAttempts < 40) {
                    flushPendingShare();
                }
            });
        }, 250);
    }
}
