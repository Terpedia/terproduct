import type { BluetoothSerialPlugin } from "@ascentio-it/capacitor-bluetooth-serial";

import { uint8ToPluginWriteString } from "@/lib/printing/escpos-qr";

let serial: typeof import("@ascentio-it/capacitor-bluetooth-serial") | null = null;

async function loadPlugin(): Promise<typeof import("@ascentio-it/capacitor-bluetooth-serial")> {
  if (serial) return serial;
  serial = await import("@ascentio-it/capacitor-bluetooth-serial");
  return serial;
}

export async function ensureAndroidBluetoothPermissions(
  Bt: { checkBluetoothPermissions: BluetoothSerialPlugin["checkBluetoothPermissions"] } | BluetoothSerialPlugin,
) {
  const ok = await Bt.checkBluetoothPermissions();
  if (!ok) {
    throw new Error("Grant Bluetooth and (on Android 12+) Nearby devices permissions in Settings.");
  }
}

export async function printEscPosToPaired(
  address: string,
  payload: Uint8Array,
): Promise<void> {
  const { BluetoothSerial } = await loadPlugin();
  const value = uint8ToPluginWriteString(payload);
  await ensureAndroidBluetoothPermissions(BluetoothSerial);
  const state = await BluetoothSerial.isEnabled();
  if (!state.enabled) {
    await BluetoothSerial.enable();
  }
  const conn = await BluetoothSerial.isConnected({ address });
  if (!conn.connected) {
    await BluetoothSerial.connect({ address });
  }
  await BluetoothSerial.write({ address, value });
}

export async function listPairedForUi(): Promise<Array<{ name: string; address: string }>> {
  const { BluetoothSerial } = await loadPlugin();
  await ensureAndroidBluetoothPermissions(BluetoothSerial);
  const { devices } = await BluetoothSerial.getPairedDevices();
  return devices;
}
