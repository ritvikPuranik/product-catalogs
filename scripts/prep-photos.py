"""Crop, rotate and tone the Pattachitra photography.

Originals live in assets/img/_incoming/; finished files are written to
assets/img/handicrafts/ under the names the catalogue JSON references.
Each SPEC entry is (output name, crop as L/T/R/B fractions, CCW rotation,
tone preset) - adjust a crop here and re-run rather than editing by hand.

Needs Pillow, which Homebrew's python refuses to install globally:

    python3 -m venv .venv
    .venv/bin/pip install Pillow
    .venv/bin/python scripts/prep-photos.py /tmp/sheet.jpg

The argument is where to write a 3x3 contact sheet for checking the result.
"""
import sys, pathlib
from PIL import Image, ImageOps, ImageEnhance

ROOT = pathlib.Path(__file__).resolve().parent.parent
IN   = ROOT / 'assets/img/_incoming'
OUT  = ROOT / 'assets/img/handicrafts'
MAX_EDGE = 1600

# src filename -> (out name, crop L/T/R/B as fractions, rotate degrees CCW, punch)
SPEC = {
  'WhatsApp Image 2026-08-30 at 13.29.43.jpeg':
      ('jagannath-trinity-temple',    (0.055, 0.022, 0.950, 0.972),  90, 'soft'),
  'WhatsApp Image 2026-08-30 at 13.29.44.jpeg':
      ('jagannath-gold',              (0.012, 0.022, 0.965, 0.995),   0, 'soft'),
  'WhatsApp Image 2026-08-30 at 13.29.44 (1).jpeg':
      ('jagannath-colour',            (0.060, 0.120, 0.940, 0.790),   0, 'punch'),
  'WhatsApp Image 2026-08-30 at 13.29.45.jpeg':
      ('panchamukhi-hanuman',         (0.014, 0.085, 0.988, 0.855),   0, 'punch'),
  'WhatsApp Image 2026-08-30 at 13.29.45 (1).jpeg':
      ('raas-mandala',                (0.034, 0.252, 0.956, 0.666),   0, 'punch'),
  'WhatsApp Image 2026-08-30 at 13.29.45 (2).jpeg':
      ('jagannath-trinity-ratnavedi', (0.010, 0.022, 0.988, 0.972),   0, 'punch'),
  'WhatsApp Image 2026-08-30 at 13.29.46.jpeg':
      ('hanuman-chalisa',             (0.022, 0.112, 0.973, 0.893),   0, 'punch'),
  'WhatsApp Image 2026-08-30 at 13.29.46 (1).jpeg':
      ('ganesha',                     (0.018, 0.098, 0.973, 0.860),   0, 'punch'),
  'WhatsApp Image 2026-08-30 at 13.29.47.jpeg':
      ('jagannath-trinity-garlands',  (0.005, 0.005, 0.935, 0.995),  90, 'soft'),
}

TONE = {  # (autocontrast cutoff, saturation, sharpness)
  'soft':  (0.3, 1.03, 1.05),
  'punch': (0.6, 1.06, 1.15),
}

OUT.mkdir(parents=True, exist_ok=True)
made = []
for src, (name, box, rot, tone) in SPEC.items():
    im = Image.open(IN / src)
    im = ImageOps.exif_transpose(im).convert('RGB')
    w, h = im.size
    l, t, r, b = box
    im = im.crop((int(l * w), int(t * h), int(r * w), int(b * h)))
    if rot:
        im = im.rotate(rot, expand=True)
    cut, sat, sharp = TONE[tone]
    im = ImageOps.autocontrast(im, cutoff=cut, preserve_tone=True)
    im = ImageEnhance.Color(im).enhance(sat)
    im = ImageEnhance.Sharpness(im).enhance(sharp)
    if max(im.size) > MAX_EDGE:
        im.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
    dest = OUT / f'{name}.jpg'
    im.save(dest, 'JPEG', quality=88, optimize=True, progressive=True)
    made.append((dest, im.size))
    print(f'  {name}.jpg  {im.size[0]}x{im.size[1]}  {dest.stat().st_size // 1024} KB')

# contact sheet for a single visual check
CELL, COLS = 460, 3
rows = (len(made) + COLS - 1) // COLS
sheet = Image.new('RGB', (CELL * COLS, CELL * rows), (240, 236, 226))
for i, (p, _) in enumerate(made):
    th = Image.open(p); th.thumbnail((CELL - 16, CELL - 16), Image.LANCZOS)
    x = (i % COLS) * CELL + (CELL - th.size[0]) // 2
    y = (i // COLS) * CELL + (CELL - th.size[1]) // 2
    sheet.paste(th, (x, y))
sheet.save(sys.argv[1], 'JPEG', quality=82)
print('contact sheet ->', sys.argv[1])
