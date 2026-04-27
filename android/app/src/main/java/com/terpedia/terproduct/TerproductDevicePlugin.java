package com.terpedia.terproduct;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.util.Base64;
import android.util.Log;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import androidx.print.PrintHelper;

/**
 * Exposes the standard Android print UI ({@link PrintManager} path via
 * {@link PrintHelper#printBitmap}) so an integrated 58mm thermal that registers
 * as a print service can be chosen. External serial Bluetooth thermals are a
 * different path (see JS + Bluetooth SPP).
 */
@CapacitorPlugin(name = "TerproductDevice")
public class TerproductDevicePlugin extends Plugin {
  private static final String TAG = "TerproductDevice";

  public void printPngDataUrl(PluginCall call) {
    String data = call.getString("data", "");
    if (data == null || data.isEmpty()) {
      call.reject("data is required (PNG as data URL or base64)");
      return;
    }
    int idx = data.indexOf("base64,");
    if (idx >= 0) {
      data = data.substring(idx + "base64,".length());
    }
    byte[] bytes;
    try {
      bytes = Base64.decode(data.trim(), Base64.DEFAULT);
    } catch (IllegalArgumentException e) {
      call.reject("Invalid base64: " + e.getMessage());
      return;
    }
    Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
    if (bmp == null) {
      call.reject("Could not decode PNG");
      return;
    }
    runPrintBitmapOnUi(call, bmp);
  }

  public void printTextAsBitmap(PluginCall call) {
    String text = call.getString("text");
    if (text == null || text.isEmpty()) {
      text = "Terproduct\nSystem print test\n" + new java.util.Date();
    }
    Bitmap bmp = renderTextBitmap(text);
    runPrintBitmapOnUi(call, bmp);
  }

  private void runPrintBitmapOnUi(final PluginCall call, final Bitmap bmp) {
    Activity a = getActivity();
    if (a == null) {
      call.reject("No activity");
      if (bmp != null && !bmp.isRecycled()) {
        bmp.recycle();
      }
      return;
    }
    a.runOnUiThread(
        () -> {
          if (bmp == null || bmp.isRecycled()) {
            call.reject("Invalid bitmap");
            return;
          }
          try {
            PrintHelper ph = new PrintHelper(a);
            ph.setScaleMode(PrintHelper.SCALE_MODE_FIT);
            ph.setColorMode(PrintHelper.COLOR_MODE_MONOCHROME);
            ph.printBitmap(
                "Terproduct",
                bmp,
                new PrintHelper.OnPrintFinishCallback() {
                  @Override
                  public void onFinish() {
                    if (!bmp.isRecycled()) {
                      bmp.recycle();
                    }
                    call.resolve();
                  }
                });
          } catch (Exception e) {
            Log.e(TAG, "print", e);
            if (!bmp.isRecycled()) {
              bmp.recycle();
            }
            call.reject("Print failed: " + e.getMessage());
          }
        });
  }

  /**
   * ~384px width matches many 58mm (203 dpi) devices; enough height for a few lines of test text.
   */
  private static Bitmap renderTextBitmap(String text) {
    int width = 384;
    int lineH = 28;
    int pad = 16;
    String[] lines = text.split("\n", -1);
    int height = Math.max(120, pad * 2 + lineH * lines.length + 8);

    Bitmap bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
    Canvas c = new Canvas(bmp);
    c.drawColor(Color.WHITE);
    Paint p = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.SUBPIXEL_TEXT_FLAG);
    p.setTextSize(22f);
    p.setColor(Color.BLACK);
    p.setTypeface(android.graphics.Typeface.MONOSPACE);

    float y = pad + 18f;
    for (String line : lines) {
      String s = line.length() > 44 ? line.substring(0, 44) : line;
      c.drawText(s, pad, y, p);
      y += lineH;
    }
    return bmp;
  }
}
