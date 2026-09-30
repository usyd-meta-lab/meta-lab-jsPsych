# meta-lab-jsPsych

Starter template for [jsPsych v8](https://www.jspsych.org/) experiments in the USYD Meta Lab. jsPsych and its plugins are installed from npm and bundled with [Vite](https://vite.dev/).

## Getting started

Requires Node.js 20 or newer.

```sh
npm install
npm run dev
```

Open the printed URL (usually http://localhost:5173). You'll see the experiment dashboard. Its timeline lists every block and trial in the experiment, numbered. Click a row to run the experiment from that point, or "Only this" to run just that part. When the run ends, the recorded data is displayed, with buttons to download it as CSV or JSON. Preview data is never sent to JATOS.

The dashboard only exists in `npm run dev` and `npm run build:preview`. The participant build (`npm run build` / `npm run build:jatos`) contains none of it.

Each part of the timeline has its own link, e.g. `http://localhost:5173/#only-2.1` or `#from-3`. The dev server reloads on save and keeps the link, so the section you're editing reruns immediately.

Name your blocks and trials with a `name` property in `src/experiment.js` so the timeline is readable.

## Collecting data

Participants run the experiment on the lab's [JATOS](https://www.jatos.org) server, which also stores the data. `npm run build:jatos` packages the experiment as a `.jzip` file to import into JATOS. Each trial is saved as it finishes, Prolific IDs are recorded automatically, and participants are redirected to Prolific only once their data is saved.

With a JATOS API token in `.env.local`, the dashboard in `npm run dev` also shows participant numbers (completed, in progress, dropped out, withdrew, failed) and lets you download all participant data as CSV.

To test the whole data path before the lab server exists, run `npm run jatos`. It downloads and starts JATOS on your own computer, imports the experiment, and connects the dashboard to it, including a **Run as participant** button.

Setup, Prolific, data export and local testing: see [docs/jatos.md](docs/jatos.md).

## Designing an experiment with Claude

Open the repo in Claude Code and describe the experiment you want. `CLAUDE.md` tells Claude how to build and preview it:

- **Claude Code desktop app (local session):** Claude starts the dev server defined in `.claude/launch.json` and opens the experiment in the Browser pane, so you can watch it and click through it yourself. You can also start it from the server dropdown in the session toolbar.
- **Claude Code on the web or mobile (cloud session):** the Browser pane can't reach a server inside the cloud container, so Claude runs `npm run build:preview` and publishes the resulting single-file HTML as a private artifact link you can open and run.

## Commands

| Command | What it does |
| - | - |
| `npm run dev` | Dev server with the experiment dashboard and hot reload |
| `npm run build` | Participant build to `dist/` |
| `npm run build:jatos` | Participant build packaged as `jatos/<dirName>.jzip` for JATOS import |
| `npm run build:preview` | Self-contained `preview/index.html` for artifact previews |
| `npm run jatos` / `jatos:stop` | Start local JATOS for testing (imports the experiment, prints a study link) / stop it |

## Project layout

```
index.html            page shell
src/main.js           entry point (participant run, or preview mode in dev)
src/experiment.js     the experiment timeline: edit this
src/data.js           saving data to JATOS (participant build only)
src/preview/          experiment dashboard (never shipped to participants)
study.config.json     JATOS study settings (title, UUID, Prolific redirect)
scripts/build-jatos.mjs  packages dist/ as a JATOS study archive
scripts/jatos-dev-data.js  dev-server endpoint for downloading participant data
scripts/jatos-local.mjs    local JATOS for testing (npm run jatos)
.env.example          template for .env.local (JATOS URL and API token)
vite.config.js        dev server and build config
.claude/launch.json   Browser pane preview config for Claude Code desktop
.claude/settings.json installs dependencies at the start of cloud sessions
CLAUDE.md             instructions Claude follows in this repo
```
