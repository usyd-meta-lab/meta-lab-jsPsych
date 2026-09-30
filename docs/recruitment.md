# Recruiting participants: Prolific, SONA or in the lab

Set `recruitment` in `study.config.json` to where participants come from:

| `recruitment` | Study link parameters | ID columns saved | At the end |
| - | - | - | - |
| `"prolific"` (default) | `?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}` | `prolific_pid`, `prolific_study_id`, `prolific_session_id` | Redirect to Prolific's completion URL |
| `"sona"` | `?id=%SURVEY_CODE%` | `sona_id` | Redirect to SONA's completion URL, which grants course credit |
| `"lab"` | none | none | JATOS's thank-you page |

The logic is in `src/recruitment.js`. The experiment dashboard (`npm run dev`) shows the study link to use and where participants go at the end, with a warning if something is missing.

## SONA

1. On SONA, create the study as an online external study. Open it, then **Study Information**, and copy the link under **Completion URLs**. It looks like:
   ```
   https://sydneypsych.sona-systems.com/webstudy_credit.aspx?experiment_id=3682&credit_token=...&survey_code=XXXX
   ```
2. In `study.config.json` set:
   ```json
   "recruitment": "sona",
   "endRedirectUrl": "<the completion URL, exactly as copied, XXXX included>"
   ```
   The build replaces `XXXX` with each participant's SONA ID code, so SONA knows whom to credit.
3. Put `debrief()` from `src/blocks/debrief.js` last in the timeline: SONA participants see the approved debrief statement before they're sent back to SONA.
4. Set `"minutes"` to how long the study takes and put `consent()` from `src/blocks/consent.js` first in the timeline. The consent form shows the length and the course credit: 1 credit per hour, rounded up to the next 0.25 (e.g. 20 minutes is 0.5 credits). Give the study the same credit on SONA; the dashboard and `npm run build:jatos` show it.
5. Run `npm run build:jatos` and import the study into JATOS.
6. In JATOS, open the study's **Study Links** and copy the **General Single** link. Add `?id=%SURVEY_CODE%` to the end and paste it into the study's **Study URL** on SONA:
   ```
   https://your-jatos-server/publix/<code>?id=%SURVEY_CODE%
   ```
   SONA replaces `%SURVEY_CODE%` with the participant's ID code when they start.

Test it with SONA's own "test the study" option, or check the data has a `sona_id` column. A test run through local JATOS (`npm run jatos`) uses `id=local-test` and then redirects to the real SONA completion page, which will reject the made-up code.

## Prolific

1. In `study.config.json` set `"recruitment": "prolific"` and `endRedirectUrl` to Prolific's completion URL (`https://app.prolific.com/submissions/complete?cc=XXXXXXX`).
2. Set `"minutes"` to how long the study takes and put `consent()` from `src/blocks/consent.js` first in the timeline. The consent form shows the length and the payment: £6 per hour, rounded up to the penny (e.g. 10 minutes is £1). Set the same reward on Prolific; the dashboard and `npm run build:jatos` show it.
3. Build and import (`npm run build:jatos`). In JATOS copy the **General Single** link, and in Prolific use it as the study URL with Prolific's URL parameters:
   ```
   https://your-jatos-server/publix/<code>?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}
   ```

See also the JATOS guide [Use Prolific](https://www.jatos.org/Use-Prolific.html).

## In the lab

1. Set `"recruitment": "lab"`. `endRedirectUrl` can stay empty.
2. Build and import. In JATOS copy the **General Multiple** link and open it on each lab computer. A General Single link only works once per browser, so it would block the second participant on a shared computer.

## DataPipe

With `"dataSaving": "datapipe"` everything above is the same, except the study link starts with the address where you host `dist/` instead of the JATOS link, e.g. `https://your-host/your-study/?id=%SURVEY_CODE%`.

## Devices

`"devices"` in `study.config.json` lists the devices participants may use: `"computer"`, `"tablet"` and/or `"phone"` (default `["computer"]`). Put `deviceCheck()` from `src/blocks/device.js` first in the timeline. Participants on another device see a message telling them what to do (return the study on Prolific, reopen it from SONA on an allowed device, or tell the researcher), and the run ends without the completion redirect, so they aren't paid or credited. JATOS marks these runs as failed with the message "Stopped: device", and the dashboard counts them as **Wrong device**.

On Prolific, also set the study's **Device compatibility** to the same devices, so people on other devices never see the study.

## Checks

`npm run build:jatos` stops if a Prolific or SONA study has no `endRedirectUrl`, or if a SONA one doesn't look like a SONA completion URL, since participants would finish without being paid or credited. `npm run build` warns about the same problems.
