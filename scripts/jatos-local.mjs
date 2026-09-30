// Local JATOS for testing: downloads JATOS (with its own Java) into .jatos/,
// runs it on http://localhost:9000 (this computer only), imports the current
// experiment, and connects the experiment dashboard to it.
//
//   npm run jatos        start (or reuse) local JATOS, import the experiment, print a study link
//   npm run jatos:stop   stop local JATOS
//
// Everything lives in .jatos/ (never committed): the JATOS install, its
// database and results, and the API token the dashboard uses. When the lab's
// JATOS server is ready, put JATOS_URL and JATOS_API_TOKEN in .env.local and
// the dashboard uses that server instead.

import { execFileSync, spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { unzipSync } from "fflate";

const JATOS_VERSION = "3.11.3";
const PORT = 9000;
const URL_BASE = `http://127.0.0.1:${PORT}`;
const ROOT = resolve(".jatos");
const INSTALL = join(ROOT, `jatos-${JATOS_VERSION}`);
const DATA = join(ROOT, "data");
const LOCAL_CONFIG = join(ROOT, "local.json");
const PID_FILE = join(ROOT, "jatos.pid");

const log = (message) => console.log(`[jatos] ${message}`);

// ------------------------------------------------------------------ install

function releaseAsset() {
  const { platform, arch } = process;
  if (platform === "darwin") return arch === "arm64" ? "jatos_mac_aarch64_java.zip" : "jatos_mac_x64_java.zip";
  if (platform === "win32") return "jatos_win_java.zip";
  if (platform === "linux" && arch === "x64") return "jatos_linux_java.zip";
  throw new Error(`No JATOS download with bundled Java for ${platform}/${arch}.`);
}

/** Directory that contains bin/jatos, searched a few levels deep. */
function findAppDir(dir, depth = 3) {
  if (existsSync(join(dir, "bin", "jatos"))) return dir;
  if (depth === 0) return null;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      const found = findAppDir(path, depth - 1);
      if (found) return found;
    }
  }
  return null;
}

/** JAVA_HOME of the Java bundled with JATOS (jre/<platform>_jre). */
function findJavaHome(appDir) {
  const jreDir = join(appDir, "jre");
  if (!existsSync(jreDir)) return null;
  for (const name of readdirSync(jreDir)) {
    const home = join(jreDir, name);
    for (const candidate of [home, join(home, "Contents", "Home")]) {
      if (existsSync(join(candidate, "bin", "java")) || existsSync(join(candidate, "bin", "java.exe"))) return candidate;
    }
  }
  return null;
}

function makeExecutable(dir) {
  if (process.platform === "win32" || !existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isFile()) chmodSync(path, 0o755);
  }
}

async function install() {
  const existing = existsSync(INSTALL) && findAppDir(INSTALL);
  if (existing) return existing;

  // JATOS_LOCAL_ZIP can point at an already downloaded release zip (offline use).
  const source = process.env.JATOS_LOCAL_ZIP
    ?? `https://github.com/JATOS/JATOS/releases/download/v${JATOS_VERSION}/${releaseAsset()}`;
  log(`Downloading JATOS ${JATOS_VERSION} (about 100 MB, first time only)…`);
  let bytes;
  if (/^https?:/.test(source)) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText} (${source})`);
    bytes = new Uint8Array(await response.arrayBuffer());
  } else {
    bytes = new Uint8Array(readFileSync(source));
  }

  log("Unpacking…");
  rmSync(INSTALL, { recursive: true, force: true });
  for (const [name, content] of Object.entries(unzipSync(bytes))) {
    if (name.endsWith("/")) continue;
    const path = join(INSTALL, name);
    if (!path.startsWith(INSTALL)) continue; // ignore unsafe paths
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, content);
  }

  const appDir = findAppDir(INSTALL);
  if (!appDir) throw new Error("The JATOS download didn't contain bin/jatos.");
  // Zip extraction drops the executable bit.
  makeExecutable(join(appDir, "bin"));
  const javaHome = findJavaHome(appDir);
  if (javaHome) {
    makeExecutable(join(javaHome, "bin"));
    if (existsSync(join(javaHome, "lib", "jspawnhelper"))) chmodSync(join(javaHome, "lib", "jspawnhelper"), 0o755);
  }
  return appDir;
}

// ------------------------------------------------------------------ running

async function isUp() {
  try {
    const response = await fetch(`${URL_BASE}/jatos/signin`, { signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function start(appDir) {
  if (await isUp()) {
    log(`JATOS is already running at ${URL_BASE}`);
    return;
  }
  const javaHome = process.env.JATOS_JAVA_HOME ?? findJavaHome(appDir);
  if (!javaHome) throw new Error("Couldn't find the Java bundled with JATOS.");

  mkdirSync(join(DATA, "logs"), { recursive: true });
  const logFile = join(DATA, "logs", "jatos-console.log");
  const out = openSync(logFile, "a");
  const windows = process.platform === "win32";
  const launcher = join(appDir, "bin", windows ? "jatos.bat" : "jatos");

  // Remove a stale pid file left by a crash, or Play refuses to start.
  rmSync(join(appDir, "RUNNING_PID"), { force: true });

  const child = spawn(launcher, ["-J--add-opens=java.base/java.lang=ALL-UNNAMED"], {
    cwd: appDir,
    detached: true,
    shell: windows,
    stdio: ["ignore", out, out],
    env: {
      ...process.env,
      JAVA_HOME: javaHome,
      JATOS_HTTP_ADDRESS: "127.0.0.1", // this computer only
      JATOS_HTTP_PORT: String(PORT),
      JATOS_SECRET: localSecret(),
      JATOS_DB_URL: `jdbc:h2:${join(DATA, "database", "jatos")};MODE=MYSQL;DATABASE_TO_UPPER=FALSE;IGNORECASE=TRUE;DEFAULT_LOCK_TIMEOUT=10000;SELECT_FOR_UPDATE_MVCC=FALSE`,
      JATOS_STUDY_ASSETS_ROOT_PATH: join(DATA, "study_assets_root"),
      JATOS_RESULT_UPLOADS_PATH: join(DATA, "result_uploads"),
      JATOS_STUDY_LOGS_PATH: join(DATA, "study_logs"),
      JATOS_TMP_PATH: join(DATA, "tmp"),
      JATOS_LOGS_PATH: join(DATA, "logs"),
    },
  });
  child.unref();
  writeFileSync(PID_FILE, String(child.pid));

  log("Starting JATOS…");
  for (let i = 0; i < 120; i += 1) {
    if (await isUp()) {
      log(`JATOS is running at ${URL_BASE}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`JATOS didn't start within 2 minutes. See ${logFile}`);
}

function localSecret() {
  const file = join(ROOT, "secret");
  if (!existsSync(file)) {
    mkdirSync(ROOT, { recursive: true });
    writeFileSync(file, Array.from(crypto.getRandomValues(new Uint8Array(48)), (b) => b.toString(16).padStart(2, "0")).join(""));
  }
  return readFileSync(file, "utf8").trim();
}

function stop() {
  if (!existsSync(PID_FILE)) {
    log("Local JATOS isn't running (no pid file).");
    return;
  }
  const pid = Number(readFileSync(PID_FILE, "utf8"));
  try {
    if (process.platform === "win32") execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-pid, "SIGTERM"); // the whole process group started by `npm run jatos`
    log("Stopped local JATOS.");
  } catch {
    log("Local JATOS wasn't running.");
  }
  rmSync(PID_FILE, { force: true });
}

// --------------------------------------------------------------- API access

function readLocalConfig() {
  try {
    return JSON.parse(readFileSync(LOCAL_CONFIG, "utf8"));
  } catch {
    return {};
  }
}

function writeLocalConfig(values) {
  writeFileSync(LOCAL_CONFIG, JSON.stringify({ ...readLocalConfig(), ...values }, null, 2) + "\n");
}

/** Minimal cookie-keeping client for the JATOS web GUI. */
function guiClient() {
  const cookies = new Map();
  return async (path, options = {}) => {
    const response = await fetch(URL_BASE + path, {
      ...options,
      redirect: "manual",
      headers: { ...options.headers, Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") },
    });
    for (const header of response.headers.getSetCookie()) {
      const [pair] = header.split(";");
      const index = pair.indexOf("=");
      cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return response;
  };
}

const csrfFrom = (html) => /'Csrf-Token': '([^']+)'/.exec(html)?.[1];

/** Sign in as the default local admin and create an API token. */
async function createToken() {
  const gui = guiClient();
  const signinPage = await (await gui("/jatos/signin")).text();
  const signin = await gui("/jatos/signin/local", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Csrf-Token": csrfFrom(signinPage) },
    body: "username=admin&password=admin",
  });
  if (!signin.ok) {
    throw new Error("Couldn't sign in to local JATOS as admin/admin. If you changed the password, delete .jatos/data to start fresh.");
  }
  const home = await (await gui("/jatos")).text();
  const response = await gui(`/jatos/user/apiToken?name=experiment-dashboard&expires=0`, {
    method: "POST",
    headers: { "Csrf-Token": csrfFrom(home) },
  });
  if (!response.ok) throw new Error(`Couldn't create an API token (${response.status}).`);
  return (await response.text()).trim().replace(/"/g, "");
}

async function api(token, path, options = {}) {
  return fetch(URL_BASE + path, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } });
}

async function ensureToken() {
  const { token } = readLocalConfig();
  if (token && (await api(token, "/jatos/api/v1/admin/token")).ok) return token;
  const fresh = await createToken();
  writeLocalConfig({ url: `http://localhost:${PORT}`, token: fresh });
  return fresh;
}

// ------------------------------------------------------------ study import

async function importStudy(token) {
  log("Building the experiment…");
  execFileSync(process.execPath, [resolve("node_modules/vite/bin/vite.js"), "build", "--logLevel", "warn"], { stdio: "inherit" });
  execFileSync(process.execPath, [resolve("scripts/build-jatos.mjs")], {
    stdio: "inherit",
    env: { ...process.env, JATOS_LOCAL_IMPORT: "1" },
  });

  const config = JSON.parse(readFileSync("study.config.json", "utf8"));
  const archive = readFileSync(join("jatos", `${config.dirName}.jzip`));
  const form = new FormData();
  form.append("study", new Blob([archive]), `${config.dirName}.jzip`);
  // keepCurrentAssetsName=false: the study folder always matches dirName.
  const imported = await api(token, "/jatos/api/v1/studies?keepCurrentAssetsName=false", { method: "POST", body: form });
  if (!imported.ok) throw new Error(`Import into local JATOS failed: ${imported.status} ${await imported.text()}`);
  const study = (await imported.json()).data;

  // A General Multiple link can be reused for as many test runs as you like.
  const codes = await api(token, `/jatos/api/v1/studies/${study.id}/studyCodes?type=GeneralMultiple`, { method: "POST" });
  if (!codes.ok) throw new Error(`Couldn't get a study link: ${codes.status} ${await codes.text()}`);
  const code = (await codes.json()).data[0];
  const studyLink = `http://localhost:${PORT}/publix/${code}?PROLIFIC_PID=local-test&STUDY_ID=local&SESSION_ID=local`;
  writeLocalConfig({ studyLink });
  return { study, studyLink };
}

// --------------------------------------------------------------------- main

const command = process.argv[2] ?? "start";
try {
  mkdirSync(ROOT, { recursive: true });
  if (command === "stop") {
    stop();
  } else if (command === "start") {
    const appDir = await install();
    await start(appDir);
    const token = await ensureToken();
    const { study, studyLink } = await importStudy(token);
    log(`Imported "${study.title}".`);
    log("");
    log(`Study link (runs the experiment as a participant and saves data):`);
    log(`  ${studyLink}`);
    log("");
    log(`JATOS admin: http://localhost:${PORT} (user admin, password admin; only reachable from this computer)`);
    log("The experiment dashboard (npm run dev) now shows this local JATOS. Run `npm run jatos` again after changes.");
  } else {
    console.error("Usage: node scripts/jatos-local.mjs [start|stop]");
    process.exit(1);
  }
} catch (error) {
  console.error(`[jatos] ${error.message}`);
  process.exit(1);
}
