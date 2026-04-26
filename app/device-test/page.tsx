import type { Metadata } from "next";

import { DeviceHardwareTest } from "@/components/device-test/DeviceHardwareTest";

export const metadata: Metadata = {
  title: "Device test — Terproduct",
  description: "Camera, barcode, and Bluetooth printer smoke tests (Unisoc / Android field).",
  robots: { index: false, follow: false },
};

export default function DeviceTestPage() {
  return <DeviceHardwareTest />;
}
