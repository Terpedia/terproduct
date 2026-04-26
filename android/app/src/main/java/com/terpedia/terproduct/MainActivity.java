package com.terpedia.terproduct;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(TerproductDevicePlugin.class);
    super.onCreate(savedInstanceState);
  }

  /**
   * Pushes a subset of hardware key events to the WebView. Many PDA
   * side/scan keys never reach the DOM; {@code isPrintingKey} filters
   * ordinary wedge digits/letters (still visible via normal key events) so
   * the log is not swamped. Adjust if your device maps the side key to a
   * "printing" keycode and use the in-page logger with "all keys" instead.
   */
  @Override
  public boolean dispatchKeyEvent(KeyEvent event) {
    if (getBridge() != null) {
      int kc = event.getKeyCode();
      if (kc != KeyEvent.KEYCODE_VOLUME_UP
          && kc != KeyEvent.KEYCODE_VOLUME_DOWN
          && kc != KeyEvent.KEYCODE_POWER) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || !event.isPrintingKey()) {
          Bridge b = getBridge();
          if (b != null) {
            WebView wv = b.getWebView();
            if (wv != null) {
              int action = event.getAction();
              int sc = event.getScanCode();
              int repeat = event.getRepeatCount();
              int source = event.getSource();
              String safe =
                  String.format(
                      "window.dispatchEvent(new CustomEvent('terproduct-native-key',{detail:{"
                          + "keyCode:%d,action:%d,scanCode:%d,repeat:%d,source:%d}}))void 0",
                      kc, action, sc, repeat, source);
              wv.post(() -> wv.evaluateJavascript(safe, null));
            }
          }
        }
      }
    }
    return super.dispatchKeyEvent(event);
  }

  /**
   * Single-activity: VIEW and custom intents must replace getIntent() so
   * Capacitor can surface appUrlOpen / getLaunchUrl on the WebView.
   */
  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
  }
}
