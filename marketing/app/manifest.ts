import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Calculadora Price & SAC",
    short_name: "Price & SAC",
    description:
      "Simulador de financiamento imobiliário SAC e Price. Offline, com tabela completa e comparativo.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f4f0",
    theme_color: "#2c544a",
    icons: [
      {
        src: "/icon.png",
        sizes: "1024x1024",
        type: "image/png",
      },
    ],
  };
}
