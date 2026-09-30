// Dev-server-only endpoints that let the preview timeline download real
// participant data from JATOS. The JATOS API token stays in this Node
// process; the browser only talks to the local dev server. This plugin runs
// only under `npm run dev` and is never part of any build.
//
// Which JATOS: JATOS_URL and JATOS_API_TOKEN from .env.local (or the
// environment) when set, otherwise the local JATOS started by `npm run jatos`
// (its URL and token are in .jatos/local.json).

import { existsSync, readFileSync } from "node:fs";
import { loadEnv } from "vite";

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

// jatos.js sends a heartbeat every minute while the experiment is open, so a
// run that hasn't ended and hasn't been seen for this long has been abandoned.
const IN_PROGRESS_MINUTES = 5;

/** Group a JATOS study result the way a researcher reads it. */
export function classifyRun(result, now = Date.now()) {
  if (result.workerType === "Jatos") return "tests";
  switch (result.studyState) {
    case "FINISHED":
      return "completed";
    case "ABORTED":
      return "withdrawn";
    case "FAIL":
      return "failed";
    default: {
      const lastSeen = result.lastSeenDate ?? result.startDate ?? 0;
      return now - lastSeen < IN_PROGRESS_MINUTES * 60000 ? "inProgress" : "droppedOut";
    }
  }
}

const median = (values) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Dashboard numbers from JATOS result metadata. No participant IDs. */
export function summarise(results, now = Date.now()) {
  const counts = { completed: 0, inProgress: 0, droppedOut: 0, withdrawn: 0, failed: 0, tests: 0 };
  const durations = [];
  let lastCompletedAt = null;
  for (const result of results) {
    const group = classifyRun(result, now);
    counts[group] += 1;
    if (group === "completed" && result.startDate && result.endDate) {
      durations.push(result.endDate - result.startDate);
      lastCompletedAt = Math.max(lastCompletedAt ?? 0, result.endDate);
    }
  }
  const stopped = counts.completed + counts.droppedOut + counts.withdrawn + counts.failed;
  return {
    counts,
    completionRate: stopped > 0 ? counts.completed / stopped : null,
    medianMinutes: durations.length > 0 ? median(durations) / 60000 : null,
    lastCompletedAt,
    updatedAt: now,
    inProgressMinutes: IN_PROGRESS_MINUTES,
  };
}

export function jatosDevData() {
  let env = {};
  return {
    name: "jatos-dev-data",
    apply: "serve",
    configResolved(config) {
      env = loadEnv(config.mode, config.root, "JATOS_");
    },
    configureServer(server) {
      server.middlewares.use("/__jatos", async (req, res) => {
        // Participant data must never leave this machine, even if the dev
        // server is started with --host.
        if (!LOOPBACK.has(req.socket.remoteAddress)) return send(res, 403, "Local requests only.");
        try {
          const route = req.url.split("?")[0];
          const jatos = connection(env);
          if (route === "/summary") return sendJson(res, await summary(jatos));
          if (route === "/data.csv") return sendFile(res, await exportData(jatos, "csv"));
          if (route === "/data.ndjson") return sendFile(res, await exportData(jatos, "ndjson"));
          send(res, 404, "Not found.");
        } catch (error) {
          send(res, 502, error.message);
        }
      });
    },
  };
}

/** The JATOS server to use: .env.local first, then the local JATOS. */
function connection(env) {
  if (env.JATOS_URL && env.JATOS_API_TOKEN) return { ...env, local: false };
  try {
    const local = JSON.parse(readFileSync(".jatos/local.json", "utf8"));
    if (local.url && local.token) {
      return { JATOS_URL: local.url, JATOS_API_TOKEN: local.token, local: true, studyLink: local.studyLink };
    }
  } catch {
    // No local JATOS set up yet.
  }
  return {};
}

function studyConfig() {
  const config = JSON.parse(readFileSync("study.config.json", "utf8"));
  // The template repo keeps its UUID out of git (see scripts/build-jatos.mjs).
  if (config.template) {
    const path = ".jatos/template-study-uuid";
    config.uuid = existsSync(path) ? readFileSync(path, "utf8").trim() : "";
  }
  return config;
}

const NOT_IMPORTED = "This study isn't on the JATOS server yet, or the token's user isn't a member of it. Run npm run jatos (local JATOS) or npm run build:jatos and import it.";

async function jatosApi(env, path, method = "GET") {
  let response;
  try {
    response = await fetch(new URL(path, env.JATOS_URL), {
      method,
      headers: { Authorization: `Bearer ${env.JATOS_API_TOKEN}` },
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    throw new Error(`Couldn't reach JATOS at ${env.JATOS_URL} (${error.cause?.code ?? error.message}).`);
  }
  if (response.ok) return response;
  if (response.status === 404) throw new Error(NOT_IMPORTED);
  const detail = method === "HEAD" ? "" : ((await response.json().catch(() => null))?.error?.message ?? "");
  if (response.status === 401 || response.status === 403 || /token/i.test(detail)) {
    throw new Error(`JATOS refused the API token${detail ? ` (${detail})` : ""}. Check JATOS_API_TOKEN.`);
  }
  // JATOS answers some malformed tokens with a generic 500.
  throw new Error(`JATOS returned ${response.status}${detail ? ` (${detail})` : ""}. Check JATOS_URL and JATOS_API_TOKEN.`);
}

async function metadata(env, uuid) {
  await jatosApi(env, `/jatos/api/v1/studies/${uuid}`, "HEAD");
  const response = await jatosApi(env, `/jatos/api/v1/results/metadata?studyUuid=${uuid}&download=false`);
  const json = await response.json();
  return json.data?.[0]?.studyResults ?? [];
}

async function summary(env) {
  const study = studyConfig();
  // DataPipe has no API for reading data back: it lives with the storage
  // provider chosen in the DataPipe dashboard.
  if (study.dataSaving === "datapipe") return { configured: true, datapipe: true, title: study.title };
  if (!env.JATOS_URL || !env.JATOS_API_TOKEN) return { configured: false };
  const base = {
    configured: true,
    server: env.local ? "local JATOS" : new URL(env.JATOS_URL).host,
    title: study.title,
    local: env.local,
    // Only the local test link is shown; real study links stay in JATOS.
    studyLink: env.local ? env.studyLink : undefined,
  };
  if (!study.uuid) {
    return { ...base, error: "This study isn't in JATOS yet. Run npm run jatos (local JATOS) or npm run build:jatos and import it." };
  }
  try {
    return { ...base, ...summarise(await metadata(env, study.uuid)) };
  } catch (error) {
    return { ...base, error: error.message };
  }
}

const toIso = (ms) => (ms ? new Date(ms).toISOString() : null);

async function exportData(env, format) {
  const study = studyConfig();
  if (study.dataSaving === "datapipe") throw new Error("This study saves data with DataPipe; download it from your storage provider.");
  if (!env.JATOS_URL || !env.JATOS_API_TOKEN || !study.uuid) throw new Error("JATOS isn't set up for this study.");

  // Per-run details from JATOS, joined onto every trial row.
  const runs = new Map();
  for (const result of await metadata(env, study.uuid)) {
    runs.set(String(result.id), {
      jatos_study_state: result.studyState,
      jatos_worker_type: result.workerType,
      jatos_start_time: toIso(result.startDate),
      jatos_end_time: toIso(result.endDate),
    });
  }

  const response = await jatosApi(env, `/jatos/api/v1/results/data?studyUuid=${study.uuid}&asPlainText=true`);
  const rows = [];
  for (const line of (await response.text()).split("\n")) {
    if (!line.trim().startsWith("{")) continue;
    const row = JSON.parse(line);
    rows.push({ ...row, ...runs.get(String(row.jatos_study_result_id)) });
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const name = `${study.dirName}_jatos_${stamp}`;
  if (format === "ndjson") {
    return { filename: `${name}.ndjson`, type: "application/x-ndjson", body: rows.map((r) => JSON.stringify(r)).join("\n") + "\n" };
  }
  return { filename: `${name}.csv`, type: "text/csv", body: toCsv(rows) };
}

const FIRST_COLUMNS = [
  "prolific_pid",
  "prolific_study_id",
  "prolific_session_id",
  "jatos_study_result_id",
  "jatos_worker_id",
  "jatos_worker_type",
  "jatos_study_state",
  "jatos_start_time",
  "jatos_end_time",
  "experiment_version",
];

function toCsv(rows) {
  const seen = new Set(FIRST_COLUMNS);
  const columns = [...FIRST_COLUMNS];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }
  const cell = (value) => {
    if (value === null || value === undefined) return "";
    const text = typeof value === "object" ? JSON.stringify(value) : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [columns.join(","), ...rows.map((row) => columns.map((c) => cell(row[c])).join(","))];
  return lines.join("\r\n") + "\r\n";
}

function send(res, status, text) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(text);
}

function sendJson(res, value) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(value));
}

function sendFile(res, { filename, type, body }) {
  res.setHeader("Content-Type", `${type}; charset=utf-8`);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}
