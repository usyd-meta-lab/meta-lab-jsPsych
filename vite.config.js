import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { jatosDevData } from "./scripts/jatos-dev-data.js";

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

// Where participant data goes: "jatos" or "datapipe" (study.config.json).
function dataSaving() {
  const { dataSaving = "jatos", withdrawButton } = JSON.parse(readFileSync("study.config.json", "utf8"));
  if (!["jatos", "datapipe"].includes(dataSaving)) {
    throw new Error(`study.config.json: dataSaving must be "jatos" or "datapipe", not "${dataSaving}".`);
  }
  if (dataSaving === "datapipe" && withdrawButton) {
    console.warn("study.config.json: withdrawButton only works with JATOS, so it's ignored for DataPipe.");
  }
  return dataSaving;
}

export default defineConfig(({ mode }) => ({
  // Relative asset paths so the build works from any folder or host,
  // including a JATOS study assets folder.
  base: "./",
  define: {
    __EXPERIMENT_VERSION__: JSON.stringify(experimentVersion()),
    __DATA_SAVING__: JSON.stringify(dataSaving()),
  },
  server: {
    // Claude Code Desktop passes PORT when it picks a free port (autoPort).
    port: Number(process.env.PORT) || 5173,
    strictPort: true,
  },
  // `npm run build:preview` inlines all JS and CSS into one HTML file
  // (preview/index.html) that can be published as a Claude artifact.
  // jatosDevData only runs on the dev server: it lets the preview timeline
  // download real participant data from JATOS (see docs/jatos.md).
  plugins: mode === "preview" ? [viteSingleFile()] : [jatosDevData()],
  build: {
    outDir: mode === "preview" ? "preview" : "dist",
  },
}));
