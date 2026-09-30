import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ mode }) => ({
  // Relative asset paths so the build works from any folder or host.
  base: "./",
  server: {
    // Claude Code Desktop passes PORT when it picks a free port (autoPort).
    port: Number(process.env.PORT) || 5173,
    strictPort: true,
  },
  // `npm run build:preview` inlines all JS and CSS into one HTML file
  // (preview/index.html) that can be published as a Claude artifact.
  plugins: mode === "preview" ? [viteSingleFile()] : [],
  build: {
    outDir: mode === "preview" ? "preview" : "dist",
  },
}));
