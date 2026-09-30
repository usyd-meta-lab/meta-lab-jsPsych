# Meta Lab jsPsych kit (maintainers)

This repository is where the lab's experiment tooling is maintained. Lab members don't work here; each experiment is its own repository created with `jspsych-kit new`, which depends on a released version of this kit. This file is for changing the kit itself.

## What's here

- **The kit** (`@usyd-meta-lab/jspsych-kit`, the repo root): `src/` (dashboard, data saving, standard blocks, stimuli helpers, `index.js` for what experiments import), `scripts/` (JATOS packaging, local JATOS, dev-server data panel, stimuli checks), `vite.js` (the shared Vite setup), `bin/jspsych-kit.mjs` (the commands experiments run, and `new`), `docs/`.
- **`claude/experiment.md`**: the instructions every experiment's Claude follows. Experiments import it from their installed kit, so changes reach them when they update the kit.
- **`template/`**: the starter experiment that `jspsych-kit new` copies. In this repo it's linked to the kit with `file:..`, so it's also how you run and test the kit. `template/gitignore` becomes `.gitignore` in new experiments (npm drops `.gitignore` from packages).
- **`plugin/`** and **`.claude-plugin/marketplace.json`**: the lab's Claude Code plugin (skills for starting, building and launching experiments), installed from this repo as the `usyd-meta-lab` marketplace.

## Working on the kit

- `npm run setup` once (installs the kit and the template), then `npm run dev` runs the template's dashboard with your kit changes; `npm run build`, `build:preview` and `build:jatos` build the template.
- After changing the kit, preview the affected parts in the template as `claude/experiment.md` describes, and run both builds.
- To test what a new lab member gets, pack the kit and create a study from the tarball (a GitHub install is packed the same way):

  ```sh
  npm pack --pack-destination /tmp
  node bin/jspsych-kit.mjs new /tmp/test-study --kit file:/tmp/usyd-meta-lab-jspsych-kit-<version>.tgz
  ```

## Rules

- **The contract with experiments** is: `buildTimeline(jsPsych)` and `options` in `src/experiment.js`, the exports of `src/index.js`, the fields of `study.config.json`, the npm scripts in `template/package.json`, and the data columns the kit adds. Keep them backwards compatible. A breaking change needs a new major version and a note in the release on what experiments must change.
- **Versions.** Bump `version` in `package.json` for every release and tag it `v<version>` (e.g. `v0.2.0`). `jspsych-kit new` pins new experiments to the tag matching the version it came from, so the tag must exist on GitHub before anyone runs `new` from that version. Experiments record `kit_version` in every data row.
- **Running studies.** A kit release can change timing or saving. Say so in the release notes whenever a change affects what participants see, trial timing, or the saved data, so owners of running studies can decide whether to update.
- The ethics-approved consent and debrief text in `src/blocks/` is never edited without a new approved version from the user.
- Keep dashboard and preview code out of participant builds (the `import.meta.env` check in `src/main.js`), and keep `/__jatos` dev-server only.
- The kit imports experiment files by root-relative paths (`/src/experiment.js`, `/study.config.json`, `/src/stimuli/**`), which Vite resolves in the experiment's folder. Kit files import each other relatively. `vite.js` excludes the kit from dependency pre-bundling (so those paths work) and pre-bundles the kit's jsPsych packages instead.
- The plugin has no `version`, so installs track this repo's commits. Keep its skills short and point to `claude/experiment.md` rather than repeating it.

Experiments follow these instructions (they apply to `template/` here too):

@claude/experiment.md
