# Saving data with DataPipe

[DataPipe](https://pipe.jspsych.org) is a free service from the jsPsych team that receives experiment data and passes it to a storage provider you connect in its dashboard (currently Google Drive, Dataverse or Zenodo; OSF stops after November 16, 2026). Unlike JATOS it doesn't host the experiment: you put the built experiment on any static web host.

Use JATOS (the default, see [jatos.md](jatos.md)) unless you have a reason to prefer DataPipe. The differences:

| | JATOS | DataPipe |
| - | - | - |
| Hosts the experiment | Yes | No: use GitHub Pages, Netlify or another web host |
| Where data is stored | The lab's JATOS server | Your storage provider (check its location for ethics) |
| Partial data from dropouts | Yes | Yes, as a separate `.partial.json` file |
| Participant numbers and downloads in the experiment dashboard | Yes | No: use the DataPipe dashboard and your storage provider |
| Withdraw button | Yes (deletes the participant's data) | No: data already sent can't be deleted by the experiment |
| Reloading the page | Ends the run | Restarts the experiment |
| Local test server (`npm run jatos`) | Yes | No |

## Set up

1. Sign in at https://pipe.jspsych.org, connect a storage provider, and create an experiment. Copy its experiment ID.
2. In `study.config.json` set:
   ```json
   "dataSaving": "datapipe",
   "datapipeExperimentId": "<your experiment ID>",
   "endRedirectUrl": "https://app.prolific.com/submissions/complete?cc=XXXXXXX"
   ```
   `endRedirectUrl` works as with JATOS, including `[PROLIFIC_PID]`-style placeholders. Leave it empty to show a "your responses have been saved" message instead.
3. In the DataPipe dashboard, turn **data collection** on when you're ready to test or collect.
4. Run `npm run build` and upload the contents of `dist/` to your web host.
5. In Prolific, use your hosted page's address as the study URL with Prolific's URL parameters, e.g.
   ```
   https://your-host/your-study/?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}
   ```

## What gets saved

- Each participant's data is one CSV file named `<PROLIFIC_PID>_<SESSION_ID>.csv` (a random name when those are missing).
- Each trial is also streamed as it finishes, so if a participant drops out, DataPipe saves their trials as a `.partial.json` file.
- The participant is redirected only after DataPipe has accepted the file. If saving fails, they see a "Try again" button. If DataPipe doesn't answer within 30 seconds, the experiment saves directly and continues, so nobody is left on "Saving…".
- Every row has `prolific_pid`, `prolific_study_id`, `prolific_session_id`, `datapipe_file` and `experiment_version`.

## Testing

DataPipe has no local test mode. To test for real:

1. Turn data collection on in the DataPipe dashboard.
2. Run `npm run build`, then `npx vite preview`, and open the printed address with test IDs, e.g. `http://localhost:4173/?PROLIFIC_PID=test1&STUDY_ID=test&SESSION_ID=test1`.
3. Complete the experiment and check the file arrives in your storage provider. Delete test files before collecting data.

If saving fails, the browser console shows DataPipe's reason (for example "Data collection is not active" or "The experiment ID does not match an experiment").
