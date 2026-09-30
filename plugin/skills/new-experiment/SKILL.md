---
name: new-experiment
description: Start a new Meta Lab jsPsych experiment in its own folder from the lab kit. Use when someone wants to create, start or set up a new experiment or study, including "make me an experiment" when they aren't already inside an experiment folder.
---

# Start a new Meta Lab experiment

Each experiment is its own small folder (and git repository) that depends on the lab kit, `@usyd-meta-lab/jspsych-kit`. The kit provides the dashboard, data saving, the standard blocks (device check, consent, demographics, preload, debrief) and the builds.

## If you're already in an experiment

If the current folder has a `study.config.json` and `node_modules/@usyd-meta-lab/jspsych-kit`, it's already an experiment: skip to step 3 and follow its CLAUDE.md.

## Steps

1. **Ask where and what.** Ask for the study's name (e.g. "Confidence and memory") and where to create the folder (default: a new folder named after the study, next to the current folder, or in `~/GitHub` if that exists). Folder names: lowercase, hyphens, no spaces.

2. **Create it.** Needs Node.js 20 or newer (`node --version`; if missing, tell them to install it from nodejs.org and stop). Then run:

   ```bash
   npx --yes github:usyd-meta-lab/meta-lab-jsPsych new <folder> --title "<Study name>"
   ```

   This copies the starter experiment, pins the current kit release, sets the study name, runs `git init` and `npm install`. If it fails because the release tag can't be found, tell the user the kit hasn't been released yet (a maintainer needs to push a `v<version>` tag).

3. **Work in the new folder.** If this session can switch its working folder, switch to it; otherwise run every command with the new folder as the working directory, and tell the user to open that folder in Claude Code next time (desktop app: open folder; terminal: `cd <folder> && claude`). The folder's CLAUDE.md loads the kit's instructions.

4. **Set it up.** Read the new folder's CLAUDE.md (and the kit instructions it imports) and follow its "Starting a new study" section: ask the setup questions together, in plain language, summarise the answers back, then build the experiment and show the preview.

5. **First commit.** Once the first version runs, commit it (`git add -A && git commit -m "Start <Study name>"`) so every data row's `experiment_version` points at real code. Don't create a GitHub repository or push unless the user asks.
