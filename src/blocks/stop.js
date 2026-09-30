// Ending a run early because the participant can't take part: a device that
// isn't allowed (device.js) or stimuli that wouldn't load (preload.js).
// The trial that stops the run saves `stopped: "<reason>"`. The data-saving
// modules then show the matching message, save what was recorded, and end
// without the completion redirect, so the participant isn't paid or credited.

import study from "/study.config.json";
import { describeDevices, devicesOf } from "../devices.js";
import { recruitmentOf } from "../recruitment.js";

/** Why this run was stopped early ("device" or "preload"), or null. */
export function stoppedReason(jsPsych) {
  const row = jsPsych.data.get().values().find((r) => r.stopped);
  return row ? row.stopped : null;
}

/** What the participant is told, by reason and where they came from. */
export function stopMessage(reason) {
  const recruitment = recruitmentOf(study).name;
  if (reason === "device") {
    const devices = describeDevices(devicesOf(study));
    const next = {
      prolific: "Please close this page and return the study on Prolific.",
      sona: `Please close this page and open the study from SONA on ${devices}.`,
      lab: "Please let the researcher know.",
    }[recruitment];
    return `<p>Sorry, this study can only be done on ${devices}.</p><p>${next}</p>`;
  }
  const next = {
    prolific: "Please close this page and return the study on Prolific.",
    sona: "Please close this page and contact the researcher named on the study's SONA page.",
    lab: "Please let the researcher know.",
  }[recruitment];
  return `<p>Sorry, part of this study couldn't be loaded, so it can't continue.</p><p>${next}</p>`;
}

/** Show the stop message again (after data saving has used the screen). */
export function showStopped(displayElement, reason) {
  displayElement.innerHTML = `<div class="jspsych-content">${stopMessage(reason)}</div>`;
}
