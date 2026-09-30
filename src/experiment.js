import { initJsPsych } from "jspsych";
import htmlKeyboardResponse from "@jspsych/plugin-html-keyboard-response";

/**
 * Build and run the experiment.
 * Edit the timeline here when designing a new study.
 */
export async function run() {
  const jsPsych = initJsPsych({
    on_finish: () => {
      jsPsych.data.displayData("json");
    },
  });

  const hello = {
    type: htmlKeyboardResponse,
    stimulus: "<p>Hello world!</p><p>Press any key to finish.</p>",
  };

  await jsPsych.run([hello]);
}
