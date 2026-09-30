// Images, audio and video for the experiment, from src/stimuli/.
//
// Put files in src/stimuli/ (subfolders are fine) and refer to them by name:
//
//   stimulus: stimulus("cat.png")
//   timeline_variables: stimuliIn("faces").map((face) => ({ face }))
//
// Vite bundles every file there, so the same names work in npm run dev, the
// participant build (JATOS or any host) and the single-file artifact
// preview. preload() in blocks/preload.js loads them all before the task.

const IMAGE = /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i;
const AUDIO = /\.(mp3|wav|ogg|m4a|aac|flac)$/i;
const VIDEO = /\.(mp4|webm|mov|m4v)$/i;

// Keys look like "/src/stimuli/faces/f1.png"; values are the bundled URLs.
const found = import.meta.glob(
  "/src/stimuli/**/*.{png,jpg,jpeg,gif,webp,avif,svg,bmp,mp3,wav,ogg,m4a,aac,flac,mp4,webm,mov,m4v,PNG,JPG,JPEG,GIF,WEBP,SVG,MP3,WAV,OGG,M4A,MP4,WEBM,MOV}",
  { eager: true, query: "?url", import: "default" },
);
const files = Object.fromEntries(Object.entries(found).map(([path, url]) => [path.replace("/src/stimuli/", ""), url]));
const names = Object.keys(files).sort();

/** URL of a file in src/stimuli/, by its name there, e.g. "cat.png" or "faces/f1.png". */
export function stimulus(name) {
  const url = files[name];
  if (url) return url;
  const lower = name.toLowerCase();
  const close = names.filter((n) => n.toLowerCase() === lower || n.toLowerCase().includes(lower.replace(/\.\w+$/, "")));
  throw new Error(
    `There's no "${name}" in src/stimuli/.` + (close.length ? ` Did you mean ${close.map((n) => `"${n}"`).join(" or ")}?` : ""),
  );
}

/** URLs of every file in a folder of src/stimuli/ (and its subfolders), sorted by name. */
export function stimuliIn(folder) {
  const prefix = folder.replace(/\/?$/, "/");
  const urls = names.filter((n) => n.startsWith(prefix)).map((n) => files[n]);
  if (urls.length === 0) throw new Error(`There are no stimuli in src/stimuli/${prefix}.`);
  return urls;
}

/** The src/stimuli/ name for a stimulus URL (or the URL itself if it isn't one). */
export function fileName(url) {
  return names.find((n) => files[n] === url) ?? url;
}

/** Every stimulus URL, grouped for jsPsych's preload plugin. */
export function allStimuli() {
  const pick = (pattern) => names.filter((n) => pattern.test(n)).map((n) => files[n]);
  return { images: pick(IMAGE), audio: pick(AUDIO), video: pick(VIDEO) };
}
