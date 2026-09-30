// The kit's Vite setup. An experiment's vite.config.js is one line:
//
//   export { default } from "@usyd-meta-lab/jspsych-kit/vite";
//
// Paths without "./" (study.config.json, dist/, .env.local) are the
// experiment's, since Vite and the kit's commands run in the experiment's
// folder. The kit's own files are found relative to this one.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { jatosDevData } from "./scripts/jatos-dev-data.js";
import { stimuliCheck } from "./scripts/stimuli-check.js";
import { devicesOf } from "./src/devices.js";
import { recruitmentOf, recruitmentProblems } from "./src/recruitment.js";

const KIT_DIR = dirname(fileURLToPath(import.meta.url));
const kit = JSON.parse(readFileSync(`${KIT_DIR}/package.json`, "utf8"));

// Git commit of this build, recorded in every data row. "-dirty" means the
// build included uncommitted changes.
function experimentVersion() {
  try {
    const commit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    const dirty = execSync("git status --porcelain", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() !== "";
    return dirty ? `${commit}-dirty` : commit;
  } catch {
    return "unknown";
  }
}

// Where participant data goes: "jatos" or "datapipe" (study.config.json).
// Also checks the recruitment settings, since they're read by the same build.
function dataSaving(command, mode) {
  const config = JSON.parse(readFileSync("study.config.json", "utf8"));
  const { dataSaving = "jatos", withdrawButton } = config;
  recruitmentOf(config); // these throw on unknown values
  devicesOf(config);
  if (command === "build" && mode !== "preview") {
    for (const problem of recruitmentProblems(config)) console.warn(`study.config.json: ${problem}`);
  }
  if (!["jatos", "datapipe"].includes(dataSaving)) {
    throw new Error(`study.config.json: dataSaving must be "jatos" or "datapipe", not "${dataSaving}".`);
  }
  if (dataSaving === "datapipe" && withdrawButton) {
    console.warn("study.config.json: withdrawButton only works with JATOS, so it's ignored for DataPipe.");
  }
  return dataSaving;
}

export default defineConfig(({ command, mode }) => ({
  // Relative asset paths so the build works from any folder or host,
  // including a JATOS study assets folder.
  base: "./",
  define: {
    __EXPERIMENT_VERSION__: JSON.stringify(experimentVersion()),
    __KIT_VERSION__: JSON.stringify(kit.version),
    __DATA_SAVING__: JSON.stringify(dataSaving(command, mode)),
  },
  resolve: {
    // One jsPsych for the kit's blocks and the experiment's own plugins.
    dedupe: ["jspsych"],
  },
  // The kit imports the experiment's files ("/src/experiment.js",
  // "/study.config.json", "/src/stimuli/**"), so Vite must process its
  // source instead of pre-bundling it like other packages.
  // Its browser dependencies (jsPsych and plugins, some of which use
  // CommonJS helpers) still need pre-bundling, so list them explicitly.
  optimizeDeps: {
    exclude: [kit.name],
    include: Object.keys(kit.dependencies)
      .filter((dep) => dep === "jspsych" || dep.startsWith("@jspsych/"))
      .map((dep) => `${kit.name} > ${dep}`),
  },
  server: {
    // Claude Code Desktop passes PORT when it picks a free port (autoPort).
    port: Number(process.env.PORT) || 5173,
    strictPort: true,
    // Serve the kit's files even when it's linked from outside the
    // experiment's folder (the template in the kit's own repo).
    fs: { allow: [process.cwd(), KIT_DIR] },
  },
  // `npm run build:preview` inlines all JS and CSS into one HTML file
  // (preview/index.html) that can be published as a Claude artifact.
  // jatosDevData only runs on the dev server: it lets the dashboard show
  // participant numbers and download data from JATOS (see docs/jatos.md).
  plugins: [stimuliCheck(), ...(mode === "preview" ? [viteSingleFile()] : [jatosDevData()])],
  build: {
    outDir: mode === "preview" ? "preview" : "dist",
  },
}));
