# Running a study on JATOS

Participants run the experiment on a [JATOS](https://www.jatos.org) server the lab controls. JATOS serves the experiment files and stores the data. Preview mode (`npm run dev`, `npm run build:preview`) never touches JATOS and never saves data.

There are two JATOS setups:

- **Local JATOS, for testing** (`npm run jatos`): runs on your own computer, reachable only from it. Use it to test the full data-saving path and the dashboard before the lab server exists. Never use it for real participants.
- **The lab's JATOS server, for real data collection**: see [The JATOS server](#the-jatos-server). Sections 1 to 3 below are about that server.

## Testing with local JATOS

```sh
npm run jatos         # start local JATOS, import the current experiment, print a study link
npm run jatos:stop    # stop it
```

The first run downloads JATOS 3.11.3 with its own Java (about 100 MB) into `.jatos/`. Nothing else needs installing. Each later run reuses it, re-imports the current experiment and keeps the same study link, so run `npm run jatos` again after changing the experiment.

- The experiment dashboard (`npm run dev`) connects to local JATOS automatically: participant numbers, downloads, and a **Run as participant** button that runs the experiment through JATOS and saves the data, exactly as a real participant would. The link includes test Prolific IDs (`PROLIFIC_PID=local-test`).
- Local JATOS only listens on this computer (`127.0.0.1`), so the default admin login (user `admin`, password `admin`, at http://localhost:9000) is safe to keep.
- Its database, results and settings live in `.jatos/`, which is never committed. Delete `.jatos/` to start again from scratch.
- When `.env.local` names a JATOS server, the dashboard uses that instead of local JATOS.
- It needs a normal computer (macOS, Windows or Linux on x64). It doesn't work in Claude Code cloud sessions, which can't download JATOS.

## 1. Set up the study

Edit `study.config.json`:

| Field | What it's for |
| - | - |
| `template` | `true` only in the template repo itself: its study UUID is then kept in `.jatos/` instead of being committed. **Set it to `false` (or delete it) when you start a new study from the template.** |
| `title` | Study name shown in JATOS. |
| `recruitment` | `"prolific"` (default), `"sona"` or `"lab"`: where participants come from. Sets the study link's URL parameters, the ID columns and the end redirect. See [recruitment.md](recruitment.md). |
| `minutes` | How long the study takes. The consent form shows it, with the SONA credit or Prolific payment worked out from it. |
| `devices` | Devices participants may use: `"computer"`, `"tablet"`, `"phone"`. Default `["computer"]`. See [recruitment.md](recruitment.md#devices). |
| `dataSaving` | `"jatos"` (default) or `"datapipe"`. See [datapipe.md](datapipe.md) for DataPipe. |
| `datapipeExperimentId` | Only for DataPipe: the experiment ID from the DataPipe dashboard. |
| `dirName` | Folder name for the study's files on the JATOS server. Letters, digits, `-` and `_` only. Must be unique on the server. |
| `uuid` | Leave empty. The first `npm run build:jatos` fills it in. Commit it: re-importing an archive with the same UUID updates the existing JATOS study instead of creating a new one. **If you copy another study's folder to start a new study, clear this field**, or importing will overwrite the other study. |
| `endRedirectUrl` | Where participants go after the data is saved: the Prolific completion URL `https://app.prolific.com/submissions/complete?cc=XXXXXXX`, or for SONA the study's completion URL pasted as is (see [recruitment.md](recruitment.md)). Values from the study link can be inserted with square brackets, e.g. `[PROLIFIC_PID]`. Empty shows JATOS's own end page. |
| `withdrawButton` | `true` adds a "Withdraw" button in the corner. After the participant confirms, JATOS ends the study and deletes everything they submitted. |

## 2. Build and import

```sh
npm run build:jatos
```

This writes `jatos/<dirName>.jzip`. In JATOS, choose **Import Study** and select that file.

To update a study, rebuild and import again. JATOS asks whether to overwrite the existing study. Study links and batches are kept.

Each build records its git commit in every data row (`experiment_version`). Commit your changes before building for data collection; a version ending in `-dirty` means the build included uncommitted changes.

## 3. Connect to Prolific or SONA

`npm run build:jatos` prints which study link to copy from the study's **Study Links** in JATOS and the URL parameters to add to it:

- Prolific: the **General Single** link plus `?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}`
- SONA: the **General Single** link plus `?id=%SURVEY_CODE%`
- In the lab: the **General Multiple** link as it is

See [recruitment.md](recruitment.md) for setting up each one, including the completion URLs.

## What gets saved

- Each trial is saved as soon as it finishes, so data from participants who drop out is kept.
- At the end, the complete dataset is saved again, then the participant is redirected.
- If the connection drops, trials are resent with the next save. If the final save fails, the participant sees a "Try again" button and is not redirected until the data is saved.
- Every row has `jatos_study_result_id`, `jatos_worker_id` and `experiment_version`, plus the participant's ID: `prolific_pid`, `prolific_study_id` and `prolific_session_id` for Prolific, or `sona_id` for SONA.
- Reloading the page ends the study (JATOS shows an error page) and keeps the trials already saved. `jatos.js` warns participants before they leave the page.

## Getting the data out

### From the experiment dashboard (easiest)

`npm run dev` opens the experiment dashboard. Its **Participants** section shows how many participants have completed (with completion rate, median time and when the last one finished), how many are in progress right now, dropped out, withdrew, failed or were stopped at the device check (wrong device), and has **Download CSV** / **Download NDJSON** buttons. It refreshes every minute while open. "In progress" means not finished and active in the last 5 minutes; after that a run counts as dropped out. Runs started from inside JATOS (your own tests) are left out of the counts. The files contain every trial from every run, with these columns added from JATOS: `jatos_study_state`, `jatos_worker_type`, `jatos_start_time`, `jatos_end_time`.

For local JATOS this is automatic (see [Testing with local JATOS](#testing-with-local-jatos)). For the lab's server, set it up once per computer:

1. In JATOS, create a user for data access (the normal "User" role, not admin) and add it as a member of your studies.
2. Signed in as that user, create an API token (user menu, **API tokens**).
3. Copy `.env.example` to `.env.local` in the project folder and fill in `JATOS_URL` and `JATOS_API_TOKEN`. `.env.local` is never committed.
4. Restart `npm run dev`.

How it stays safe:

- The token stays in the dev server on your machine. The browser only talks to the local dev server, which refuses requests from other computers even if started with `--host`.
- The panel only exists in `npm run dev`. It is not in the artifact preview or the participant build.
- A JATOS token has all the permissions of its user (including deleting results), so keep it out of chat, email and git.
- In a Claude Code cloud session the dev server runs in the cloud, so this panel is only meant for local use. If the Claude desktop Browser pane doesn't save the file, open http://localhost:5173 in your normal browser.

`jatos_worker_type` is `Jatos` for runs started from inside JATOS (your own test runs) and `GeneralSingle` / `GeneralMultiple` for participants. Rows from dropouts have `jatos_study_state` other than `FINISHED`.

### From JATOS directly

In JATOS, open the study's **Results**, select the results, and export the data. Each participant's result is newline-delimited JSON: one trial per line.

```r
rows <- jsonlite::stream_in(file("results.txt"))
```

```python
import pandas as pd
rows = pd.read_json("results.txt", lines=True)
```

Group by `jatos_study_result_id` (one per run) or `prolific_pid`. Runs that JATOS marks as not finished are dropouts or withdrawals.

## The JATOS server

The lab needs one JATOS server reachable from the internet with HTTPS. Options include a university-managed virtual machine or the ARDC Nectar Research Cloud, both of which keep data in Australia. See the JATOS docs on [installation](https://www.jatos.org/Installation.html) and [running JATOS on a server](https://www.jatos.org/JATOS-on-a-server.html). For real data collection use [MySQL](https://www.jatos.org/JATOS-with-MySQL.html) rather than the default H2 database, keep JATOS updated, and back up the database and study folders regularly.
