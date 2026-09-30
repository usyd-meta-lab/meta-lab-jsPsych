// Experiment dashboard: participant numbers from JATOS (dev server only) and
// a clickable timeline for previewing any part of the experiment.
// Loaded only by `npm run dev` and `npm run build:preview` (see main.js).
//
// Routes (URL hash):
//   (none)        timeline view
//   #full         run the whole experiment
//   #from-2.1     run from item 2.1 to the end
//   #only-2.1     run only item 2.1 (inside its parent blocks)
// Item numbers match the ones shown in the timeline view.

import { initJsPsych } from "jspsych";
import { exitFullscreen } from "../blocks/device.js";
import { stopMessage, stoppedReason } from "../blocks/stop.js";
import { buildTimeline, options } from "../experiment.js";
import {
  describeTimeline,
  findItem,
  formatPath,
  labelsAlong,
  parsePath,
  sliceFrom,
  sliceOnly,
} from "./timeline.js";
import "./preview.css";

const MODE_LABELS = {
  full: "Full experiment",
  from: "From here to the end",
  only: "Only this part",
};

let root;
let items;
let activeRun = null;
let refreshTimer = null;
// In a published Claude artifact, files can only be saved through the
// viewer's `downloads` capability. Elsewhere (the dev server) window.claude
// is absent and a normal browser download is used.
let artifactDownloads = Promise.resolve(null);

export function startPreview() {
  if (window.claude?.use) artifactDownloads = window.claude.use("downloads");
  root = document.createElement("div");
  root.className = "pv";
  document.body.append(root);
  // Describe the timeline once with a throwaway jsPsych instance.
  try {
    items = describeTimeline(buildTimeline(initJsPsych()));
  } catch (error) {
    // e.g. stimulus("cat.pgn"): say what's wrong instead of a blank page.
    root.append(
      el(
        "main",
        { class: "pv-page" },
        el("p", { class: "pv-eyebrow" }, "Experiment dashboard"),
        el("h1", {}, "The experiment has an error"),
        el("p", { class: "pv-warning" }, error.message),
        el("p", { class: "pv-note" }, "Fix it in src/experiment.js. This page reloads when you save."),
      ),
    );
    throw error;
  }
  window.addEventListener("popstate", route);
  route();
}

function navigate(hash) {
  const url = hash ? `#${hash}` : location.pathname + location.search;
  history.pushState(null, "", url);
  route();
}

function parseRoute() {
  const hash = location.hash.slice(1);
  if (hash === "full") return { mode: "full", path: [] };
  const match = /^(from|only)-(.+)$/.exec(hash);
  if (!match) return null;
  const path = parsePath(match[2]);
  if (!path || !findItem(items, path)) return { invalid: hash };
  return { mode: match[1], path };
}

function route() {
  stopActiveRun();
  clearInterval(refreshTimer);
  const target = parseRoute();
  if (target && !target.invalid) {
    runPreview(target.mode, target.path);
  } else {
    renderTimeline(target?.invalid);
  }
}

// ---------------------------------------------------------------- timeline

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (value !== undefined) node.setAttribute(key, value);
  }
  node.append(...children.flat().filter((child) => child != null && child !== false));
  return node;
}

function renderItem(item) {
  const number = formatPath(item.path);
  return el(
    "li",
    { class: `pv-item pv-${item.kind}` },
    el(
      "div",
      { class: "pv-row" },
      el(
        "button",
        {
          class: "pv-jump",
          type: "button",
          title: "Start the experiment from here",
          onclick: () => navigate(`from-${number}`),
        },
        el("span", { class: "pv-num" }, number),
        el("span", { class: "pv-label" }, item.label),
        el(
          "span",
          { class: "pv-details" },
          item.details.map((detail) => el("span", { class: "pv-chip" }, detail)),
        ),
      ),
      el(
        "button",
        {
          class: "pv-only",
          type: "button",
          title: "Run only this part",
          onclick: () => navigate(`only-${number}`),
        },
        "Only this",
      ),
    ),
    item.children.length > 0 && el("ol", { class: "pv-list" }, item.children.map(renderItem)),
  );
}

function renderTimeline(invalidHash) {
  root.replaceChildren(
    el(
      "main",
      { class: "pv-page" },
      el(
        "header",
        { class: "pv-header" },
        el(
          "div",
          {},
          el("p", { class: "pv-eyebrow" }, "Experiment dashboard"),
          el("h1", {}, document.title),
          el("p", { class: "pv-note" }, "For the research team only. Participants never see this page."),
        ),
        el(
          "button",
          { class: "pv-primary", type: "button", onclick: () => navigate("full") },
          "Preview full experiment",
        ),
      ),
      // Real participant numbers and data from JATOS: dev server only (see
      // scripts/jatos-dev-data.js). Never in the artifact or participant build.
      import.meta.env.DEV && participantsSection(),
      el(
        "section",
        { class: "pv-section", "aria-labelledby": "pv-timeline-heading" },
        el("h2", { id: "pv-timeline-heading" }, "Timeline"),
        el(
          "p",
          { class: "pv-note" },
          "Click any block or trial to preview the experiment from that point. ",
          "Use Only this to run a single part.",
        ),
        invalidHash &&
          el(
            "p",
            { class: "pv-warning", role: "status" },
            `No part of the timeline matches #${invalidHash}. The timeline may have changed.`,
          ),
        el("ol", { class: "pv-list pv-root" }, items.map(renderItem)),
      ),
    ),
  );
}

// ------------------------------------------------------------- participants

function participantsSection() {
  const body = el("div", { class: "pv-participants-body" }, el("p", { class: "pv-note" }, "Checking JATOS…"));
  const meta = el("span", { class: "pv-note" });
  const refresh = el("button", { type: "button", class: "pv-small" }, "Refresh");
  const section = el(
    "section",
    { class: "pv-section pv-participants", "aria-labelledby": "pv-participants-heading" },
    el("div", { class: "pv-section-head" }, el("h2", { id: "pv-participants-heading" }, "Participants"), meta, refresh),
    body,
  );

  const load = () =>
    fetch("/__jatos/summary")
      .then((response) => response.json())
      .then((info) => renderParticipants(body, meta, refresh, info))
      .catch(() => section.remove());
  refresh.addEventListener("click", load);
  load();
  // Keep the numbers current while the dashboard is open.
  refreshTimer = setInterval(load, 60000);
  return section;
}

const formatTime = (ms) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function formatDuration(minutes) {
  if (minutes < 1) return `${Math.round(minutes * 60)} s`;
  if (minutes < 90) return `${minutes.toFixed(1)} min`;
  return `${(minutes / 60).toFixed(1)} h`;
}

function timeAgo(ms) {
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return new Date(ms).toLocaleDateString();
}

function tile(label, value, hint, extraClass = "") {
  return el(
    "div",
    { class: `pv-tile ${extraClass}`, title: hint },
    el("span", { class: "pv-tile-label" }, label),
    el("span", { class: "pv-tile-value" }, String(value)),
  );
}

function compensationText({ minutes, credit, payment }) {
  return credit !== undefined
    ? `${minutes} minutes: set the study to ${credit} ${credit === 1 ? "credit" : "credits"} on SONA (the consent form says the same).`
    : `${minutes} minutes: set the reward to ${payment} on Prolific (the consent form says the same).`;
}

function devicesText({ devices, name }) {
  const labels = { computer: "computers", tablet: "tablets", phone: "phones" };
  const list = devices.map((d) => labels[d]).join(", ");
  // Prolific's own device filter stops excluded devices being recruited at all.
  const prolific = { computer: "Desktop", tablet: "Tablet", phone: "Mobile" };
  const filter = devices.map((d) => prolific[d]).join(", ");
  return name === "prolific"
    ? `Allowed devices: ${list}. On Prolific, set Device compatibility to ${filter} only.`
    : `Allowed devices: ${list}. Other devices are stopped at the device check.`;
}

/** Where participants come from, the study URL to give out, and where they go at the end. */
function recruitmentPanel(recruitment, datapipe) {
  if (!recruitment) return null;
  const base = datapipe ? "<your web host address>" : `<JATOS ${recruitment.jatosLink} link>`;
  const url = recruitment.linkParams ? `${base}?${recruitment.linkParams}` : base;
  const where = { sona: "SONA's Study URL field", prolific: "Prolific's study URL field", lab: "the browser on each lab computer" };
  return el(
    "div",
    { class: "pv-recruitment" },
    el("p", {}, el("strong", {}, `Recruitment: ${recruitment.label}. `), `Study URL for ${where[recruitment.name]}:`),
    el("code", { class: "pv-code" }, url),
    recruitment.linkParams &&
      el("p", { class: "pv-note" }, "Keep the part after ? exactly as shown: it records each participant's ID."),
    // Must match what's set on SONA or Prolific and what the consent form says.
    recruitment.compensation &&
      el("p", { class: "pv-note" }, compensationText(recruitment.compensation)),
    el("p", { class: "pv-note" }, devicesText(recruitment)),
    recruitment.redirect
      ? el("p", { class: "pv-note" }, "At the end, participants are sent to: ", el("code", {}, recruitment.redirect))
      : el("p", { class: "pv-note" }, "At the end, participants see a thank-you page (no redirect)."),
    recruitment.problems.map((problem) => el("p", { class: "pv-warning" }, problem)),
  );
}

function renderParticipants(body, meta, refresh, info) {
  const recruitment = recruitmentPanel(info.recruitment, info.datapipe);
  const show = (...children) => body.replaceChildren(...[recruitment, ...children].filter(Boolean));
  if (info.datapipe) {
    refresh.hidden = true;
    meta.textContent = "DataPipe";
    show(
      el(
        "p",
        { class: "pv-note" },
        "This study saves data with DataPipe, which can't report participant numbers here. ",
        "Check your experiment in the DataPipe dashboard and the data files in your storage provider (see docs/datapipe.md).",
      ),
      el(
        "div",
        { class: "pv-actions" },
        el("a", { class: "pv-button", href: "https://pipe.jspsych.org", target: "_blank", rel: "noopener" }, "Open DataPipe"),
      ),
    );
    return;
  }
  if (!info.configured) {
    refresh.hidden = true;
    show(
      el(
        "p",
        { class: "pv-note" },
        "Run npm run jatos to test with a local JATOS on this computer, or add JATOS_URL and JATOS_API_TOKEN to .env.local for the lab's server (see docs/jatos.md).",
      ),
    );
    return;
  }
  if (info.error) {
    meta.textContent = `${info.title} on ${info.server}`;
    show(el("p", { class: "pv-warning" }, info.error));
    return;
  }

  meta.textContent = `${info.server} · updated ${formatTime(info.updatedAt)}`;
  const { counts } = info;
  const facts = [
    info.completionRate !== null && `completion rate ${Math.round(info.completionRate * 100)}%`,
    info.medianMinutes !== null && `median time ${formatDuration(info.medianMinutes)}`,
    info.lastCompletedAt && `last completed ${timeAgo(info.lastCompletedAt)}`,
    counts.tests > 0 && `${counts.tests} test ${counts.tests === 1 ? "run" : "runs"} not counted`,
  ].filter(Boolean);

  const status = el("span", { class: "pv-status", role: "status" });
  show(
    info.local &&
      el(
        "p",
        { class: "pv-note" },
        "Testing with local JATOS: data from test runs stays on this computer. Run npm run jatos again after changing the experiment.",
      ),
    el(
      "div",
      { class: "pv-hero" },
      el("span", { class: "pv-hero-value" }, String(counts.completed)),
      el(
        "div",
        { class: "pv-hero-text" },
        el("span", { class: "pv-hero-label" }, counts.completed === 1 ? "participant completed" : "participants completed"),
        facts.length > 0 && el("span", { class: "pv-note" }, facts.join(" · ")),
      ),
    ),
    el(
      "div",
      { class: "pv-tiles" },
      tile(
        "In progress",
        counts.inProgress,
        `Started, not finished, and active in the last ${info.inProgressMinutes} minutes`,
        counts.inProgress > 0 ? "pv-live" : "",
      ),
      tile("Dropped out", counts.droppedOut, `Started but inactive for over ${info.inProgressMinutes} minutes`),
      tile("Withdrew", counts.withdrawn, "Used the withdraw button; their data was deleted"),
      tile("Failed", counts.failed, "JATOS ended the run, e.g. after a page reload"),
      tile("Wrong device", counts.wrongDevice, "Stopped at the device check; not paid or credited"),
    ),
    el(
      "div",
      { class: "pv-actions" },
      info.studyLink &&
        el(
          "a",
          { class: "pv-button pv-primary", href: info.studyLink, target: "_blank", rel: "noopener" },
          "Run as participant",
        ),
      jatosDownloadButton("Download CSV", "/__jatos/data.csv", status),
      jatosDownloadButton("Download NDJSON", "/__jatos/data.ndjson", status),
      status,
    ),
  );
}

function jatosDownloadButton(label, url, status) {
  return el(
    "button",
    {
      type: "button",
      onclick: async () => {
        status.textContent = "Downloading from JATOS…";
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(await response.text());
          const filename = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition"))?.[1];
          status.textContent = await saveFile(filename ?? "jatos_data.txt", await response.text());
        } catch (error) {
          status.textContent = `Download failed: ${error.message}`;
        }
      },
    },
    label,
  );
}

// --------------------------------------------------------------------- run

function runBar(mode, path) {
  const where = mode === "full" ? [] : labelsAlong(items, path);
  return el(
    "nav",
    { class: "pv-bar" },
    el("button", { class: "pv-back", type: "button", onclick: () => navigate("") }, "← Timeline"),
    el(
      "span",
      { class: "pv-where" },
      where.length > 0 && el("span", { class: "pv-crumbs" }, where.join(" › ")),
      el("span", { class: "pv-mode" }, MODE_LABELS[mode]),
    ),
    el("button", { class: "pv-restart", type: "button", onclick: route }, "Restart"),
  );
}

async function runPreview(mode, path) {
  const stage = el("div", { class: "pv-stage" });
  root.replaceChildren(runBar(mode, path), stage);

  const jsPsych = initJsPsych({ ...options, display_element: stage });
  const run = { jsPsych };
  activeRun = run;

  const full = buildTimeline(jsPsych);
  const timeline =
    mode === "from" ? sliceFrom(full, path) : mode === "only" ? sliceOnly(full, path) : full;

  await jsPsych.run(timeline);
  exitFullscreen();
  if (activeRun !== run) return; // the researcher navigated away mid-run
  activeRun = null;
  renderFinished(stage, jsPsych.data.get(), fileStem(mode, path), stoppedReason(jsPsych));
}

function stopActiveRun() {
  if (!activeRun) return;
  const { jsPsych } = activeRun;
  activeRun = null;
  try {
    jsPsych.abortExperiment();
  } catch {
    // Already finished or not started yet.
  }
  exitFullscreen();
}

// ---------------------------------------------------------------- download

function fileStem(mode, path) {
  const part = mode === "full" ? "full" : `${mode}-${formatPath(path)}`;
  const time = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return `preview_${part}_${time}`;
}

async function saveFile(filename, text) {
  if (window.claude?.use) {
    const downloads = await artifactDownloads;
    if (!downloads) return "Downloads aren't available in this view.";
    try {
      await downloads.save({ filename, data: text });
      return `Saved ${filename}.`;
    } catch (error) {
      if (error?.code === "declined") return "";
      if (error?.code === "rate_limited") return "A save prompt is already open.";
      return "Downloads aren't available in this view.";
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const link = el("a", { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return `Saved ${filename}.`;
}

function downloadButton(label, filename, getText, status) {
  return el(
    "button",
    {
      type: "button",
      onclick: async () => {
        status.textContent = await saveFile(filename, getText());
      },
    },
    label,
  );
}

const STOP_REASONS = {
  device: "Stopped at the device check: this device isn't allowed. ",
  preload: "Stopped because stimuli failed to load (see failed_files below). ",
};

function stoppedNotice(reason) {
  const shown = el("div", { class: "pv-excluded-message" });
  shown.innerHTML = stopMessage(reason);
  return el(
    "div",
    { class: "pv-warning" },
    el("p", {}, el("strong", {}, STOP_REASONS[reason]), "Participants see:"),
    shown,
    el("p", {}, "They aren't redirected, so they aren't paid or credited."),
  );
}

function renderFinished(stage, data, stem, stopped = null) {
  const count = data.count();
  const status = el("span", { class: "pv-status", role: "status" });
  stage.replaceChildren(
    el(
      "section",
      { class: "pv-done" },
      el("h2", {}, "Finished"),
      el("p", {}, `${count} ${count === 1 ? "trial" : "trials"} recorded. Data below.`),
      // Participants on a device that isn't allowed see this and nothing more.
      stopped && stoppedNotice(stopped),
      el(
        "div",
        { class: "pv-actions" },
        el("button", { class: "pv-primary", type: "button", onclick: route }, "Run again"),
        el("button", { type: "button", onclick: () => navigate("") }, "Back to timeline"),
        downloadButton("Download CSV", `${stem}.csv`, () => data.csv(), status),
        downloadButton("Download JSON", `${stem}.json`, () => data.json(true), status),
        status,
      ),
      el("pre", { class: "pv-data" }, data.json(true)),
    ),
  );
}
