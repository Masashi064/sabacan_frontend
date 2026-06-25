import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0ea5e9",
        borderRadius: 40,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "white",
          borderRadius: 20,
          width: "74%",
          height: "62%",
        }}
      >
        <span
          style={{
            color: "#0ea5e9",
            fontSize: 82,
            fontWeight: 900,
            lineHeight: 1,
          }}
        >
          ?
        </span>
      </div>
    </div>,
    { ...size }
  );
}
