// Pieces shared by the data-saving modules (jatos.js, datapipe.js).

/** Replace the display with a jsPsych-styled message. Returns the content element. */
export function message(displayElement, ...paragraphs) {
  const content = document.createElement("div");
  content.className = "jspsych-content";
  for (const text of paragraphs) {
    const p = document.createElement("p");
    p.textContent = text;
    content.append(p);
  }
  displayElement.replaceChildren(content);
  return content;
}

/** Tell the participant saving failed and offer a retry. */
export function showSaveFailed(displayElement, onRetry) {
  const content = message(
    displayElement,
    "We couldn't save your responses. Please check your internet connection and try again.",
    "Please don't close this page, or your responses will be lost.",
  );
  const retry = document.createElement("button");
  retry.className = "jspsych-btn";
  retry.textContent = "Try again";
  retry.addEventListener("click", onRetry);
  content.append(retry);
}

export const showSaving = (displayElement) =>
  message(displayElement, "Saving your responses…", "Please don't close this page.");

/**
 * Fill [NAME] placeholders in a redirect URL from the study link's URL
 * parameters, e.g. https://example.org/done?pid=[PROLIFIC_PID]. Same syntax
 * as JATOS's End Redirect URL.
 */
export function fillRedirectUrl(url, params) {
  return url.replace(/\[([^\]]+)\]/g, (_, name) => encodeURIComponent(params[name] ?? "undefined"));
}
