#!/usr/bin/env node
/**
 * Prepares catalogue photography for the web.
 *
 *   node scripts/photos.mjs handicrafts
 *
 * Reads every image in assets/img/_incoming/, resizes the long edge to 1600 px,
 * re-encodes as JPEG q80, and writes it to assets/img/<section>/ under the same
 * basename. Name the incoming file after the SKU — pc-01.jpg — and the build
 * picks it up with no edit to the JSON.
 *
 * Uses macOS `sips`, which is built in. Originals in _incoming/ are left alone
 * and are not published; keep or discard them as you like.
 */
import { readdirSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IN = join(ROOT, 'assets/img/_incoming');
const MAX_EDGE = 1600;
const QUALITY = 80;

const section = process.argv[2];
if (!section) {
  console.error('usage: node scripts/photos.mjs <section>   e.g. handicrafts');
  process.exit(1);
}

const OUT = join(ROOT, 'assets/img', section);
mkdirSync(OUT, { recursive: true });

if (!existsSync(IN)) {
  console.error(`nothing to do — ${IN} does not exist`);
  process.exit(1);
}

const files = readdirSync(IN).filter((f) => /\.(jpe?g|png|tiff?|heic)$/i.test(f));
if (!files.length) {
  console.error(`no images found in assets/img/_incoming/`);
  process.exit(1);
}

/** Longest edge of an image, via sips. */
function longEdge(path) {
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', path],
    { encoding: 'utf8' });
  const w = Number(out.match(/pixelWidth:\s*(\d+)/)?.[1] ?? 0);
  const h = Number(out.match(/pixelHeight:\s*(\d+)/)?.[1] ?? 0);
  return Math.max(w, h);
}

for (const file of files) {
  const src = join(IN, file);
  const out = join(OUT, `${basename(file, extname(file)).toLowerCase()}.jpg`);
  // sips -Z will happily scale a small image UP; only pass it when we're shrinking.
  const resize = longEdge(src) > MAX_EDGE ? ['-Z', String(MAX_EDGE)] : [];
  execFileSync('sips', [
    ...resize,
    '-s', 'format', 'jpeg',
    '-s', 'formatOptions', String(QUALITY),
    src,
    '--out', out,
  ], { stdio: 'ignore' });
  const kb = Math.round(statSync(out).size / 1024);
  console.log(`  assets/img/${section}/${basename(out)}  ${kb} KB`);
}

console.log(`\n${files.length} image(s) ready. Run \`npm run build\` to see them on the page.`);
