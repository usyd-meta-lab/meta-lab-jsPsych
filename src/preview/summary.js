// The study's setup at a glance, across the top of the dashboard: who takes
// part, how long it takes, what they get, which devices, and where data goes.
// Read from study.config.json, so it's also in the artifact preview.

import study from "/study.config.json";
import { devicesOf } from "../devices.js";
import { compensation, recruitmentOf } from "../recruitment.js";

// Line icons (24 × 24, drawn with the current text colour).
const ICONS = {
  prolific:
    '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 13.7c.5-.1 1-.2 1.5-.2 2.8 0 5 1.9 5 4.8"/>',
  sona: '<path d="M2 9l10-5 10 5-10 5-10-5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/><path d="M22 9v6"/>',
  lab: '<path d="M9 3h6"/><path d="M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7 15h10"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M9.5 2h5"/><path d="M12 2v3"/>',
  payment: '<circle cx="12" cy="12" r="9"/><path d="M14.5 8.2a2.6 2.6 0 0 0-4.5 1.8v5.5"/><path d="M8.5 12.5h5"/><path d="M8.5 16h7"/>',
  credit: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14l-1.5 7 5-3 5 3-1.5-7"/>',
  computer: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',
  tablet: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M11 18h2"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
  jatos:
    '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.5"/><path d="M4.5 5.5v13c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-13"/><path d="M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5"/>',
  datapipe: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/><path d="M12 11v5"/><path d="M9.5 13.5L12 16l2.5-2.5"/>',
};

const svg = (name) =>
  `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

const DEVICE_NAMES = { computer: "Computers", tablet: "Tablets", phone: "Phones" };

/** The items in the summary, in order. */
function items() {
  const recruitment = recruitmentOf(study);
  const pay = compensation(study);
  const devices = devicesOf(study);
  const list = [
    { icons: [recruitment.name], value: recruitment.label, caption: "Participants" },
    { icons: ["timer"], value: study.minutes ? `${study.minutes} minutes` : "Not set", caption: "Length", missing: !study.minutes },
  ];
  if (pay?.credit !== undefined) {
    list.push({ icons: ["credit"], value: `${pay.credit} ${pay.credit === 1 ? "credit" : "credits"}`, caption: "SONA credit" });
  } else if (pay?.payment) {
    list.push({ icons: ["payment"], value: pay.payment, caption: "Payment" });
  }
  list.push({
    icons: devices,
    value: devices.map((d, i) => (i === 0 ? DEVICE_NAMES[d] : DEVICE_NAMES[d].toLowerCase())).join(", "),
    caption: "Devices",
  });
  const saving = study.dataSaving === "datapipe" ? "datapipe" : "jatos";
  list.push({ icons: [saving], value: saving === "datapipe" ? "DataPipe" : "JATOS", caption: "Data saved to" });
  return list;
}

/** The summary strip, built with the dashboard's el() helper. */
export function setupSummary(el) {
  let list;
  try {
    list = items();
  } catch (error) {
    // e.g. an unknown recruitment value: say so instead of breaking the page.
    return el("p", { class: "pv-warning" }, error.message);
  }
  return el(
    "ul",
    { class: "pv-summary", "aria-label": "Study setup" },
    list.map((item) => {
      const icons = el("span", { class: "pv-summary-icons" });
      icons.innerHTML = item.icons.map(svg).join("");
      return el(
        "li",
        { class: `pv-summary-item${item.missing ? " pv-summary-missing" : ""}` },
        icons,
        el("span", { class: "pv-summary-value" }, item.value),
        el("span", { class: "pv-summary-caption" }, item.caption),
      );
    }),
  );
}
