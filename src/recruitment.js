// Where participants come from ("recruitment" in study.config.json):
// "prolific", "sona" or "lab". This decides which URL parameters the study
// link needs, which ID columns are saved, and where participants are sent
// when they finish.
//
// Plain JavaScript with no Node or browser APIs: used by the participant
// build (src/data/), the build scripts, local JATOS and the dashboard.

export const RECRUITMENT = {
  prolific: {
    label: "Prolific",
    // Prolific fills in the {{%...%}} placeholders for each participant.
    linkParams: "PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}",
    testParams: "PROLIFIC_PID=local-test&STUDY_ID=local&SESSION_ID=local",
    idParam: "PROLIFIC_PID",
    // Each participant uses their own browser, so each link works once per browser.
    jatosLink: "General Single",
  },
  sona: {
    label: "SONA",
    // SONA replaces %SURVEY_CODE% with the participant's anonymous ID code.
    linkParams: "id=%SURVEY_CODE%",
    testParams: "id=local-test",
    idParam: "id",
    jatosLink: "General Single",
  },
  lab: {
    label: "In the lab",
    linkParams: "",
    testParams: "",
    idParam: null,
    // Several participants share each lab computer.
    jatosLink: "General Multiple",
  },
};

// Lab rates, applied to "minutes" in study.config.json.
export const SONA_CREDIT_PER_HOUR = 1;
export const PROLIFIC_GBP_PER_HOUR = 6;

/**
 * What participants get for the study's length ("minutes" in
 * study.config.json): { minutes, credit } for SONA, rounded up to the next
 * 0.25 credit, or { minutes, payment } for Prolific, rounded up to the penny
 * and written like "£1" or "£1.50". Null when minutes isn't set, or in the lab.
 */
export function compensation(config) {
  const minutes = Number(config.minutes);
  if (!(minutes > 0)) return null;
  const { name } = recruitmentOf(config);
  if (name === "sona") {
    const credit = Math.ceil(((minutes / 60) * SONA_CREDIT_PER_HOUR) / 0.25 - 1e-9) * 0.25;
    return { minutes, credit };
  }
  if (name === "prolific") {
    const pence = Math.ceil((minutes / 60) * PROLIFIC_GBP_PER_HOUR * 100 - 1e-9);
    const payment = pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
    return { minutes, payment };
  }
  return null;
}

/** The recruitment settings for a study config (Prolific when unset). */
export function recruitmentOf(config) {
  const name = config.recruitment ?? "prolific";
  const settings = RECRUITMENT[name];
  if (!settings) {
    throw new Error(`study.config.json: recruitment must be "prolific", "sona" or "lab", not "${name}".`);
  }
  return { name, ...settings };
}

/** Add URL parameters to a study link (keeps any it already has). */
export function withParams(link, params) {
  if (!params) return link;
  return `${link}${link.includes("?") ? "&" : "?"}${params}`;
}

/**
 * Where participants go after their data is saved, with [NAME] placeholders
 * filled from the study link's URL parameters (by JATOS, or by
 * fillRedirectUrl in the DataPipe build). Empty: no redirect.
 *
 * For SONA, endRedirectUrl is the "Completion URL" from the study's
 * information page on SONA, pasted as is. Its survey_code=XXXX becomes the
 * participant's ID code, which is how SONA knows whom to grant credit.
 */
export function endRedirectUrl(config) {
  const url = (config.endRedirectUrl ?? "").trim();
  if (recruitmentOf(config).name !== "sona" || !url) return url;
  return url.replace(/([?&]survey_code=)[^&#]*/i, "$1[id]");
}

/** Problems that would stop participants getting paid or credited correctly. */
export function recruitmentProblems(config) {
  const problems = paymentProblems(config);
  // Without its ID, a DataPipe study can't save anything.
  if (config.dataSaving === "datapipe" && !String(config.datapipeExperimentId ?? "").trim()) {
    problems.push(
      "DataPipe studies need datapipeExperimentId: sign in at https://pipe.jspsych.org, create an experiment, and copy its experiment ID into study.config.json.",
    );
  }
  return problems;
}

function paymentProblems(config) {
  const { name } = recruitmentOf(config);
  const url = (config.endRedirectUrl ?? "").trim();
  if (name !== "lab" && !(Number(config.minutes) > 0)) {
    return ['Set "minutes" in study.config.json to how long the study takes. The consent form\'s length and credit or payment come from it.'];
  }
  if (name === "sona") {
    if (!url) {
      return ['SONA studies need endRedirectUrl: paste the "Completion URLs" link from the study\'s Study Information page on SONA.'];
    }
    if (!/sona-systems\.(com|net)/i.test(url) || !/[?&]survey_code=/i.test(url) || !/[?&]credit_token=/i.test(url)) {
      return ["endRedirectUrl doesn't look like a SONA completion URL (it should contain credit_token= and survey_code=). Copy it from the study's Study Information page on SONA."];
    }
  }
  if (name === "prolific" && !url) {
    return ["Prolific studies need endRedirectUrl: the completion URL from Prolific (https://app.prolific.com/submissions/complete?cc=...)."];
  }
  return [];
}

/** ID columns saved with every trial, from the study link's URL parameters. */
export function participantColumns(config, params) {
  const { name } = recruitmentOf(config);
  if (name === "prolific") {
    return {
      prolific_pid: params.PROLIFIC_PID ?? null,
      prolific_study_id: params.STUDY_ID ?? null,
      prolific_session_id: params.SESSION_ID ?? null,
    };
  }
  if (name === "sona") return { sona_id: params.id ?? null };
  return {};
}

/** The participant's ID from the study link, or null (e.g. in the lab). */
export function participantId(config, params) {
  const { idParam } = recruitmentOf(config);
  return idParam ? (params[idParam] ?? null) : null;
}
