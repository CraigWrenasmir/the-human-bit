# The Human Bit

**Joshua MacWilliams x Craig Smith** — the full *Parent Teacher Interview*, S2 E14: *AI and the Human Side of Learning with Craig Smith*.

An animated conversation in the Universal Sandpit style. This edition keeps the supplied full recording intact, including the acknowledgement, teaser, introduction and closing material.

## Watch and navigate

Open the hosted website, or serve this directory locally with an HTTP server that supports byte-range requests for audio seeking. The supplied `tools/serve.py` can do this:

```sh
python3 tools/serve.py --directory . --port 4200
```

Then open `http://127.0.0.1:4200/`. A direct `file://` launch cannot load the JavaScript modules and timing assets. All runtime dependencies, fonts and media are local to the site; playback makes no API calls.

Playful is the default motion level. Gentle and Lively remain available; devices requesting reduced motion start on Gentle. The browser remembers playback position and the chosen motion level on this device when storage is available. Chapters and transcript timestamps jump to the relevant passage. A `?t=720` link opens at twelve minutes. Space plays or pauses when focus is outside a control.

## Files

- `app.js` controls the composition, captions, navigation and playback.
- `portrait.js` contains the authored Three.js block characters. Craig faces Joshua and both have blue eye accents.
- `assets/episode.mp3` is the complete supplied episode with fixed -3 dB gain for playback headroom and brief edge fades.
- `assets/timing.json` contains full-episode speaker turns, words, caption cues, audio energy and provenance.
- `assets/chapters.json` contains the chapter navigation.
- `assets/episode.vtt` and `assets/episode.srt` provide captions.
- `vendor/` contains Three.js and its MIT licence.
- `assets/fonts/` contains the local Space Mono and Inter fonts and their OFL licences.
- `tools/render.mjs` renders a deterministic 1080p video in resumable segments.
- `validation.json` records this edition's completed checks.

The page streams the audio file directly. The exported video uses the same animation and word timeline, with Playful motion fixed for the film. Mouth poses respond to speech energy, not phonemes; this is a stylised animation, not a reconstruction of either person's facial performance. Caption word timings are machine-estimated; the supplied transcript remains the wording source. Detailed alignment and speaker evidence is recorded with the timing data.

## Export

Install Node.js, FFmpeg, and the optional renderer dependencies:

```sh
npm install
npx playwright install chromium
```

Keep the local server running and follow `node tools/render.mjs --help` or the renderer's options at the top of that file. The export uses lossless PNG frames piped to H.264, plus AAC audio, and saves completed segments with source/configuration fingerprints for safe resume. The full MP4 is a separate downloadable deliverable for YouTube; it is not needed by the interactive site.

## Hosting

This is a static site suitable for GitHub Pages. Publish only the runtime site, including its audio and caption assets, fonts and vendor licence. Configure `humanbit.theuniversalsandpit.org` in the repository's Pages settings, then point that subdomain's DNS CNAME to `craigwrenasmir.github.io`.

Original reference portraits and source documents remain in the separate local pilot project. Earlier pilot MP4s and packages remain unchanged. The original episode title and podcast attribution are retained. This repository does not grant additional rights to the supplied recording or source references.
