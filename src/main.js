import "jspsych/css/jspsych.css";

// Preview mode only exists in `npm run dev` and `npm run build:preview`.
// Participant builds (`npm run build`) contain only the data-saving module
// chosen by "dataSaving" in study.config.json; the other one and the
// preview code are left out entirely.
if (import.meta.env.DEV || import.meta.env.MODE === "preview") {
  import("./preview/preview.js").then(({ startPreview }) => startPreview());
} else if (__DATA_SAVING__ === "datapipe") {
  import("./data/datapipe.js").then(({ run }) => run());
} else {
  import("./data/jatos.js").then(({ run }) => run());
}
