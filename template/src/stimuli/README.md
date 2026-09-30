# Stimuli

Put the experiment's images, audio and video here (subfolders are fine) and refer to them by name in `src/experiment.js`:

```js
import { stimulus, stimuliIn } from "./stimuli.js";

stimulus: stimulus("cat.png")                            // src/stimuli/cat.png
timeline_variables: stimuliIn("faces").map((face) => ({ face }))  // every file in src/stimuli/faces/
```

`preload()` (in `src/blocks/preload.js`) loads every file here before the task. Files here work in `npm run dev`, the participant build and the artifact preview.

Supported: png, jpg, gif, webp, avif, svg, bmp; mp3, wav, ogg, m4a, aac, flac; mp4, webm, mov, m4v.

Keep files small. Participants download all of them before the task, and the artifact preview (a single page) can hold only about 10 MB of stimuli. The build warns when you're close.
