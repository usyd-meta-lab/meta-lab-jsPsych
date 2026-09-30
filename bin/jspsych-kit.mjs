#!/usr/bin/env node
// The kit's commands. Experiments run them through their npm scripts
// (npm run dev, npm run build, ...); `new` starts a new experiment:
//
//   npx github:usyd-meta-lab/meta-lab-jsPsych new my-study
//
//   jspsych-kit new <folder> [--title "Study title"] [--kit <npm spec>] [--no-install]
//   jspsych-kit dev                   dev server with the experiment dashboard
//   jspsych-kit build [--preview]     participant build (dist/), or the single-file preview
//   jspsych-kit build-jatos           participant build packaged for JATOS (jatos/<dirName>.jzip)
//   jspsych-kit jatos [start|stop]    local JATOS for testing

import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KIT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const kit = JSON.parse(readFileSync(join(KIT_DIR, "package.json"), "utf8"));
const [command, ...args] = process.argv.slice(2);

const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

/** The experiment's vite.config.js, or the kit's setup if it has none. */
const viteConfig = () => (existsSync("vite.config.js") ? resolve("vite.config.js") : join(KIT_DIR, "vite.js"));

function runScript(script, scriptArgs = []) {
  const result = spawnSync(process.execPath, [join(KIT_DIR, "scripts", script), ...scriptArgs], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function dev() {
  const { createServer } = await import("vite");
  const server = await createServer({ configFile: viteConfig() });
  await server.listen();
  server.printUrls();
  server.bindCLIShortcuts({ print: true });
}

async function build(mode) {
  const { build: viteBuild } = await import("vite");
  await viteBuild({ configFile: viteConfig(), mode, logLevel: process.env.KIT_LOG_LEVEL ?? "info" });
}

// ------------------------------------------------------------------- new

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "experiment";

function newExperiment() {
  const folder = args.find((a) => !a.startsWith("--") && a !== option("title") && a !== option("kit"));
  if (!folder) {
    console.error('Usage: jspsych-kit new <folder> [--title "Study title"]');
    process.exit(1);
  }
  const target = resolve(folder);
  if (existsSync(target) && readdirSync(target).length > 0) {
    console.error(`${target} already exists and isn't empty.`);
    process.exit(1);
  }
  const name = slug(basename(target));
  const title = option("title") ?? basename(target);

  // Copy the starter experiment, without anything installed or built.
  const skip = new Set(["node_modules", "dist", "preview", "jatos", ".jatos", "package-lock.json", ".env.local"]);
  cpSync(join(KIT_DIR, "template"), target, { recursive: true, filter: (src) => !skip.has(basename(src)) });
  // npm leaves .gitignore out of packages, so the template ships it as "gitignore".
  if (existsSync(join(target, "gitignore"))) renameSync(join(target, "gitignore"), join(target, ".gitignore"));

  // Depend on this exact kit release, so the study only changes when someone updates it.
  const pkgPath = join(target, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.name = name;
  pkg.dependencies[kit.name] = option("kit") ?? `github:usyd-meta-lab/meta-lab-jsPsych#v${kit.version}`;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

  const configPath = join(target, "study.config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  Object.assign(config, { template: false, title, dirName: name, uuid: "" });
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

  // The study's name in its CLAUDE.md, README and the browser tab.
  for (const file of ["CLAUDE.md", "README.md"]) {
    const path = join(target, file);
    if (existsSync(path)) writeFileSync(path, readFileSync(path, "utf8").replace("# Experiment", `# ${title}`));
  }
  const htmlPath = join(target, "index.html");
  const escaped = title.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  writeFileSync(htmlPath, readFileSync(htmlPath, "utf8").replace(/<title>[^<]*<\/title>/, `<title>${escaped}</title>`));

  try {
    execFileSync("git", ["init", "-q"], { cwd: target });
  } catch {
    console.warn("git isn't available, so the folder isn't a git repository yet.");
  }
  if (!flag("no-install")) {
    console.log("Installing (this takes a minute the first time)…");
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const result = spawnSync(npm, ["install", "--no-audit", "--no-fund"], { cwd: target, stdio: "inherit" });
    if (result.status !== 0) {
      console.error(`npm install failed. Fix the problem above, then run npm install in ${folder}.`);
      process.exit(1);
    }
  }

  console.log(`
Created "${title}" in ${target}

Next:
  1. Open the folder in Claude Code (desktop app: Open folder; terminal: cd ${folder} && claude).
  2. Say "set up this experiment". Claude asks a few questions (participants,
     length, devices, design) and builds it with you.
  3. Or start the dashboard yourself: cd ${folder} && npm run dev
`);
}

// ------------------------------------------------------------------ main

try {
  switch (command) {
    case "new":
      newExperiment();
      break;
    case "dev":
      await dev();
      break;
    case "build":
      await build(flag("preview") ? "preview" : "production");
      break;
    case "build-jatos":
      runScript("build-jatos.mjs", ["--check"]);
      await build("production");
      runScript("build-jatos.mjs");
      break;
    case "jatos":
      runScript("jatos-local.mjs", [args[0] ?? "start"]);
      break;
    case "--version":
    case "version":
      console.log(kit.version);
      break;
    default:
      console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 11).join("\n").replace(/^\/\/ ?/gm, ""));
      process.exit(command ? 1 : 0);
  }
} catch (error) {
  console.error(error.message ?? error);
  process.exit(1);
}
