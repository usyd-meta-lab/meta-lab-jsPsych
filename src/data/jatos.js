// Saving participant data to JATOS (study.config.json "dataSaving": "jatos").
// Only the participant build uses this; preview mode never loads JATOS and
// never saves.
//
// Data format: one JSON object per trial, one per line (NDJSON).
// Each trial is appended as soon as it finishes, so partial data from
// participants who drop out is kept. At most one append is in flight at a
// time; trials that finish meanwhile, or whose append failed, go out with
// the next one, so a bad connection never builds up a queue of requests.
// At the end the complete dataset is submitted again, replacing the
// appended rows, so the stored result is always exactly jsPsych's data.

import { initJsPsych } from "jspsych";
import study from "../../study.config.json";
import { buildTimeline, options } from "../experiment.js";
import { message, prolificColumns, showSaveFailed, showSaving } from "./common.js";

/** Load jatos.js (served by JATOS next to index.html). Resolves to the
 *  `jatos` object, or null when the page is not being run through JATOS. */
function loadJatos() {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "jatos.js";
    script.onload = () => (window.jatos ? window.jatos.onLoad(() => resolve(window.jatos)) : resolve(null));
    script.onerror = () => resolve(null);
    document.head.append(script);
  });
}

/** Columns added to every trial: who the participant is and which build ran. */
function participantInfo(jatos) {
  return {
    ...prolificColumns(jatos.urlQueryParameters ?? {}),
    jatos_study_result_id: jatos.studyResultId,
    jatos_worker_id: jatos.workerId,
    experiment_version: __EXPERIMENT_VERSION__,
  };
}

const toNdjson = (rows) => rows.map((row) => JSON.stringify(row)).join("\n") + "\n";

let unsent = [];
let appending = false;
let finished = false;

/** Queue one finished trial and send it (with any other unsent trials). */
function saveTrial(jatos, row) {
  unsent.push(row);
  appendUnsent(jatos);
}

async function appendUnsent(jatos) {
  if (appending || finished || unsent.length === 0) return;
  const rows = unsent;
  unsent = [];
  appending = true;
  try {
    await jatos.appendResultData(toNdjson(rows));
    appending = false;
    appendUnsent(jatos);
  } catch (error) {
    // Keep the rows; they go out with the next trial or the final submit.
    unsent = rows.concat(unsent);
    appending = false;
    console.warn("Could not save trial data yet; will retry.", error);
  }
}

function addWithdrawButton(jatos) {
  if (!study.withdrawButton) return;
  jatos.addAbortButton({
    text: "Withdraw",
    confirmText: "Do you want to withdraw from this study? Your responses so far will be deleted.",
    tooltip: "Withdraw from the study and delete your responses",
    msg: "Participant withdrew",
  });
}

/**
 * Submit the complete dataset, then end the study in JATOS. JATOS then sends
 * the participant to the study's End Redirect URL (e.g. the Prolific
 * completion link) or shows its own end page.
 */
async function finishStudy(jatos, jsPsych) {
  finished = true;
  const displayElement = jsPsych.getDisplayElement();
  showSaving(displayElement);
  try {
    await jatos.submitResultData(toNdjson(jsPsych.data.get().values()));
    jatos.endStudy();
  } catch (error) {
    jatos.log?.(`Final data submit failed: ${error}`);
    showSaveFailed(displayElement, () => finishStudy(jatos, jsPsych));
  }
}

/** Shown when the participant build is opened without JATOS. */
function showNotInJatos() {
  message(
    document.body,
    "This experiment can't start because it wasn't opened through its study link.",
    "If you are a participant, please return to the study page and use the link provided there.",
  );
}

/** Run the experiment for a participant, saving to JATOS. */
export async function run() {
  const jatos = await loadJatos();
  if (!jatos) {
    showNotInJatos();
    return;
  }

  const jsPsych = initJsPsych({
    ...options,
    on_data_update: (row) => {
      options.on_data_update?.(row);
      saveTrial(jatos, row);
    },
  });
  jsPsych.data.addProperties(participantInfo(jatos));
  addWithdrawButton(jatos);

  await jsPsych.run(buildTimeline(jsPsych));
  await finishStudy(jatos, jsPsych);
}
