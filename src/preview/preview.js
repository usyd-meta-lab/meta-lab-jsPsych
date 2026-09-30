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

export function startPreview() {
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
  renderFinished(stage, jsPsych.data.get());
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

function renderFinished(stage, data) {
  const count = data.count();
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
      ),
      el("pre", { class: "pv-data" }, data.json(true)),
    ),
  );
}
