import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #022c22 0%, #065f46 55%, #34d399 100%)",
          color: "white",
          fontSize: 220,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        T
      </div>
    ),
    { ...size },
  );
}
