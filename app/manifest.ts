import type { MetadataRoute } from "next";

// Lets a phone or tablet add Bolo to the home screen; it then opens straight to the counter.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MandiPlus Bolo",
    short_name: "Bolo",
    description: "Bol kar bill, khata aur hisaab.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f5f6fb",
    theme_color: "#4309ac",
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
