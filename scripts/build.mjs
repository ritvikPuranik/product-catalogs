#!/usr/bin/env node
/**
 * Renders the catalogues in data/*.json into static HTML under dist/.
 *
 *   node scripts/build.mjs
 *
 * No dependencies. Adding a product means editing JSON, not HTML.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* Spec rows: rendered in this order, skipping anything an item doesn't carry.
   Add a key here and to an item's JSON and it shows up on the card. */
const FIELDS = [
  ['height_mm',  'Height',      (v) => `${v} mm`],
  ['material',   'Material'],
  ['finish',     'Finish'],
  ['artist',     'Artist'],
  ['surface',    'Surface'],
  ['pigments',   'Pigment'],
  ['size',       'Size'],
  ['moq',        'Min. order'],
  ['lead_time',  'Lead time'],
];

const site = read('data/site.json');
const sections = site.sections.map((s) => ({ ...s, ...read(`data/${s.slug}.json`) }));

/* ── partials ──────────────────────────────────────────────── */

function head(title, description, base) {
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<link rel="stylesheet" href="${base}assets/css/site.css">`;
}

function nav(base, current) {
  const links = sections.map((s) =>
    `<a href="${base}${s.slug}/"${s.slug === current ? ' aria-current="page"' : ''}>${esc(s.nav)}</a>`
  ).join('\n    ');
  return `  <nav class="nav">
    <a class="home" href="${base || './'}">${esc(site.brand)}</a>
    ${links}
  </nav>`;
}

function frame(image, base, alt, pendingLabel = 'Photography pending', sized = true) {
  if (!image) {
    return `<div class="frame pending"><span>${esc(pendingLabel)}</span></div>`;
  }
  const size = sized ? jpegSize(image) : null;
  const style = size ? ` style="aspect-ratio:${size.w}/${size.h}"` : '';
  const dims = size ? ` width="${size.w}" height="${size.h}"` : '';
  return `<div class="frame"${style}><img src="${base}${esc(image)}" alt="${esc(alt)}"${dims} loading="lazy" decoding="async"></div>`;
}

/* An item's photo: an explicit "image" in the JSON, else assets/img/<section>/<sku>.jpg
   if that file exists. Dropping pc-01.jpg into the section folder is enough. */
function resolveImage(item, section) {
  if (item.image) return item.image;
  const guess = `assets/img/${section.slug}/${item.sku.toLowerCase().replace(/\s+/g, '-')}.jpg`;
  return existsSync(join(ROOT, guess)) ? guess : null;
}

/* Intrinsic size of a JPEG, straight from its SOF marker — no dependencies.
   Frames are sized to the artwork so a landscape pata isn't stranded in a
   portrait box, and a portrait one isn't pillarboxed. */
function jpegSize(relPath) {
  let buf;
  try { buf = readFileSync(join(ROOT, relPath)); } catch { return null; }
  if (buf.readUInt16BE(0) !== 0xffd8) return null;
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    // SOF0-3, SOF5-7, SOF9-11, SOF13-15 carry the frame header
    if (marker >= 0xc0 && marker <= 0xcf &&
        marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

function specRows(item) {
  const rows = FIELDS
    .filter(([key]) => item[key] !== undefined && item[key] !== null && item[key] !== '')
    .map(([key, label, fmt]) =>
      `        <div><dt>${esc(label)}</dt><dd>${esc(fmt ? fmt(item[key]) : item[key])}</dd></div>`);
  return rows.length ? `      <dl class="spec">\n${rows.join('\n')}\n      </dl>` : '';
}

function plate(item, section, base) {
  return `    <article class="plate">
      <div class="plate-head">
        <span class="plate-no">${esc(item.sku)}</span>
      </div>
      ${frame(resolveImage(item, section), base, `${item.name} — ${section.title}`)}
      <p class="name">${esc(item.name)}</p>
      <p class="region">${esc(item.region || section.title)}</p>
      <p class="desc">${esc(item.description)}</p>
${specRows(item)}
      <div class="plate-foot">
        <span class="price">${esc(section.price_line)}</span>
        <span class="avail">${esc(item.availability)}</span>
      </div>
    </article>`;
}

function notes(section) {
  if (!section.notes?.length) return '';
  const blocks = section.notes.map((n) =>
    `    <div>
      <h2>${esc(n.heading)}</h2>
      <p>${esc(n.body)}</p>
    </div>`).join('\n');
  return `\n  <section class="notes">\n${blocks}\n  </section>\n`;
}

function footer() {
  return `  <footer>
    <span>${esc(site.brand)}</span>
    <span>Enquiries: <a href="mailto:${esc(site.contact_email)}">${esc(site.contact_email)}</a></span>
  </footer>`;
}

/* ── pages ─────────────────────────────────────────────────── */

function sectionPage(section) {
  const base = '../';
  const meta = section.meta.map((m) =>
    `      <div class="meta-item">
        <span class="meta-label">${esc(m.label)}</span>
        <span class="meta-value">${esc(m.value)}</span>
      </div>`).join('\n');

  const banner = section.placeholder_banner
    ? `  <p class="eyebrow" style="margin:0 0 28px">${esc(section.placeholder_banner)}</p>\n`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
${head(`${section.title} — ${site.brand}`, section.meta_description, base)}
</head>
<body>
<div class="wrap">
${nav(base, section.slug)}
  <header class="masthead">
    <p class="eyebrow">${esc(section.eyebrow)}</p>
    <h1>${esc(section.title)}</h1>
    <p class="dek">${esc(section.dek)}</p>
    <p class="dek">${esc(section.dek_2)}</p>
    <div class="meta-row">
${meta}
    </div>
  </header>
${banner}  <section class="grid">
${section.items.map((i) => plate(i, section, base)).join('\n')}
  </section>
${notes(section)}
${footer()}
</div>
</body>
</html>
`;
}

function landingPage() {
  const doors = sections.map((s) => `    <a class="door" href="${s.slug}/">
      ${frame(s.door_image, '', s.door_title, 'Photography pending', false)}
      <h2>${esc(s.door_title)}</h2>
      <p class="region">${esc(s.eyebrow)}</p>
      <p class="desc">${esc(s.door_blurb)}</p>
      <span class="go">View catalogue &rarr;</span>
    </a>`).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
${head(site.brand, site.landing_description, '')}
</head>
<body>
<div class="wrap">
  <header class="masthead">
    <p class="eyebrow">${esc(site.landing_eyebrow)}</p>
    <h1>${esc(site.landing_title)}</h1>
    <p class="dek">${esc(site.landing_dek)}</p>
  </header>

  <section class="doors">
${doors}
  </section>

${footer()}
</div>
</body>
</html>
`;
}

/* ── write ─────────────────────────────────────────────────── */

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// _incoming/ holds unprocessed originals — never publish it
cpSync(join(ROOT, 'assets'), join(DIST, 'assets'), {
  recursive: true,
  filter: (src) => !src.includes(`${sep}_incoming`),
});

writeFileSync(join(DIST, 'index.html'), landingPage());
console.log('  dist/index.html');

for (const section of sections) {
  const dir = join(DIST, section.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), sectionPage(section));
  const missing = section.items.filter((i) => !resolveImage(i, section)).length;
  console.log(`  dist/${section.slug}/index.html  —  ${section.items.length} items` +
    (missing ? `, ${missing} awaiting photography` : ''));
}

if (existsSync(join(ROOT, '_headers'))) cpSync(join(ROOT, '_headers'), join(DIST, '_headers'));
console.log('built.');
