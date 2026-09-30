# Meta Lab jsPsych experiment

A jsPsych v8 experiment built on the USYD Meta Lab kit (`@usyd-meta-lab/jspsych-kit`). The experiment's own files are small: the timeline, its settings and its stimuli. Everything else (the dashboard, saving data, the standard blocks, the builds) comes from the kit, installed in `KIT` (short for `node_modules/@usyd-meta-lab/jspsych-kit` below). Its docs are in `KIT/docs/`.

## The kit

- Never edit files in `KIT` (or anywhere in `node_modules/`): changes are lost on the next `npm install` and silently make this study differ from what the version number says. If the kit has a bug or needs a feature, tell the user it's a kit change for the lab's kit repository (usyd-meta-lab/meta-lab-jsPsych).
- `package.json` pins the kit to one release, e.g. `"@usyd-meta-lab/jspsych-kit": "github:usyd-meta-lab/meta-lab-jsPsych#v0.1.0"`. To update, change the tag, run `npm install`, then preview the whole study. Never update the kit while a study is collecting data unless the user asks for a specific fix: it can change timing or saving mid-study. Every data row records `kit_version` and `experiment_version` (this repo's git commit).

## Starting a new study

When the user starts a new study (a fresh copy made with `jspsych-kit new`, or says "set up this experiment"), ask these questions before building anything, skipping any they've already answered. Ask them together in one message, in plain language (the user may not code), then set everything up from the answers.

1. **Study name.** Set `title` (shown in the browser tab and JATOS) and a matching `dirName` (letters, digits, `-` and `_`) in `study.config.json`, and check `"template"` is `false`. Also set the `<title>` in `index.html`.
2. **Ethics protocol.** Is the study covered by HREC 2022/796? If yes, use the kit's `consent()` and `debrief()`. If not, ask for the approved Participant Information Statement and debrief before building, and add them word for word as the study's own blocks in `src/blocks/`, modelled on `KIT/src/blocks/consent.js` (see [Standard lab blocks](#standard-lab-blocks)).
3. **Where participants come from:** Prolific, SONA or in the lab. Set `"recruitment"` and ask for the completion URL (see [Recruitment](#recruitment-prolific-sona-or-in-the-lab)).
4. **How long the study takes, in minutes.** Set `"minutes"`, then tell them the SONA credit or Prolific payment it works out to.
5. **Which devices participants may use:** computers, tablets and/or phones. Set `"devices"`, e.g. `["computer"]`. For Prolific, tell them to set Prolific's Device compatibility to match.
6. **The design and what will be analysed:** the conditions, whether each is between or within participants (and how participants are assigned: at random unless they say otherwise), the key measures, and any exclusion rules (attention checks, minimum accuracy, too-fast responses). Record in each trial's `data` everything the analysis needs, e.g. `condition`, `correct`, the correct response, so every data row can be analysed on its own. Add attention checks as named trials.
7. **Where data is saved:** JATOS (the default) or DataPipe. For DataPipe, set `"dataSaving": "datapipe"`, ask for the DataPipe experiment ID for `datapipeExperimentId`, and point them to `KIT/docs/datapipe.md` for turning on data collection and hosting.

8. **Open the preview after each change?** Recommend yes: the experiment dashboard opens (in the Browser pane, or as an artifact link in cloud sessions) so they can click through what was just built. If they say no, still check your changes the same way, but don't open the Browser pane or publish an artifact until they ask; tell them how to open it themselves (`npm run dev`).

Afterwards, summarise the setup back to them (name, protocol, pool, length and pay or credit, devices, design, data saving, preview) before building.

## Layout

This study's files:

- `src/experiment.js`: the experiment. `buildTimeline(jsPsych)` returns the timeline; `options` are passed to `initJsPsych`. Edit this file when designing a study.
- `src/stimuli/`: images, audio and video (see [Stimuli](#stimuli-images-audio-video)).
- `src/blocks/`: only for blocks this study needs that the kit doesn't have, e.g. another protocol's consent form.
- `study.config.json`: study settings (name, recruitment, length, devices, data saving). See `KIT/docs/jatos.md`.
- `index.html`: page shell. Pins a light background so previews look the same in dark mode.
- `src/main.js`, `vite.config.js`: one line each, loading the kit. Leave them alone.
- `.claude/launch.json`: preview server config for the Claude Code desktop app.

In the kit (read, never edit):

- `KIT/src/blocks/`: the standard blocks. `KIT/src/stimuli.js`: `stimulus()` and `stimuliIn()`.
- `KIT/src/data/`: saving participant data (`jatos.js` or `datapipe.js`, chosen by `dataSaving`). Only the participant build uses them.
- `KIT/src/preview/`: the experiment dashboard. Never shipped to participants.
- `KIT/src/recruitment.js`: Prolific, SONA or lab participants (study link parameters, ID columns, end redirect). See `KIT/docs/recruitment.md`.

## Adding plugins

Install jsPsych plugins from npm into this study and import them in `src/experiment.js`:

```sh
npm install @jspsych/plugin-image-keyboard-response
```

```js
import imageKeyboardResponse from "@jspsych/plugin-image-keyboard-response";
```

Use jsPsych v8 syntax (`initJsPsych`, `await jsPsych.run(timeline)`, plugin classes as `type`). Do not load jsPsych from a CDN or add `<script>` tags for plugins.

## Stimuli (images, audio, video)

Put every image, audio and video file in `src/stimuli/` (subfolders are fine) and refer to it with the kit's helpers: `import { stimulus, stimuliIn } from "@usyd-meta-lab/jspsych-kit"`, then `stimulus("cat.png")` for one file, `stimuliIn("faces")` for every file in a folder (e.g. `timeline_variables: stimuliIn("faces").map((face) => ({ face }))`). This works in dev, the participant build and the artifact preview. Never use `public/`, hard-coded paths, or links to files on other sites for stimuli.

- Include the kit's `preload(jsPsych)` just before the task. It loads everything in `src/stimuli/`, videos included. If loading fails, the run stops without the completion redirect.
- The build fails if a `stimulus("...")` or `stimuliIn("...")` names a missing file, and warns when stimuli are large: participants download all of them before the task (the preload gives up after 5 minutes), and the artifact preview holds only about 10 MB. Pass these warnings on to the user, and suggest compressing big videos (e.g. 720p H.264 MP4) or previewing locally.

## Standard lab blocks

The kit has ready-made blocks every study should use instead of writing its own. Import them all from the kit: `import { deviceCheck, consent, demographics, fullscreen, preload, debrief } from "@usyd-meta-lab/jspsych-kit"`. Their code is in `KIT/src/blocks/`. The usual order is `deviceCheck()`, `consent()`, `demographics()`, `fullscreen()`, `preload(jsPsych)`, the task, then `debrief()`.

- `deviceCheck()` and `fullscreen()`. `deviceCheck()` goes first, before consent: participants on a device not in `"devices"` (`study.config.json`) are told why and the study ends without the completion redirect, so they aren't paid or credited. It saves `device_type`, `device_allowed`, browser, OS and window size. `fullscreen()` asks participants to switch to full screen before the task (skipped where browsers can't, like iPhones); the study leaves full screen by itself at the end. Don't add your own device checks or fullscreen trials.

- `consent()`: the Participant Information Statement and consent (HREC 2022/796) for the study's `recruitment`, SONA or Prolific. Put it first in the timeline. It fills in the study length from `"minutes"` in `study.config.json`, and the SONA course credit (1 credit per hour, rounded up to the next 0.25) or Prolific payment (£6 per hour, rounded up to the penny) from that. Never type the length, credit or payment into the timeline. There's no in-lab consent form yet: ask the user for their approved wording.
- `debrief()`: the debrief statement (HREC 2022/796). Put it last in every study's timeline; it's shown only when `recruitment` is `"sona"` and skipped otherwise.
- `demographics()`: age, gender and English as a first language on one page, saved as the columns `age`, `gender` and `english_first_language`. Put it straight after `consent()` unless the user wants it elsewhere. Don't reword the questions or change the saved values; if a study needs more questions, add them as a separate trial after it.

The consent and debrief wording is ethics-approved. Never edit, reword, shorten or restyle it, and never write a consent form or debrief from scratch. If a study needs different wording (other researchers, a different participant pool, another ethics protocol), tell the user it needs an ethics-approved version and ask them for it.

## Timeline structure and names

Keep `buildTimeline` returning an array of blocks (objects with a `timeline` array) and trials. Give every block and trial a short `name` (for example `name: "Practice"`). Names label the dashboard timeline. jsPsych ignores them. Keep the jsPsych instance passed to `buildTimeline` for things like `jsPsych.timelineVariable`; do not call `initJsPsych` in `experiment.js`.

## Preview mode

`npm run dev` and `npm run build:preview` open the experiment dashboard instead of starting the experiment. Its timeline lists every block and trial, numbered (`2`, `2.1`, ...). Clicking a row runs the experiment from that point to the end; "Only this" runs just that block or trial, still inside its parent blocks so timeline variables apply. When a run ends, the recorded data is shown with Download CSV and Download JSON buttons. Preview data is never sent anywhere.

Each view has a URL hash, which is also how to jump straight to a part:

- `#from-2.1`: from item 2.1 to the end
- `#only-3`: only item 3
- `#full`: the whole experiment
- no hash: the dashboard

The dev server reloads on save and keeps the hash, so the edited section reruns straight away.

`npm run build` (what participants get) contains none of the preview code. Keep it that way: preview code only loads through the `import.meta.env` check in `KIT/src/main.js`.

## Data saving (JATOS or DataPipe)

Participant data is saved to JATOS by default (`KIT/src/data/jatos.js`, see `KIT/docs/jatos.md`), or to DataPipe when `study.config.json` has `"dataSaving": "datapipe"` (`KIT/src/data/datapipe.js`, see `KIT/docs/datapipe.md`). Only the chosen module is built into the participant build. Rules:

- Don't add other ways of saving or sending data (fetch calls, third-party services, `localSave`) unless the user asks.
- Record what the analysis needs in trial `data` (e.g. `data: { condition: "incongruent", correct_key: "f" }`). Every jsPsych data row is saved; the participant ID columns (Prolific or SONA, see below) and JATOS ID columns are added automatically.
- Keep the experiment's own `on_finish` free of redirects or `jatos` calls: the kit saves the data and ends the study after the timeline finishes.
- Never fill in or change `uuid` in `study.config.json` by hand. `npm run build:jatos` generates it. `"template": true` belongs only to the starter experiment inside the kit's repository; every real study has `false`.
- Where data is saved is one of the questions in [Starting a new study](#starting-a-new-study).
- To test saving end to end on the user's computer, use local JATOS: `npm run jatos` (re-run after changes), then the dashboard's **Run as participant** button or the printed study link. It doesn't work in cloud sessions.
- Preview mode must never load JATOS or save data.

## Recruitment (Prolific, SONA or in the lab)

`"recruitment"` in `study.config.json` is `"prolific"` (default), `"sona"` or `"lab"`. It decides the study link's URL parameters, the ID columns saved, and where participants go at the end. All of it lives in `KIT/src/recruitment.js`; don't hand-code IDs or redirects elsewhere. See `KIT/docs/recruitment.md`.

- **SONA:** set `"recruitment": "sona"` and ask the user for the study's completion URL: on SONA, open the study, then **Study Information**, and copy the link under **Completion URLs** (it looks like `https://sydneypsych.sona-systems.com/webstudy_credit.aspx?experiment_id=...&credit_token=...&survey_code=XXXX`). Paste it into `endRedirectUrl` exactly as given, `XXXX` included; the build swaps `XXXX` for each participant's ID so SONA grants their credit. Each row gets `sona_id`.
- **Prolific:** set `endRedirectUrl` to Prolific's completion URL (`https://app.prolific.com/submissions/complete?cc=...`). Rows get `prolific_pid`, `prolific_study_id`, `prolific_session_id`.
- **In the lab:** no ID parameters and no redirect; participants see a thank-you page. There's no approved in-lab consent form in the kit yet, so ask the user for their approved wording.
- `npm run build:jatos` refuses to build a Prolific or SONA study without a valid `endRedirectUrl`, and prints the study link to use.

**Whenever you give the user a study link, give it with its URL parameters**, ready to paste:

- SONA (Study URL field on SONA): `<JATOS General Single link>?id=%SURVEY_CODE%`
- Prolific (study URL on Prolific): `<JATOS General Single link>?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}`
- In the lab: the JATOS **General Multiple** link, unchanged (lab computers are shared, and a General Single link only works once per browser).

For DataPipe, the link starts with the address where `dist/` is hosted instead of the JATOS link. The dashboard's Participants section shows the same link and the end redirect.

## Participant data (privacy)

In `npm run dev` the dashboard has a Participants section (`KIT/scripts/jatos-dev-data.js`) with participant counts and downloads of real participant data from JATOS, including Prolific or SONA IDs.

- Never click its download buttons, request `/__jatos/data.csv` or `/__jatos/data.ndjson`, or open downloaded participant data files unless the user asks for that in the current conversation. Reading the counts is fine.
- Never ask for, print, or write the JATOS API token anywhere except the user's own `.env.local`, and never commit `.env.local`.
- Keep the panel dev-server only: nothing under `/__jatos` may be added to the artifact preview or participant build.

## Previewing the experiment (always do this after changing it)

After every change to the experiment, show the user a working preview (unless they said no to opening the preview in [Starting a new study](#starting-a-new-study); then verify headlessly and don't open it), and check the parts you changed by jumping to them with `#only-<n>` rather than walking through the whole experiment. Which route to use depends on where this session runs.

### Local session in the Claude Code desktop app

Use the Browser pane. `.claude/launch.json` defines a server named `experiment` that runs `npm run dev` (the kit's Vite dev server, default port 5173, `autoPort` on). Start it with the preview tools, open it in the Browser pane, then:

1. Read the dashboard timeline to confirm every block and trial is listed with the expected names.
2. Navigate to `#only-<n>` for each part you changed, step through it (press keys, click buttons), and check for console errors.
3. When the run ends the data is shown as JSON. Check it contains the expected fields.
4. Leave the pane on the dashboard (or the part the user asked about) so they can click around themselves.

### Cloud session (claude.ai/code, mobile, or no Browser pane)

The Browser pane cannot reach a localhost server running in a cloud container. Instead, build a single self-contained HTML file and publish it as an artifact:

1. `npm install` (if `node_modules/` is missing)
2. `npm run build:preview`. This writes `preview/index.html` with all JS, CSS and fonts inlined.
3. Publish `preview/index.html` with the Artifact tool, declaring `capabilities: {downloads: true}` so the Download CSV / JSON buttons work in the artifact. Reuse the same path on later rebuilds so the link stays the same.
4. Give the user the link. It opens on the dashboard (the artifact has no Participants section). Links can also point at one part: add `#only-2` to the artifact URL.

Stimuli in `src/stimuli/` are embedded in the preview build. If `npm run build:preview` warns that they're too big for an artifact (16 MB page limit), tell the user and suggest compressing them; don't publish a page that won't fit.

Without the `downloads` capability the artifact publisher warns about a download link, and the download buttons show "Downloads aren't available in this view".

### Checking without a browser pane

To verify headlessly, run `npm run dev` in the background and drive `http://localhost:5173/#only-<n>` with Playwright (Chromium is at `/opt/pw-browsers/chromium` in cloud sessions).

## Commands

- `npm run dev`: dev server with hot reload
- `npm run build`: participant build to `dist/`
- `npm run build:jatos`: participant build packaged as `jatos/<dirName>.jzip` for import into JATOS
- `npm run build:preview`: single-file build to `preview/index.html` for artifact previews
- `npm run jatos` / `npm run jatos:stop`: local JATOS for testing the data path (downloads JATOS into `.jatos/` on first run)
