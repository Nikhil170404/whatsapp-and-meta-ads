import { ImageResponse } from "next/og";

export const alt = "ReplyKaro: WhatsApp Business automation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "linear-gradient(135deg,#0f172a,#064e3b)", color: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 36, fontWeight: 700 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "#25D366", display: "flex" }} />
          ReplyKaro
        </div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, marginTop: 40, display: "flex" }}>
          Answer every WhatsApp message automatically.
        </div>
        <div style={{ fontSize: 32, color: "#a7f3d0", marginTop: 28, display: "flex" }}>
          Auto-replies · Broadcasts · Shared inbox · Consent tracking
        </div>
      </div>
    ),
    size
  );
}
