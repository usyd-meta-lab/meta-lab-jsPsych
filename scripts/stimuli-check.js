// Build checks for src/stimuli/ (see src/stimuli.js):
// - every stimulus("name") and stimuliIn("folder") written in src/ names a
//   file or folder that exists. A missing one fails the build, since the
//   experiment would stop with an error for every participant.
// - total size: participants download every file before the task, and the
//   artifact preview embeds them all in one page with a 16 MB limit.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const STIMULI = "src/stimuli";
const MEDIA = /\.(png|jpe?g|gif|webp|avif|svg|bmp|mp3|wav|ogg|m4a|aac|flac|mp4|webm|mov|m4v)$/i;
const VIDEO = /\.(mp4|webm|mov|m4v)$/i;
const MB = 1024 * 1024;

// Artifact pages are limited to 16 MB, and embedding a file in the page
// (base64) makes it about a third bigger. Leave room for the code itself.
const ARTIFACT_MB = 16;
const ARTIFACT_STIMULI_MB = (ARTIFACT_MB - 1.5) / 1.37;
const PARTICIPANT_WARN_MB = 50;

function walk(dir, keep) {
  let out = [];
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out = out.concat(walk(path, keep));
    else if (keep(path)) out.push(path);
  }
  return out;
}

const mb = (bytes) => `${(bytes / MB).toFixed(1)} MB`;

/** Problems and size warnings for src/stimuli/, for this kind of build. */
export function checkStimuli({ preview = false } = {}) {
  const files = walk(STIMULI, (p) => MEDIA.test(p)).map((path) => ({
    name: relative(STIMULI, path).split("\\").join("/"),
    size: statSync(path).size,
  }));
  const names = new Set(files.map((f) => f.name));
  const errors = [];
  const warnings = [];

  // Names written directly in the code. Names built at run time can't be
  // checked here; stimulus() reports those when the experiment runs.
  for (const path of walk("src", (p) => /\.js$/.test(p) && !p.startsWith(STIMULI))) {
    // Skip comment lines, which often show examples.
    const code = readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join("\n");
    for (const [, name] of code.matchAll(/\bstimulus\(\s*["'`]([^"'`$]+)["'`]\s*\)/g)) {
      if (!names.has(name)) errors.push(`${path}: stimulus("${name}") but there's no src/stimuli/${name}.`);
    }
    for (const [, folder] of code.matchAll(/\bstimuliIn\(\s*["'`]([^"'`$]+)["'`]\s*\)/g)) {
      const prefix = folder.replace(/\/?$/, "/");
      if (![...names].some((n) => n.startsWith(prefix))) {
        errors.push(`${path}: stimuliIn("${folder}") but src/stimuli/${prefix} has no images, audio or video.`);
      }
    }
  }

  const total = files.reduce((sum, f) => sum + f.size, 0);
  const videos = files.filter((f) => VIDEO.test(f.name)).sort((a, b) => b.size - a.size);
  const biggest = [...files].sort((a, b) => b.size - a.size).slice(0, 3).map((f) => `${f.name} ${mb(f.size)}`).join(", ");

  if (preview && total > ARTIFACT_STIMULI_MB * MB) {
    warnings.push(
      `Stimuli total ${mb(total)}, too much for the artifact preview (${ARTIFACT_MB} MB page limit, and embedded files grow by a third). ` +
        `The artifact won't publish. Biggest: ${biggest}. Compress them, or preview with npm run dev instead.`,
    );
  } else if (preview && total > ARTIFACT_STIMULI_MB * MB * 0.7) {
    warnings.push(`Stimuli total ${mb(total)}: close to what fits in the artifact preview (${ARTIFACT_MB} MB page limit). Biggest: ${biggest}.`);
  }
  if (!preview && total > PARTICIPANT_WARN_MB * MB) {
    warnings.push(
      `Stimuli total ${mb(total)}. Every participant downloads all of it before the task, which can take minutes on a slow connection (the preload gives up after 5). Biggest: ${biggest}.`,
    );
  }
  for (const video of videos.filter((v) => v.size > 20 * MB)) {
    warnings.push(`${video.name} is ${mb(video.size)}. Consider compressing it (e.g. 720p H.264 MP4); participants download it before the task.`);
  }
  return { files: files.length, total, errors, warnings };
}

/** Vite plugin: runs the checks at the start of npm run dev and every build. */
export function stimuliCheck() {
  let isBuild = false;
  let preview = false;
  return {
    name: "stimuli-check",
    configResolved(config) {
      isBuild = config.command === "build";
      preview = config.mode === "preview";
    },
    buildStart() {
      const { errors, warnings } = checkStimuli({ preview });
      for (const warning of warnings) console.warn(`\n[stimuli] ${warning}`);
      if (errors.length === 0) return;
      const message = `[stimuli] ${errors.join("\n[stimuli] ")}`;
      // Fail builds; in npm run dev just warn (the page shows the error too).
      if (isBuild) this.error(message);
      else console.warn(`\n${message}`);
    },
  };
}
