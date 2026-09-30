// Saving participant data to JATOS. Only the participant build uses this;
// preview mode never loads JATOS and never saves.
//
// Data format: one JSON object per trial, one per line (NDJSON).
// Each trial is appended as soon as it finishes, so partial data from
// participants who drop out is kept. At most one append is in flight at a
// time; trials that finish meanwhile, or whose append failed, go out with
// the next one, so a bad connection never builds up a queue of requests.
// At the end the complete dataset is submitted again, replacing the
// appended rows, so the stored result is always exactly jsPsych's data.

import study from "../study.config.json";

/** Load jatos.js (served by JATOS next to index.html). Resolves to the
 *  `jatos` object, or null when the page is not being run through JATOS. */
export function loadJatos() {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "jatos.js";
    script.onload = () => (window.jatos ? window.jatos.onLoad(() => resolve(window.jatos)) : resolve(null));
    script.onerror = () => resolve(null);
    document.head.append(script);
  });
}

/** Columns added to every trial: who the participant is and which build ran. */
export function participantInfo(jatos) {
  const params = jatos.urlQueryParameters ?? {};
  return {
    prolific_pid: params.PROLIFIC_PID ?? null,
    prolific_study_id: params.STUDY_ID ?? null,
    prolific_session_id: params.SESSION_ID ?? null,
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
export function saveTrial(jatos, row) {
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

export function addWithdrawButton(jatos) {
  if (!study.withdrawButton) return;
  jatos.addAbortButton({
    text: "Withdraw",
    confirmText: "Do you want to withdraw from this study? Your responses so far will be deleted.",
    tooltip: "Withdraw from the study and delete your responses",
    msg: "Participant withdrew",
  });
}

function message(displayElement, ...paragraphs) {
  const content = document.createElement("div");
  content.className = "jspsych-content";
  for (const text of paragraphs) {
    const p = document.createElement("p");
    p.textContent = text;
    content.append(p);
  }
  displayElement.replaceChildren(content);
  return content;
}

/**
 * Submit the complete dataset, then end the study in JATOS. JATOS then sends
 * the participant to the study's End Redirect URL (e.g. the Prolific
 * completion link) or shows its own end page.
 */
export async function finishStudy(jatos, jsPsych) {
  finished = true;
  const displayElement = jsPsych.getDisplayElement();
  message(displayElement, "Saving your responses…", "Please don't close this page.");
  try {
    await jatos.submitResultData(toNdjson(jsPsych.data.get().values()));
    jatos.endStudy();
  } catch (error) {
    jatos.log?.(`Final data submit failed: ${error}`);
    const content = message(
      displayElement,
      "We couldn't save your responses. Please check your internet connection and try again.",
      "Please don't close this page, or your responses will be lost.",
    );
    const retry = document.createElement("button");
    retry.className = "jspsych-btn";
    retry.textContent = "Try again";
    retry.addEventListener("click", () => finishStudy(jatos, jsPsych));
    content.append(retry);
  }
}

/** Shown when the participant build is opened without JATOS. */
export function showNotInJatos() {
  message(
    document.body,
    "This experiment can't start because it wasn't opened through its study link.",
    "If you are a participant, please return to the study page and use the link provided there.",
  );
}
