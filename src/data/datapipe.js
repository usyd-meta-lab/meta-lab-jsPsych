// Saving participant data to DataPipe (pipe.jspsych.org), study.config.json
// "dataSaving": "datapipe". Only the participant build uses this; preview
// mode never saves.
//
// Uses DataPipe's official jsPsych extension. It streams each trial as it
// finishes, so DataPipe keeps the trials of a participant who drops out (as
// a .partial.json file), and at the end saves the complete data as one CSV
// file named <participant ID>_<session or run ID>.csv. The participant is
// sent to the End Redirect URL only after DataPipe has accepted that file.
//
// DataPipe only receives data. The experiment itself is hosted elsewhere
// (any static web host) and participants arrive with Prolific's or SONA's
// URL parameters in the link (see src/recruitment.js).

import PipeExtension from "@jspsych/extension-pipe";
import { initJsPsych } from "jspsych";
import study from "/study.config.json";
import { buildTimeline, options } from "/src/experiment.js";
import { exitFullscreen } from "../blocks/device.js";
import { showStopped, stoppedReason } from "../blocks/stop.js";
import { endRedirectUrl, participantColumns, participantId } from "../recruitment.js";
import { fillRedirectUrl, message, showSaveFailed, showSaving } from "./common.js";

// VITE_DATAPIPE_URL (set when building) is only for testing against a mock.
const DATAPIPE_URL = import.meta.env.VITE_DATAPIPE_URL || "https://pipe.jspsych.org";

const SAVE_TIMEOUT_MS = 30000;

const params = Object.fromEntries(new URLSearchParams(window.location.search));

// DataPipe rejects a second file with the same name, so every run needs its
// own. The participant's ID makes the file easy to match to a submission.
const safe = (text) => String(text).replace(/[^\w-]/g, "_").slice(0, 60);
const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const filename = `${safe(participantId(study, params) ?? "participant")}_${safe(params.SESSION_ID ?? runId)}.csv`;

/** Direct save, used when the participant retries after a failed save. */
async function saveCsv(csv) {
  try {
    const response = await fetch(`${DATAPIPE_URL}/api/data/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "*/*" },
      body: JSON.stringify({ experimentID: study.datapipeExperimentId, filename, data: csv }),
      signal: AbortSignal.timeout(SAVE_TIMEOUT_MS),
    });
    const body = await response.json().catch(() => null);
    // A retry after a save that did arrive gets FILE_EXISTS: the data is safe.
    return { ok: response.ok || body?.error === "FILE_EXISTS", status: response.status, body };
  } catch (error) {
    return { ok: false, status: 0, body: error };
  }
}

function finish(jsPsych) {
  const redirect = endRedirectUrl(study);
  if (redirect) {
    window.location.href = fillRedirectUrl(redirect, params);
  } else {
    message(jsPsych.getDisplayElement(), "All done, thank you! Your responses have been saved.", "You can close this page now.");
  }
}

function explain(result) {
  // Shown in the console only: useful when testing, meaningless to participants.
  const reason = result?.body?.message ?? result?.body?.error ?? result?.body ?? "no response";
  console.error(`DataPipe didn't accept the data (HTTP ${result?.status}): ${reason}`);
}

async function retrySave(jsPsych) {
  const displayElement = jsPsych.getDisplayElement();
  showSaving(displayElement);
  const result = await saveCsv(jsPsych.data.get().csv());
  if (result.ok) {
    finish(jsPsych);
  } else {
    explain(result);
    showSaveFailed(displayElement, () => retrySave(jsPsych));
  }
}

/** Run the experiment for a participant, saving to DataPipe. */
export async function run() {
  if (!study.datapipeExperimentId) {
    message(
      document.body,
      "This experiment isn't set up to save data yet.",
      "Researchers: set datapipeExperimentId in study.config.json and rebuild.",
    );
    return;
  }

  let saveResult = null;
  const jsPsych = initJsPsych({
    ...options,
    extensions: [
      ...(options.extensions ?? []),
      {
        type: PipeExtension,
        params: {
          experiment_id: study.datapipeExperimentId,
          base_url: DATAPIPE_URL,
          filename,
          format: "csv",
          wait_message: "<p>Saving your responses…</p><p>Please don't close this page.</p>",
          on_save: (result) => {
            saveResult = result;
          },
        },
      },
    ],
  });
  jsPsych.data.addProperties({
    ...participantColumns(study, params),
    datapipe_file: filename,
    experiment_version: __EXPERIMENT_VERSION__,
    kit_version: __KIT_VERSION__,
  });

  // The extension saves the complete data before run() returns. Its client
  // has no timeout while a streaming session is still starting, so a request
  // that never answers would leave the participant on "Saving…" for good. If
  // there's no result SAVE_TIMEOUT_MS after the last trial, save directly.
  let settled = false;
  const settle = (next) => {
    if (settled) return;
    settled = true;
    next();
  };
  let watchdog;
  const timeline = [
    {
      timeline: buildTimeline(jsPsych),
      on_timeline_finish: () => {
        watchdog = setTimeout(() => settle(() => retrySave(jsPsych)), SAVE_TIMEOUT_MS);
      },
    },
  ];

  await jsPsych.run(timeline);
  clearTimeout(watchdog);
  exitFullscreen();

  // Stopped early (wrong device, stimuli didn't load): whatever was recorded
  // has been sent; show why and don't redirect, so they aren't paid or credited.
  const stopped = stoppedReason(jsPsych);
  if (stopped) {
    settle(() => showStopped(jsPsych.getDisplayElement(), stopped));
    return;
  }

  settle(() => {
    if (saveResult?.ok) {
      finish(jsPsych);
    } else {
      explain(saveResult);
      showSaveFailed(jsPsych.getDisplayElement(), () => retrySave(jsPsych));
    }
  });
}
