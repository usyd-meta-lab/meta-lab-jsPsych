// Preview mode: a clickable timeline of the experiment for researchers.
// Loaded only by `npm run dev` and `npm run build:preview` (see main.js).
//
// Routes (URL hash):
//   (none)        timeline view
//   #full         run the whole experiment
//   #from-2.1     run from item 2.1 to the end
//   #only-2.1     run only item 2.1 (inside its parent blocks)
// Item numbers match the ones shown in the timeline view.

import { initJsPsych } from "jspsych";
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
  items = describeTimeline(buildTimeline(initJsPsych()));
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
          el("p", { class: "pv-eyebrow" }, "Preview mode"),
          el("h1", {}, document.title),
          el(
            "p",
            { class: "pv-note" },
            "Click any block or trial to start the experiment from that point. ",
            "Use Only this to run a single part. Participants never see this screen.",
          ),
        ),
        el(
          "button",
          { class: "pv-primary", type: "button", onclick: () => navigate("full") },
          "Run full experiment",
        ),
      ),
      invalidHash &&
        el(
          "p",
          { class: "pv-warning", role: "status" },
          `No part of the timeline matches #${invalidHash}. The timeline may have changed.`,
        ),
      el("ol", { class: "pv-list pv-root" }, items.map(renderItem)),
    ),
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
  if (activeRun !== run) return; // the researcher navigated away mid-run
  activeRun = null;
  renderFinished(stage, jsPsych.data.get(), fileStem(mode, path));
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

function renderFinished(stage, data, stem) {
  const count = data.count();
  const status = el("span", { class: "pv-status", role: "status" });
  stage.replaceChildren(
    el(
      "section",
      { class: "pv-done" },
      el("h2", {}, "Finished"),
      el("p", {}, `${count} ${count === 1 ? "trial" : "trials"} recorded. Data below.`),
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
