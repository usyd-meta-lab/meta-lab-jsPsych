import "jspsych/css/jspsych.css";
import { initJsPsych } from "jspsych";
import { buildTimeline, options } from "./experiment.js";
import {
  addWithdrawButton,
  finishStudy,
  loadJatos,
  participantInfo,
  saveTrial,
  showNotInJatos,
} from "./data.js";

async function runExperiment() {
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

// Preview mode only exists in `npm run dev` and `npm run build:preview`.
// `npm run build` removes this branch and the preview code entirely,
// so participants always get the plain experiment.
if (import.meta.env.DEV || import.meta.env.MODE === "preview") {
  import("./preview/preview.js").then(({ startPreview }) => startPreview());
} else {
  runExperiment();
}
