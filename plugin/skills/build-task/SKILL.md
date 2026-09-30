---
name: build-task
description: Add or change trials, blocks, conditions or stimuli in a Meta Lab jsPsych experiment the lab's way. Use when editing src/experiment.js in a folder that uses @usyd-meta-lab/jspsych-kit, e.g. "add a practice block", "add an attention check", "show these images", "counterbalance the conditions".
---

# Build the task the lab's way

The experiment's CLAUDE.md (with the kit instructions it imports) has the full rules. This is the checklist for each change.

1. **Use the kit first.** Device check, consent, demographics, fullscreen, preload and debrief come from `@usyd-meta-lab/jspsych-kit`; never write your own versions. Never edit files in `node_modules/`.

2. **Plugins.** Use official jsPsych v8 plugins from npm (`npm install @jspsych/plugin-...`), imported in `src/experiment.js` and used as `type`. No CDN scripts, no `<script>` tags, no hand-written plugins unless nothing official fits (then say so to the user).

3. **Structure and names.** `buildTimeline(jsPsych)` returns blocks and trials; give every one a short `name` (it labels the dashboard). Use timeline variables for repeated trials, `randomize_order` for shuffling within a block.

4. **Data for the analysis.** Put everything the analysis needs in each trial's `data`: condition, trial type, the correct response, and `correct` computed in `on_finish` (e.g. `data.correct = data.response === data.correct_key`). Every row should be analysable on its own.

5. **Conditions.** Between-participants: assign once at the start (e.g. `const condition = jsPsych.randomization.sampleWithoutReplacement(["a", "b"], 1)[0]`), add it to every row with `jsPsych.data.addProperties({ condition })`, and branch with `conditional_function` or separate timelines. Within-participants: timeline variables. Balanced assignment across participants needs JATOS batch data and isn't available yet; random assignment is fine meanwhile.

6. **Attention checks and exclusions.** Add attention checks as named trials that save `attention_check: true` and `passed`. Record the exclusion rules the user gave (e.g. too-fast responses) as data, not as code that stops the study.

7. **Stimuli.** Files go in `src/stimuli/`; refer to them with `stimulus("name.png")` or `stimuliIn("folder")` from the kit, and keep `preload(jsPsych)` before the task.

8. **Check it.** Preview each changed part with `#only-<n>` (see the CLAUDE.md preview section), check the recorded data has the fields above, and leave the dashboard open for the user unless they asked not to open previews.
