# meta-lab-jsPsych

Starter template for [jsPsych v8](https://www.jspsych.org/) experiments in the USYD Meta Lab. jsPsych and its plugins are installed from npm and bundled with [Vite](https://vite.dev/).

## Getting started

Requires Node.js 20 or newer.

```sh
npm install
npm run dev
```

Open the printed URL (usually http://localhost:5173). You'll see the preview timeline: every block and trial in the experiment, numbered. Click a row to run the experiment from that point, or "Only this" to run just that part. When the run ends, the recorded data is displayed.

The timeline view only exists in `npm run dev` and `npm run build:preview`. The participant build (`npm run build`) contains none of the preview code and starts the experiment straight away. Check it with `npm run build && npm run serve`.

Each part of the timeline has its own link, e.g. `http://localhost:5173/#only-2.1` or `#from-3`. The dev server reloads on save and keeps the link, so the section you're editing reruns immediately.

Name your blocks and trials with a `name` property in `src/experiment.js` so the timeline is readable.

## Designing an experiment with Claude

Open the repo in Claude Code and describe the experiment you want. `CLAUDE.md` tells Claude how to build and preview it:

- **Claude Code desktop app (local session):** Claude starts the dev server defined in `.claude/launch.json` and opens the experiment in the Browser pane, so you can watch it and click through it yourself. You can also start it from the server dropdown in the session toolbar.
- **Claude Code on the web or mobile (cloud session):** the Browser pane can't reach a server inside the cloud container, so Claude runs `npm run build:preview` and publishes the resulting single-file HTML as a private artifact link you can open and run.

## Commands

| Command | What it does |
| - | - |
| `npm run dev` | Dev server with the preview timeline and hot reload |
| `npm run build` | Production build to `dist/` |
| `npm run build:preview` | Self-contained `preview/index.html` for artifact previews |
| `npm run serve` | Serve the `dist/` build locally, as participants see it |

## Project layout

```
index.html            page shell
src/main.js           entry point (participant run, or preview mode in dev)
src/experiment.js     the experiment timeline: edit this
src/preview/          timeline view for previews (never shipped to participants)
vite.config.js        dev server and build config
.claude/launch.json   Browser pane preview config for Claude Code desktop
.claude/settings.json installs dependencies at the start of cloud sessions
CLAUDE.md             instructions Claude follows in this repo
```
