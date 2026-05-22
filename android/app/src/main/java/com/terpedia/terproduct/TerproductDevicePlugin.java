package com.terpedia.terproduct;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.os.IBinder;
import android.os.Parcel;
import android.os.RemoteException;
import android.util.Base64;
import android.util.Log;
import java.io.ByteArrayOutputStream;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
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
  private static final String NYX_SERVICE_ACTION = "net.nyx.printerservice.IPrinterService";
  private static final String NYX_SERVICE_PACKAGE = "net.nyx.printerservice";
  private static final String NYX_SERVICE_CLASS = "net.nyx.printerservice.print.PrinterService";
  private static final String NYX_INTERFACE_TOKEN = "net.nyx.printerservice.print.IPrinterService";
  private static final int NYX_PRINT_ESCPOS_TRANSACTION = 19;

  @PluginMethod
  public void printPngDataUrl(PluginCall call) {
    Bitmap bmp = decodePngDataUrl(call);
    if (bmp == null) {
      return;
    }
    Log.i(TAG, "printPngDataUrl bitmap=" + bmp.getWidth() + "x" + bmp.getHeight());
    runPrintBitmapOnUi(call, bmp);
  }

  @PluginMethod
  public void printNyxPngDataUrl(PluginCall call) {
    Bitmap bmp = decodePngDataUrl(call);
    if (bmp == null) {
      return;
    }
    int width = call.getInt("width", 384);
    try {
      byte[] payload = bitmapToEscposRaster(bmp, width);
      Log.i(TAG, "printNyxPngDataUrl bitmap=" + bmp.getWidth() + "x" + bmp.getHeight() + " bytes=" + payload.length);
      printNyxEscpos(call, payload);
    } catch (Exception e) {
      Log.e(TAG, "printNyxPngDataUrl failed", e);
      call.reject("NYX PNG print failed: " + e.getMessage());
    } finally {
      if (!bmp.isRecycled()) {
        bmp.recycle();
      }
    }
  }

  @PluginMethod
  public void printTextAsBitmap(PluginCall call) {
    String text = call.getString("text");
    if (text == null || text.isEmpty()) {
      text = "Terproduct\nSystem print test\n" + new java.util.Date();
    }
    Bitmap bmp = renderTextBitmap(text);
    Log.i(TAG, "printTextAsBitmap chars=" + text.length() + " bitmap=" + bmp.getWidth() + "x" + bmp.getHeight());
    runPrintBitmapOnUi(call, bmp);
  }

  @PluginMethod
  public void printNyxEscposTest(PluginCall call) {
    byte[] payload =
        new byte[] {
          0x1b, 0x40,
          'T', 'e', 'r', 'p', 'r', 'o', 'd', 'u', 'c', 't', ' ', 'N', 'Y', 'X', '\n',
          'E', 'S', 'C', '/', 'P', 'O', 'S', ' ', 'd', 'i', 'r', 'e', 'c', 't', ' ', 't', 'e', 's', 't', '\n',
          'I', 'f', ' ', 't', 'h', 'i', 's', ' ', 'p', 'r', 'i', 'n', 't', 's', ',', ' ', 't', 'h', 'e', ' ', 'b', 'u', 'i', 'l', 't', '-', 'i', 'n', '\n',
          'N', 'Y', 'X', ' ', 'p', 'r', 'i', 'n', 't', 'e', 'r', ' ', 's', 'e', 'r', 'v', 'i', 'c', 'e', ' ', 'i', 's', ' ', 'w', 'o', 'r', 'k', 'i', 'n', 'g', '.', '\n',
          '\n', '\n', '\n'
        };
    printNyxEscpos(call, payload);
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
            Log.i(TAG, "PrintHelper.printBitmap start");
            ph.printBitmap(
                "Terproduct",
                bmp,
                new PrintHelper.OnPrintFinishCallback() {
                  @Override
                  public void onFinish() {
                    Log.i(TAG, "PrintHelper.printBitmap finish");
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

  private void printNyxEscpos(final PluginCall call, final byte[] payload) {
    final Context context = getContext();
    if (context == null) {
      call.reject("No context");
      return;
    }

    final Intent intent = new Intent(NYX_SERVICE_ACTION);
    intent.setComponent(new ComponentName(NYX_SERVICE_PACKAGE, NYX_SERVICE_CLASS));
    Log.i(TAG, "NYX bind start bytes=" + payload.length);

    final ServiceConnection connection =
        new ServiceConnection() {
          @Override
          public void onServiceConnected(ComponentName name, IBinder service) {
            int result = Integer.MIN_VALUE;
            Parcel data = Parcel.obtain();
            Parcel reply = Parcel.obtain();
            try {
              data.writeInterfaceToken(NYX_INTERFACE_TOKEN);
              data.writeByteArray(payload);
              boolean ok = service.transact(NYX_PRINT_ESCPOS_TRANSACTION, data, reply, 0);
              reply.readException();
              result = reply.readInt();
              Log.i(TAG, "NYX printEscposData ok=" + ok + " result=" + result);
              call.resolve(new com.getcapacitor.JSObject().put("result", result));
            } catch (RemoteException | RuntimeException e) {
              Log.e(TAG, "NYX printEscposData failed result=" + result, e);
              call.reject("NYX print failed: " + e.getMessage());
            } finally {
              data.recycle();
              reply.recycle();
              try {
                context.unbindService(this);
              } catch (IllegalArgumentException ignored) {
              }
            }
          }

          @Override
          public void onServiceDisconnected(ComponentName name) {
            Log.w(TAG, "NYX service disconnected");
          }
        };

    boolean bound = context.bindService(intent, connection, Context.BIND_AUTO_CREATE);
    if (!bound) {
      Log.e(TAG, "NYX bind failed");
      call.reject("NYX printer service bind failed");
    }
  }

  private Bitmap decodePngDataUrl(PluginCall call) {
    String data = call.getString("data", "");
    if (data == null || data.isEmpty()) {
      call.reject("data is required (PNG as data URL or base64)");
      return null;
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
      return null;
    }
    Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
    if (bmp == null) {
      call.reject("Could not decode PNG");
    }
    return bmp;
  }

  private static byte[] bitmapToEscposRaster(Bitmap source, int maxWidth) {
    int targetWidth = Math.max(128, Math.min(576, maxWidth));
    targetWidth = targetWidth - (targetWidth % 8);
    int targetHeight = Math.max(1, Math.round(source.getHeight() * (targetWidth / (float) source.getWidth())));

    Bitmap scaled = Bitmap.createScaledBitmap(source, targetWidth, targetHeight, true);
    int widthBytes = targetWidth / 8;
    ByteArrayOutputStream out = new ByteArrayOutputStream(16 + widthBytes * targetHeight);
    out.write(0x1b);
    out.write(0x40);
    out.write(0x1b);
    out.write(0x61);
    out.write(0x01);

    int row = 0;
    while (row < targetHeight) {
      int rows = Math.min(256, targetHeight - row);
      out.write(0x1d);
      out.write(0x76);
      out.write(0x30);
      out.write(0x00);
      out.write(widthBytes & 0xff);
      out.write((widthBytes >> 8) & 0xff);
      out.write(rows & 0xff);
      out.write((rows >> 8) & 0xff);

      for (int y = row; y < row + rows; y += 1) {
        for (int xb = 0; xb < widthBytes; xb += 1) {
          int b = 0;
          for (int bit = 0; bit < 8; bit += 1) {
            int pixel = scaled.getPixel(xb * 8 + bit, y);
            int alpha = Color.alpha(pixel);
            int red = blendOnWhite(Color.red(pixel), alpha);
            int green = blendOnWhite(Color.green(pixel), alpha);
            int blue = blendOnWhite(Color.blue(pixel), alpha);
            int luminance = (red * 299 + green * 587 + blue * 114) / 1000;
            if (luminance < 176) {
              b |= 0x80 >> bit;
            }
          }
          out.write(b);
        }
      }
      row += rows;
    }
    out.write(0x0a);
    out.write(0x0a);
    out.write(0x0a);
    if (scaled != source && !scaled.isRecycled()) {
      scaled.recycle();
    }
    return out.toByteArray();
  }

  private static int blendOnWhite(int channel, int alpha) {
    return (channel * alpha + 255 * (255 - alpha)) / 255;
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
