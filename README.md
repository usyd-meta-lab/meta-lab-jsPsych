# Meta Lab jsPsych kit

Build and run [jsPsych v8](https://www.jspsych.org/) experiments the USYD Meta Lab way, with Claude doing the coding. You describe the study; Claude builds it, shows it to you in a live preview, and sets up saving the data and paying or crediting participants.

This repository has three parts:

- **The kit** (`@usyd-meta-lab/jspsych-kit`): everything that isn't the experiment itself. That includes the experiment dashboard, saving data to JATOS or DataPipe, the lab's standard blocks (device check, consent, demographics, preloading, debrief), and the builds.
- **The starter experiment** (`template/`): what every new study starts from.
- **The Claude Code plugin** (`plugin/`): teaches Claude to start, build and launch experiments the lab's way.

Each experiment lives in its own small folder that depends on one release of the kit. Kit fixes reach every experiment when it updates, and a running study stays exactly as it was until someone chooses to update it.

## Getting started

### What you need (once)

- [Node.js](https://nodejs.org) 20 or newer (the LTS download)
- [git](https://git-scm.com/downloads) (already on most Macs)
- [Claude Code](https://claude.com/claude-code). The desktop app is easiest: its Browser pane shows your experiment as you build it.

### Start a new experiment

**With Claude (recommended).** Add the lab's plugin once. In a Claude Code session, run:

```
/plugin marketplace add usyd-meta-lab/meta-lab-jsPsych
/plugin install meta-lab@usyd-meta-lab
```

Then, in any session, say **"start a new experiment"**. Claude asks for the study's name, creates its folder and sets it up.

**Or from a terminal:**

```bash
npx github:usyd-meta-lab/meta-lab-jsPsych new my-study --title "My study"
```

Then open the `my-study` folder in Claude Code and say **"set up this experiment"**. The folder already lists the lab plugin, so Claude Code offers to install it the first time you open it.

### What happens next

Claude asks a few questions in one go, in plain language:

1. What the study is called.
2. Whether it's covered by the lab's ethics protocol (2022/796).
3. Where participants come from: Prolific, SONA or in the lab.
4. How long it takes. This sets the payment (£6 an hour) or SONA credit (1 an hour).
5. Which devices are allowed.
6. The design and what you'll analyse.
7. Where data is saved.
8. Whether to open the preview after each change.

It then builds the experiment and opens the **experiment dashboard**. That's a page for you, never for participants, listing every part of the experiment. Click a part to try it from there, or "Only this" to try just that part. At the end you see exactly what data was recorded, with CSV and JSON downloads.

From there, keep describing changes ("add a practice block with feedback", "use the faces in src/stimuli/faces", "add an attention check") and Claude builds each one and shows it to you.

## Your experiment's folder

```
src/experiment.js    the experiment (Claude edits this)
src/stimuli/         images, audio and video
study.config.json    name, recruitment, length, devices, data saving
index.html           page shell
CLAUDE.md            loads the kit's instructions for Claude, plus notes on this study
```

Commands (Claude runs these for you, but you can too):

| Command | What it does |
| - | - |
| `npm run dev` | The experiment dashboard, reloading as you edit |
| `npm run build` | The participant version, in `dist/` |
| `npm run build:jatos` | The participant version packaged for JATOS (`jatos/<name>.jzip`) |
| `npm run build:preview` | A single-page preview, for sharing as a Claude artifact |
| `npm run jatos` | JATOS on your own computer, for testing that saving works |

## Collecting data

- **Prolific, SONA or in the lab:** Claude sets up the study link, participant IDs and the completion redirect, so Prolific participants are paid and SONA participants credited automatically. See [docs/recruitment.md](docs/recruitment.md).
- **JATOS** (the default) hosts the experiment and stores the data. See [docs/jatos.md](docs/jatos.md). The lab's JATOS server is still being set up; until then, `npm run jatos` runs JATOS on your own computer for testing.
- **DataPipe** is the alternative. It saves to a storage provider, and you host the experiment on any website. See [docs/datapipe.md](docs/datapipe.md).

Before piloting, ask Claude to **"launch the study"**. It checks the setup, builds it and gives you the links to paste into Prolific or SONA.

## Updating the kit

Your experiment uses one release of the kit, named in its `package.json` (e.g. `github:usyd-meta-lab/meta-lab-jsPsych#v0.1.0`). Every data row records `kit_version` and `experiment_version` (your study's git commit), so you can always tell which code produced a dataset.

- **To update**, ask Claude to "update the kit to v0.2.0". It changes the version, reinstalls and previews the whole study.
- **Never update while collecting data** unless you need a specific fix: an update can change timing or saving mid-study.
- **The plugin** doesn't update by itself unless you turn that on: in `/plugin`, go to **Marketplaces**, select `usyd-meta-lab` and choose **Enable auto-update**.

## For maintainers

[CLAUDE.md](CLAUDE.md) covers the layout, the rules for changing the kit, and testing. In short:

```bash
npm run setup
npm run dev
```

`npm run setup` installs the kit and the linked starter experiment, and `npm run dev` runs its dashboard with your changes.

**To release**, bump `version` in `package.json`, commit, tag `v<version>` and push the tag. New experiments pin that tag, so push it before anyone runs `new` from that version. Mention anything that changes timing, what participants see or the saved data in the release notes.
