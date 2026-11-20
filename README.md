# Vice Coast Cover Studio

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/z3yc/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/z3yc/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

An offline web app that turns your own photos into a GTA-style multi-panel
poster cover — a Vice City neon-sunset look, bold Anton title lettering with a
Pacifico script subtitle — and exports it as a PNG to share. Built for the
[make.fun bounty gta6-cover-art-01](https://make.fun/bounty/gta6-cover-art-01).

## What it does

- **Your photos, on your machine.** Add photos from your device (FileReader —
  nothing is uploaded) or load the two included sample photos.
- **Multi-panel layouts.** Hero + 3, four-panel grid, nine-panel grid, split
  duo, or a full-bleed single photo. One photo can fill several panels, or each
  panel can hold a different photo.
- **Crop and position per panel.** Click a panel to select it, drag inside it
  to move the photo, scroll or use the slider to zoom, centre or clear it.
- **Colour grades.** Sunset, Neon, Vice teal-pink, Noir black-and-white and
  Golden hour — each a filter plus a colour wash and glow.
- **Lettering.** Edit the title and subtitle, resize the title, and pick a
  title style (sunset gradient, clean white, neon pink, gold).
- **Polish.** Film grain, vignette, panel gutters and a neon frame; live
  preview as you edit; undo/redo (Ctrl/Cmd+Z).
- **Export.** One click exports a PNG at 1080×1080, 1080×1350 or 1920×1080.

## Run it

Serve `app/` with any static server and open `index.html` in desktop Chrome.
No build step, no network requests — every script, font and image is a file
under `app/`. For local development:

```sh
node serve.ts
# open http://localhost:8080
```

## Fonts

Anton and Pacifico are bundled under `app/fonts/` under the SIL Open Font
License (their `OFL-*.txt` texts sit beside them). No Rockstar logo, artwork
or font is used anywhere in this app.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `app/` and `screenshots/`
to `/output` and writes `/output/dossier.json` with `vendor/makefun-app.ts`.

## License

MIT — see [LICENSE](LICENSE).
