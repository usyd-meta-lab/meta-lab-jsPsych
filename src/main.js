import "jspsych/css/jspsych.css";
import { initJsPsych } from "jspsych";
import { buildTimeline, options } from "./experiment.js";

async function runExperiment() {
  const jsPsych = initJsPsych({
    ...options,
    on_finish: () => {
      jsPsych.data.displayData("json");
    },
  });
  await jsPsych.run(buildTimeline(jsPsych));
}

// Preview mode only exists in `npm run dev` and `npm run build:preview`.
// `npm run build` removes this branch and the preview code entirely,
// so participants always get the plain experiment.
if (import.meta.env.DEV || import.meta.env.MODE === "preview") {
  import("./preview/preview.js").then(({ startPreview }) => startPreview());
} else {
  runExperiment();
}
