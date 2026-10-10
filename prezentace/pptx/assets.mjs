/**
 * Grafika pro .pptx vyrenderovaná z HTML verze (../index.html): telefony se stínem, průvodci, krajina, QR, ikony.
 *   node assets.mjs   (puppeteer z ../../video/node_modules)
 * Text do PNG nejde, ten skládá build.js nativně.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const video = path.join(here, '../../video');
const puppeteer = createRequire(path.join(video, 'package.json'))('puppeteer');
const OUT = path.join(here, 'assets');
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(path.join(here, '../index.html')).href + '#2', { waitUntil: 'load' });
await page.evaluateHandle('document.fonts.ready');
// bez pozadí a animací, všechny snímky viditelné přes sebe (fotí se po prvcích)
await page.addStyleTag({ content: `
  html, body, .slide, #s-team, #s-end, #stage { background: transparent !important; }
  .slide { opacity: 1 !important; visibility: visible !important; }
  *, *::before { transition: none !important; }
  .slide > *, .slide .in, .slide .hop { animation: none !important; opacity: 0 !important; }
  #trail, #pv { display: none !important; }
  #lab { position: fixed; left: 0; top: 0; z-index: 9; }
  #lab > * { position: absolute; left: 40px; top: 40px; display: none; }
` });

/** Výřez kolem prvku s okrajem (stín telefonu přesahuje box). */
async function snap(selector, name, pad = [0, 0, 0, 0]) {
  await page.evaluate((s) => {
    document.querySelectorAll('.snap').forEach((e) => e.classList.remove('snap'));
    const el = document.querySelector(s);
    el.classList.add('snap');
    for (let p = el; p && p.classList; p = p.parentElement) p.style.setProperty('opacity', '1', 'important');
  }, selector);
  await page.addStyleTag({ content: '.snap, .snap * { opacity: 1 !important; }' });
  const b = await (await page.$(selector)).boundingBox();
  const [t, r, bt, l] = pad;
  await page.screenshot({ path: path.join(OUT, `${name}.png`), omitBackground: true, clip: { x: b.x - l, y: b.y - t, width: b.width + l + r, height: b.height + t + bt } });
  await page.evaluate((s) => { for (let p = document.querySelector(s); p && p.classList; p = p.parentElement) p.style.removeProperty('opacity'); }, selector);
  console.log('·', name, Math.round(b.width), '×', Math.round(b.height));
}

// telefony: stín 0 40px 70px -30px → přesah 40 do stran, 80 dolů
const SHADOW = [20, 45, 85, 45];
const phones = { map: 1, place: 2, pass: 3, battle: 4 };
for (const [n, k] of Object.entries(phones)) await snap(`.steps .step:nth-child(${k}) .phone`, `phone-${n}`, SHADOW);
await snap('.side-phone .phone', 'phone-insights', SHADOW);

// krajina: noční (tým) a denní (závěr)
await snap('#s-team .land', 'land-night');
await snap('#s-end .land', 'land-day');

// průvodci, QR a ikony ve vlastní laboratoři
await page.evaluate(() => {
  const lab = document.createElement('div');
  lab.id = 'lab';
  lab.innerHTML = [
    ...['boza', 'vridla', 'kukadlo'].map((g) => `<svg id="l-${g}" width="400" height="400"><use href="#g-${g}"/></svg>`),
    '<svg id="l-qr" width="580" height="580" style="color:#1c2b22"><use href="#qr"/></svg>',
    '<svg id="l-bus" width="120" height="120" style="color:#2f6fa8"><use href="#i-bus"/></svg>',
    '<svg id="l-food" width="120" height="120" style="color:#b83a5e"><use href="#i-food"/></svg>',
  ].join('');
  document.body.append(lab);
});
for (const id of ['boza', 'vridla', 'kukadlo', 'qr', 'bus', 'food']) {
  await page.evaluate((i) => { document.querySelectorAll('#lab > *').forEach((e) => { e.style.display = e.id === `l-${i}` ? 'block' : 'none'; }); }, id);
  await snap(`#l-${id}`, id === 'qr' || id === 'bus' || id === 'food' ? id : `guide-${id}`);
}
await browser.close();

// plakát videa: titulek ZÁPAD GO ze 7. sekundy
execFileSync(path.join(video, 'node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe'),
  ['-loglevel', 'error', '-y', '-ss', '7.5', '-i', path.join(here, '../zapad-go.mp4'), '-frames:v', '1', path.join(OUT, 'video-cover.jpg')]);
console.log('hotovo');
