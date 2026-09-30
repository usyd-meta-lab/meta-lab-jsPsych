# Meta Lab jsPsych template

jsPsych v8 experiments for the USYD Meta Lab, installed from npm and bundled with Vite.

## Layout

- `src/experiment.js`: the experiment. Build the timeline inside `run()`. Edit this file when designing a study.
- `src/main.js`: entry point. Loads the jsPsych CSS and calls `run()`. Rarely needs changes.
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

## Previewing the experiment (always do this after changing it)

After every change to the experiment, show the user a working preview. Which route to use depends on where this session runs.

### Local session in the Claude Code desktop app

Use the Browser pane. `.claude/launch.json` defines a server named `experiment` that runs `npm run dev` (Vite, default port 5173, `autoPort` on). Start it with the preview tools, open it in the Browser pane, then:

1. Read the page to confirm the first trial rendered and there are no console errors.
2. Step through the trials (press keys, click buttons) to check the flow.
3. At the end the data is shown as JSON. Check it contains the expected fields.

Vite hot-reloads on save, so after edits just reload the page in the pane.

### Cloud session (claude.ai/code, mobile, or no Browser pane)

The Browser pane cannot reach a localhost server running in a cloud container. Instead, build a single self-contained HTML file and publish it as an artifact:

1. `npm install` (if `node_modules/` is missing)
2. `npm run build:preview`. This writes `preview/index.html` with all JS, CSS and fonts inlined.
3. Publish `preview/index.html` with the Artifact tool. Reuse the same path on later rebuilds so the link stays the same.
4. Give the user the link.

Artifact pages only load inlined content, so stimuli in `public/` are not included in the preview build. For image or audio stimuli, import them in `src/experiment.js` (`import catUrl from "./stimuli/cat.png"`) so Vite inlines them, or note to the user that those stimuli will not appear in the artifact preview.

The artifact publisher may warn about a download link. That comes from jsPsych's built-in `localSave` code and can be ignored.

### Checking without a browser pane

To verify headlessly, run `npm run dev` in the background and drive `http://localhost:5173` with Playwright (Chromium is at `/opt/pw-browsers/chromium` in cloud sessions).

## Commands

- `npm run dev`: dev server with hot reload
- `npm run build`: production build to `dist/` (upload this folder to the hosting server)
- `npm run build:preview`: single-file build to `preview/index.html` for artifact previews
- `npm run serve`: serve the `dist/` build locally
