// What experiments import from the kit:
//
//   import { deviceCheck, consent, demographics, fullscreen, preload, debrief, stimulus } from "@usyd-meta-lab/jspsych-kit";
//
// Everything else (saving data, the dashboard, the build) runs by itself.

export { consent } from "./blocks/consent.js";
export { debrief } from "./blocks/debrief.js";
export { demographics } from "./blocks/demographics.js";
export { deviceCheck, fullscreen } from "./blocks/device.js";
export { preload } from "./blocks/preload.js";
export { stimuliIn, stimulus } from "./stimuli.js";
