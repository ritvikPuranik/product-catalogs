# Product catalogues

Two static catalogues built from JSON:

- **`devotional/`** — 3D-printed devotional items. B2B, wholesale and white-label. No prices shown; every card reads *Price on request*.
- **`handicrafts/`** — hand-painted Odisha Pattachitra for export. B2C, but prices are hidden until vendor quotes land; cards read *Reach out for price details*.

Philately is deliberately not built yet.

## Layout

```
data/site.json           brand, contact, landing copy, section list
data/devotional.json     the 9 SKUs
data/handicrafts.json    6 placeholder pieces
assets/css/site.css      the whole design, shared by every page
assets/fonts/*.woff2     Newsreader Display, Public Sans, IBM Plex Mono
assets/img/<section>/    catalogue photography
assets/img/_incoming/    drop zone for unprocessed photos (never published)
scripts/build.mjs        JSON + template -> dist/
scripts/photos.mjs       resize and re-encode incoming photography
dist/                    build output, gitignored
```

## Everyday tasks

```sh
npm run build     # render dist/
npm run serve     # build, then http://localhost:8000
```

### Add or change a product

Edit the section's JSON. Nothing else. Each item takes:

```json
{
  "sku": "PC-07",
  "name": "Kanchi Abhijan",
  "region": "Cloth pata",
  "artist": "…",
  "surface": "Cloth pata",
  "pigments": "Natural, hand-ground",
  "size": "18 × 24 in",
  "availability": "Enquire",
  "description": "…"
}
```

Spec rows render in a fixed order and any field you omit is skipped, so a devotional
item uses `height_mm` / `material` / `finish` while a painting uses `artist` / `surface`
/ `pigments` / `size`. Two extra keys are wired up and unused — `moq` and `lead_time`.
Add either to a devotional item and the row appears; that's where minimum order
quantity and production lead time go once you've settled them.

### Add photography

1. Drop the full-size files into `assets/img/_incoming/`.
2. **Name each file after its SKU** — `pc-01.jpg`, `pc-02.jpg`.
3. `npm run photos handicrafts`

That resizes the long edge to 1600 px, re-encodes to JPEG q80, and writes into
`assets/img/handicrafts/`. The build matches `pc-01.jpg` to SKU `PC-01` on its own,
so there is nothing to edit in the JSON. Any item still without a photo renders a
hatched *Photography pending* frame, which is why the Pattachitra page is
presentable while it is still empty.

If a file needs a name that isn't its SKU, set `"image": "assets/img/handicrafts/whatever.jpg"`
on the item and that wins.

Frames are sized to each artwork: the build reads the JPEG's real dimensions and sets
the frame's aspect ratio, so a landscape pata is not stranded in a portrait box and
nothing is cropped. Any shape works.

Shooting notes: square-on to the painting, no angle; even indirect daylight, no flash;
include the full pata edge — buyers want to see the border and the hand-built ground.

### Reworking a crop

`npm run photos` only resizes. The nine Pattachitra photos also needed rotating,
cropping away phone-screenshot chrome, and a tone lift, which is what
`scripts/prep-photos.py` does — one SPEC entry per painting holding its crop box,
rotation and tone preset. To adjust one, edit its entry and re-run:

```sh
python3 -m venv .venv && .venv/bin/pip install Pillow
.venv/bin/python scripts/prep-photos.py /tmp/sheet.jpg   # also writes a contact sheet
npm run build
```

It reads from `assets/img/_incoming/`, so keep the originals there.

### Turn prices on

When vendor quotes arrive, add `"price"` to each Pattachitra item and change
`price_line` in `data/handicrafts.json`. The devotional catalogue stays *Price on
request* — that one is deliberate, not pending.

## Hosting

Cloudflare Pages, connected to this repo:

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Framework preset:** none

Every push to `main` deploys; pull requests get their own preview URL.
