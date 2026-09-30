import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Git commit of this build, recorded in every data row. "-dirty" means the
// build included uncommitted changes.
function experimentVersion() {
  try {
    const commit = execSync("git rev-parse --short HEAD").toString().trim();
    const dirty = execSync("git status --porcelain").toString().trim() !== "";
    return dirty ? `${commit}-dirty` : commit;
  } catch {
    return "unknown";
  }
}

export default defineConfig(({ mode }) => ({
  // Relative asset paths so the build works from any folder or host,
  // including a JATOS study assets folder.
  base: "./",
  define: {
    __EXPERIMENT_VERSION__: JSON.stringify(experimentVersion()),
  },
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
