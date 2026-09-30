# Meta Lab jsPsych template

jsPsych v8 experiments for the USYD Meta Lab, installed from npm and bundled with Vite.

## Layout

- `src/experiment.js`: the experiment. `buildTimeline(jsPsych)` returns the timeline; `options` are passed to `initJsPsych`. Edit this file when designing a study.
- `src/main.js`: entry point. Runs the experiment for participants, or loads preview mode in dev and preview builds. Rarely needs changes.
- `src/preview/`: the preview-mode timeline view. Never shipped to participants.
- `index.html`: page shell. Pins a light background so previews look the same in dark mode.
- `vite.config.js`: dev server and build settings.
- `.claude/launch.json`: preview server config for the Claude Code desktop app.

## Adding plugins

Install plugins from npm and import them in `src/experiment.js`:

```sh
npm install @jspsych/plugin-image-keyboard-response
```

```js
import imageKeyboardResponse from "@jspsych/plugin-image-keyboard-response";
```

Use jsPsych v8 syntax (`initJsPsych`, `await jsPsych.run(timeline)`, plugin classes as `type`). Do not load jsPsych from a CDN or add `<script>` tags for plugins.

Put images, audio and other stimuli in `public/` and reference them by relative path (for example `stimuli/cat.png` for `public/stimuli/cat.png`).

## Timeline structure and names

Keep `buildTimeline` returning an array of blocks (objects with a `timeline` array) and trials. Give every block and trial a short `name` (for example `name: "Practice"`). Names label the preview timeline view. jsPsych ignores them. Keep the jsPsych instance passed to `buildTimeline` for things like `jsPsych.timelineVariable`; do not call `initJsPsych` in `experiment.js`.

## Preview mode

`npm run dev` and `npm run build:preview` open a timeline view instead of starting the experiment. It lists every block and trial, numbered (`2`, `2.1`, ...). Clicking a row runs the experiment from that point to the end; "Only this" runs just that block or trial, still inside its parent blocks so timeline variables apply. When a run ends, the recorded data is shown.

Each view has a URL hash, which is also how to jump straight to a part:

- `#from-2.1`: from item 2.1 to the end
- `#only-3`: only item 3
- `#full`: the whole experiment
- no hash: the timeline view

The dev server reloads on save and keeps the hash, so the edited section reruns straight away.

`npm run build` (what participants get) contains none of the preview code. Keep it that way: preview code only loads through the `import.meta.env` check in `src/main.js`.

## Previewing the experiment (always do this after changing it)

After every change to the experiment, show the user a working preview, and check the parts you changed by jumping to them with `#only-<n>` rather than walking through the whole experiment. Which route to use depends on where this session runs.

### Local session in the Claude Code desktop app

Use the Browser pane. `.claude/launch.json` defines a server named `experiment` that runs `npm run dev` (Vite, default port 5173, `autoPort` on). Start it with the preview tools, open it in the Browser pane, then:

1. Read the timeline view to confirm every block and trial is listed with the expected names.
2. Navigate to `#only-<n>` for each part you changed, step through it (press keys, click buttons), and check for console errors.
3. When the run ends the data is shown as JSON. Check it contains the expected fields.
4. Leave the pane on the timeline view (or the part the user asked about) so they can click around themselves.

### Cloud session (claude.ai/code, mobile, or no Browser pane)

The Browser pane cannot reach a localhost server running in a cloud container. Instead, build a single self-contained HTML file and publish it as an artifact:

1. `npm install` (if `node_modules/` is missing)
2. `npm run build:preview`. This writes `preview/index.html` with all JS, CSS and fonts inlined.
3. Publish `preview/index.html` with the Artifact tool. Reuse the same path on later rebuilds so the link stays the same.
4. Give the user the link. It opens on the timeline view. Links can also point at one part: add `#only-2` to the artifact URL.

Artifact pages only load inlined content, so stimuli in `public/` are not included in the preview build. For image or audio stimuli, import them in `src/experiment.js` (`import catUrl from "./stimuli/cat.png"`) so Vite inlines them, or note to the user that those stimuli will not appear in the artifact preview.

The artifact publisher may warn about a download link. That comes from jsPsych's built-in `localSave` code and can be ignored.

### Checking without a browser pane

To verify headlessly, run `npm run dev` in the background and drive `http://localhost:5173/#only-<n>` with Playwright (Chromium is at `/opt/pw-browsers/chromium` in cloud sessions).

## Commands

- `npm run dev`: dev server with hot reload
- `npm run build`: production build to `dist/` (upload this folder to the hosting server)
- `npm run build:preview`: single-file build to `preview/index.html` for artifact previews
- `npm run serve`: serve the `dist/` build locally, exactly as participants see it (no timeline view)
