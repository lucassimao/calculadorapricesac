import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 1200,
};

export const contentType = "image/png";

export default function OgSquare() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #f6f4f0 0%, #efe6d9 100%)",
          color: "#1a1d1b",
          fontFamily: "serif",
          gap: "28px",
        }}
      >
        <div
          style={{
            width: 260,
            height: 260,
            borderRadius: 72,
            background: "linear-gradient(135deg, #2c544a, #5f8b7e)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 60,
            fontWeight: 700,
          }}
        >
          SAC
        </div>
        <div style={{ fontSize: 44, fontWeight: 700 }}>Calculadora Price & SAC</div>
        <div style={{ fontSize: 24, color: "#4a4f4b" }}>Simulador de financiamento imobiliário</div>
      </div>
    ),
    size
  );
}
