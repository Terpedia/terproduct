package com.terpedia.terproduct;

import android.content.Intent;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
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
