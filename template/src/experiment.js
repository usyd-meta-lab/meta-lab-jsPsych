import htmlKeyboardResponse from "@jspsych/plugin-html-keyboard-response";
// The lab's standard blocks: see the kit's CLAUDE.md for what each one does.
import { consent, debrief, demographics, deviceCheck, fullscreen, preload } from "@usyd-meta-lab/jspsych-kit";

/** Extra options for initJsPsych, used by participant runs and previews. */
export const options = {};

/**
 * Build the experiment timeline.
 *
 * Give each block and trial a `name`. Names label the timeline view in
 * preview mode so you can jump straight to that part of the experiment.
 * jsPsych ignores the `name` property.
 */
export function buildTimeline(jsPsych) {
  const welcome = {
    name: "Welcome",
    timeline: [
      {
        name: "Hello world",
        type: htmlKeyboardResponse,
        stimulus: "<p>Hello world!</p><p>Press any key to continue.</p>",
      },
      {
        name: "Instructions",
        type: htmlKeyboardResponse,
        stimulus: `
          <p>You will see a word printed in colour.</p>
          <p>Press <b>F</b> if the word is RED and <b>J</b> if it is BLUE.</p>
          <p>Press any key to start the practice.</p>`,
      },
    ],
  };

  const colourTrial = {
    name: "Colour trial",
    type: htmlKeyboardResponse,
    stimulus: () =>
      `<p style="font-size: 48px; color: ${jsPsych.evaluateTimelineVariable("colour")}">
        ${jsPsych.evaluateTimelineVariable("word")}
      </p>`,
    choices: ["f", "j"],
    data: {
      word: jsPsych.timelineVariable("word"),
      colour: jsPsych.timelineVariable("colour"),
    },
  };

  const practice = {
    name: "Practice",
    timeline: [colourTrial],
    timeline_variables: [
      { word: "RED", colour: "red" },
      { word: "BLUE", colour: "blue" },
    ],
  };

  const main = {
    name: "Main task",
    timeline: [colourTrial],
    timeline_variables: [
      { word: "RED", colour: "red" },
      { word: "RED", colour: "blue" },
      { word: "BLUE", colour: "blue" },
      { word: "BLUE", colour: "red" },
    ],
    randomize_order: true,
  };

  const goodbye = {
    name: "Goodbye",
    type: htmlKeyboardResponse,
    stimulus: "<p>All done, thank you!</p><p>Press any key to finish.</p>",
  };

  return [deviceCheck(), consent(), demographics(), fullscreen(), preload(jsPsych), welcome, practice, main, goodbye, debrief()];
}
