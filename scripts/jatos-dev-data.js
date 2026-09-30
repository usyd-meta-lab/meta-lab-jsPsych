// Dev-server-only endpoints that let the preview timeline download real
// participant data from JATOS. The JATOS API token stays in this Node
// process; the browser only talks to the local dev server. This plugin runs
// only under `npm run dev` and is never part of any build.
//
// Config (in .env.local, or as environment variables):
//   JATOS_URL=https://jatos.example.edu.au
//   JATOS_API_TOKEN=jap_...

import { readFileSync } from "node:fs";
import { loadEnv } from "vite";

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

// JATOS study states, grouped the way a researcher reads them.
const STATE_GROUPS = {
  FINISHED: "finished",
  ABORTED: "withdrawn",
  FAIL: "failed",
  PRE: "incomplete",
  STARTED: "incomplete",
  DATA_RETRIEVED: "incomplete",
};

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
          if (route === "/summary") return sendJson(res, await summary(env));
          if (route === "/data.csv") return sendFile(res, await exportData(env, "csv"));
          if (route === "/data.ndjson") return sendFile(res, await exportData(env, "ndjson"));
          send(res, 404, "Not found.");
        } catch (error) {
          send(res, 502, error.message);
        }
      });
    },
  };
}

function studyConfig() {
  return JSON.parse(readFileSync("study.config.json", "utf8"));
}

const NOT_IMPORTED = "This study isn't on the JATOS server yet, or the token's user isn't a member of it. Run npm run build:jatos and import it.";

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
  if (!env.JATOS_URL || !env.JATOS_API_TOKEN) return { configured: false };
  const base = { configured: true, server: new URL(env.JATOS_URL).host, title: study.title };
  if (!study.uuid) {
    return { ...base, error: "This study has no UUID yet. Run npm run build:jatos and import it into JATOS." };
  }
  try {
    const counts = { finished: 0, incomplete: 0, withdrawn: 0, failed: 0, tests: 0 };
    for (const result of await metadata(env, study.uuid)) {
      if (result.workerType === "Jatos") counts.tests += 1;
      else counts[STATE_GROUPS[result.studyState] ?? "incomplete"] += 1;
    }
    return { ...base, counts };
  } catch (error) {
    return { ...base, error: error.message };
  }
}

const toIso = (ms) => (ms ? new Date(ms).toISOString() : null);

async function exportData(env, format) {
  const study = studyConfig();
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
