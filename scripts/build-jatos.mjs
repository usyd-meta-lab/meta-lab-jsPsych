// Packages dist/ as a JATOS study archive (.jzip) that can be imported in
// the JATOS GUI (Import Study). Run via `npm run build:jatos`.
//
// Re-importing an archive with the same study UUID updates the existing
// study in JATOS instead of creating a new one, so the UUID is generated
// once and saved to study.config.json. Commit that file.
//
// Exception: while "template": true (the template repo itself), the UUID is
// kept in .jatos/template-study-uuid, which is never committed, so studies
// copied from the template never share a UUID.

import { execSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { zipSync } from "fflate";

const configPath = "study.config.json";
const config = JSON.parse(readFileSync(configPath, "utf8"));
const templateUuidPath = join(".jatos", "template-study-uuid");

if (config.template) {
  if (!existsSync(templateUuidPath)) {
    mkdirSync(".jatos", { recursive: true });
    writeFileSync(templateUuidPath, randomUUID());
  }
  config.uuid = readFileSync(templateUuidPath, "utf8").trim();
} else if (!config.uuid) {
  config.uuid = randomUUID();
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log(`Generated study UUID ${config.uuid} and saved it to ${configPath}. Commit this file.`);
}
if (!/^[\w-]+$/.test(config.dirName)) {
  throw new Error(`dirName "${config.dirName}" in ${configPath} may only use letters, digits, - and _.`);
}
if (!existsSync("dist/index.html")) {
  throw new Error("dist/index.html not found. Run `vite build` first.");
}

// JATOS study archive format, version 3 (JATOS 3.x). The batch only
// matters on first import: when an existing study is updated, JATOS keeps
// its batches and study links as they are.
const studyJson = {
  version: "3",
  data: {
    uuid: config.uuid,
    title: config.title,
    description: "",
    groupStudy: false,
    linearStudy: false,
    allowPreview: false,
    dirName: config.dirName,
    comments: `Built from git ${gitVersion()}`,
    studyInput: null,
    endRedirectUrl: config.endRedirectUrl || null,
    studyEntryMsg: null,
    componentList: [
      {
        uuid: derivedUuid(config.uuid, "experiment"),
        title: "Experiment",
        htmlFilePath: "index.html",
        reloadable: false,
        active: true,
        comments: "",
        componentInput: null,
      },
    ],
    batchList: [
      {
        uuid: derivedUuid(config.uuid, "batch"),
        title: "Default",
        active: true,
        maxActiveMembers: null,
        maxTotalMembers: null,
        maxTotalWorkers: null,
        // General Single / General Multiple links are the ones used for
        // Prolific; Jatos and Personal links are for the research team.
        allowedWorkerTypes: ["Jatos", "PersonalSingle", "PersonalMultiple", "GeneralSingle", "GeneralMultiple"],
        comments: null,
        batchInput: null,
      },
    ],
  },
};

function gitVersion() {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
}

// Component and batch UUIDs must also stay the same across builds, so
// derive them from the study UUID instead of storing more values.
function derivedUuid(studyUuid, name) {
  const hex = createHash("sha1").update(`${studyUuid}:${name}`).digest("hex");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join("-");
}

function addDir(files, dir, prefix) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) addDir(files, path, prefix);
    else files[`${prefix}/${relative("dist", path).split("\\").join("/")}`] = readFileSync(path);
  }
}

const files = {};
addDir(files, "dist", config.dirName);
files[`${config.dirName}.jas`] = new TextEncoder().encode(JSON.stringify(studyJson, null, 2));

mkdirSync("jatos", { recursive: true });
const out = join("jatos", `${config.dirName}.jzip`);
writeFileSync(out, zipSync(files));
if (!process.env.JATOS_LOCAL_IMPORT) console.log(`Wrote ${out}. Import it in JATOS: Studies > Import study.`);
