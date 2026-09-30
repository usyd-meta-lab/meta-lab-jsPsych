---
name: launch-study
description: Check a Meta Lab jsPsych experiment before piloting or launching it, then build it for JATOS or DataPipe. Use when someone wants to pilot, launch, deploy, go live, upload to JATOS, or get the study link for Prolific or SONA.
---

# Pilot and launch a study

Work through these in order and report each result to the user. Stop at the first problem and help fix it.

## 1. Check the setup

Read `study.config.json` and `package.json`, then confirm with the user:

- `"template"` is `false`, and `title` and `dirName` are this study's.
- `recruitment`, `minutes` (and the credit or payment it gives), `devices` and `dataSaving` are right.
- Prolific or SONA: `endRedirectUrl` is set (for SONA, the completion URL with `survey_code=XXXX`).
- The kit is pinned to a release tag (`#v...`), not a branch or a local path.
- The consent form and debrief match the study's ethics protocol.

## 2. Check the experiment

- Run the whole experiment once in the dashboard (`#full`) as a participant would, and check the final data: every trial has the fields the analysis needs, plus `kit_version` and `experiment_version`.
- Check the stimuli warnings from the build (size, missing files).
- Commit everything (`git status` must be clean), so `experiment_version` isn't `-dirty`.

## 3. Build

- **JATOS:** `npm run build:jatos`. It prints the study link to use (with the URL parameters Prolific or SONA need) and the credit or payment to set. The lab's JATOS server isn't set up yet: until it is, tell the user the `.jzip` is ready for import and stop here. Local testing with `npm run jatos` works on their own computer.
- **DataPipe:** `npm run build`, then the user uploads `dist/` to a web host (see the kit's `docs/datapipe.md`) and turns data collection on in DataPipe.

Always give study links with their URL parameters, ready to paste (see the CLAUDE.md recruitment section).

## 4. Pilot, then freeze

- Suggest a small pilot (a few participants) and checking the data before the full launch.
- Once data collection starts, don't update the kit or change the experiment unless the user asks for a specific fix; if they do, commit it and note the new `experiment_version` in the data.
