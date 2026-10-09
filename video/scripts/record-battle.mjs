/**
 * Záznam souboje pro scénu 7: dva hráči (Bára a Kuba) v telefonu, skutečný hodnocený matchmaking,
 * tahy klikané v UI. Server počítá všechno sám, skript jen předem nastaví seed (viz battle_setup.py),
 * aby naplánovaná kouzla trefila a souboj skončil KO. Stejný seed = při každém průchodu stejný souboj.
 *
 * Běží proti lokálnímu dockeru (frontend :3000, backend :8000):
 *   node scripts/record-battle.mjs phones   oba telefony v 1× (plynulé, na záběr dvou telefonů)
 *   node scripts/record-battle.mjs a|b      jen hráč A/B ve 3× (detail arény přes celou obrazovku)
 * ponytail: ve 3× stíhá screencast jen ~13 fps, proto HD průchod zpomalí čas animací v prohlížeči na RATE
 * (server běží normálně) a video se při skládání zrychlí zpět; efektivně ~30 fps.
 * Výstup do public/rec/: battle-a.mp4, battle-b.mp4 (phones), battle-a-hd.mp4…, a battle-<průchod>.json s časy událostí.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const PASS = process.argv[2] ?? 'phones';
const APP = 'http://localhost:3000';
const OUT = 'public/rec';
const FFMPEG = 'node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe';
const SIZE = { width: 412, height: 892 };
const RATE = 0.4;
const MOVE_NAME = {
  thunder: 'Blesk z výšin', gust: 'Vichřice', sunbeam: 'Sluneční paprsek',
  rockfall: 'Kamenná lavina', siege_fire: 'Ohnivá střela z hradeb', heavy: 'Silný úder', attack: 'Útok',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now() / 1000;
const shell = (code) => execFileSync('docker', ['exec', '-i', 'web_template-backend-1', 'python', 'manage.py', 'shell'], { input: code }).toString();

// 1) demo hráči, tvorové a seed
const raw = shell(fs.readFileSync('scripts/battle_setup.py'));
const setup = JSON.parse(raw.slice(raw.indexOf('RESULT ') + 7));
console.log('průchod', PASS, 'seed', setup.seed, 'kol', setup.turns);
fs.mkdirSync(OUT, { recursive: true });

// Každý hráč má vlastní prohlížeč: vlastní cookies a vlastní škálování.
const players = [];
for (const [key, side] of [['demo_bara', 'a'], ['demo_kuba', 'b']]) {
  const record = PASS === 'phones' || PASS === side;
  const scale = PASS === side ? 3 : 1;
  const rate = PASS === side ? RATE : 1;
  const browser = await puppeteer.launch({
    headless: true,
    // screencast posílá snímky ve škálování okna, ne podle emulovaného DPR, proto vynucené
    args: [`--force-device-scale-factor=${scale}`, '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11',
      '--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
  });
  await browser.setCookie({ name: 'access_token', value: setup[key].token, domain: 'localhost', path: '/', httpOnly: true });
  const page = await browser.newPage();
  await page.setViewport({ ...SIZE, deviceScaleFactor: scale, isMobile: true, hasTouch: true });
  // dev indikátor Next.js do videa nepatří
  await page.evaluateOnNewDocument(() => addEventListener('DOMContentLoaded', () =>
    document.head.append(Object.assign(document.createElement('style'), { textContent: 'nextjs-portal{display:none!important}' }))));
  if (rate < 1) {
    await page.evaluateOnNewDocument((r) => {
      // gsap čte Date.now, Pixi performance.now a čas z rAF; podvrhnout dřív, než se načte bundle
      const pn = performance.now.bind(performance), dn = Date.now, p0 = pn(), d0 = dn();
      performance.now = () => p0 + (pn() - p0) * r;
      Date.now = () => d0 + (dn() - d0) * r;
      const raf = requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) => raf((t) => cb(p0 + (t - p0) * r));
      const st = setTimeout.bind(window);
      window.setTimeout = (fn, ms = 0, ...a) => st(fn, ms / r, ...a);
    }, rate);
    const cdp = await page.createCDPSession();
    await cdp.send('Animation.enable');
    await cdp.send('Animation.setPlaybackRate', { playbackRate: rate }); // CSS přechody (HP pruhy)
  }
  const dir = path.join(OUT, `frames-${PASS}-${side}`);
  if (record) fs.rmSync(dir, { recursive: true, force: true }), fs.mkdirSync(dir);
  players.push({ side, browser, page, dir, record, rate, plan: setup[key].plan, frames: [],
    out: `battle-${side}${PASS === 'phones' ? '' : '-hd'}.mp4` });
}
const [A, B] = players;

// 2) zahřát dev server (první kompilace stránky by v záznamu zasekla animace)
for (const p of players) {
  await p.page.goto(`${APP}/battle`, { waitUntil: 'networkidle0' });
  await p.page.locator('button::-p-text(Hodnocený souboj)').wait();
}
await A.page.goto(`${APP}/battle/00000000-0000-0000-0000-000000000000`, { waitUntil: 'networkidle0' });
await A.page.goto(`${APP}/battle`, { waitUntil: 'networkidle0' });

// 3) záznam obrazovky přes CDP screencast (JPEG + časové razítko snímku)
async function startRec(p) {
  p.cdp = await p.page.createCDPSession();
  p.cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    p.cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    const file = path.join(p.dir, `${String(p.frames.length).padStart(5, '0')}.jpg`);
    p.frames.push({ file, t: metadata.timestamp });
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
  });
  await p.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
}

const events = [];
const mark = (name, extra = {}) => { events.push({ name, t: now(), ...extra }); console.log('·', name); };

async function tap(p, selector, name) {
  const el = await p.page.waitForSelector(selector, { timeout: 60000 });
  const box = await el.boundingBox();
  await el.tap();
  mark(name, { side: p.side, x: (box.x + box.width / 2) / SIZE.width, y: (box.y + box.height / 2) / SIZE.height });
}

const rec = players.filter((p) => p.record);
await Promise.all(rec.map(startRec));
await sleep(1500);

// 4) matchmaking: Bára čeká ve frontě, Kuba ji najde
await tap(A, 'button::-p-text(Hodnocený souboj)', 'a_queue');
await A.page.locator('::-p-text(Hledám soupeře)').wait();
await sleep(2500);
await tap(B, 'button::-p-text(Hodnocený souboj)', 'b_queue');
const ready = (p) => p.page.waitForSelector('button[aria-label^="Útok,"]:not([disabled])', { timeout: 90000 });
await Promise.all(players.map(ready));
mark('matched');
const battleId = A.page.url().split('/').pop();
shell(`from apps.battles.models import Battle; Battle.objects.filter(pk='${battleId}').update(seed=${setup.seed})`);
await sleep(1500);

// 5) tahy podle plánu
for (let turn = 0; turn < setup.turns; turn++) {
  for (const p of players) {
    await tap(p, `button[aria-label^="${MOVE_NAME[p.plan[turn]]},"]:not([disabled])`, `turn${turn + 1}_${p.side}_${p.plan[turn]}`);
    await sleep(700);
  }
  if (turn + 1 < setup.turns) await Promise.all(players.map(ready));
}
await B.page.locator('::-p-text(Vítězství!)').setTimeout(90000).wait();
mark('end');
await sleep(4000);
await Promise.all(rec.map((p) => p.cdp.send('Page.stopScreencast')));
await Promise.all(players.map((p) => p.browser.close()));

// 6) snímky → 30 fps MP4 (délka snímku = rozdíl časových razítek)
const meta = { pass: PASS, seed: setup.seed, videos: {}, events: [] };
for (const p of rec) {
  const f = p.frames;
  const list = ['ffconcat version 1.0', ...f.flatMap((x, i) => [
    `file '${path.basename(x.file)}'`, `duration ${(((f[i + 1]?.t ?? x.t + 0.5) - x.t) * p.rate).toFixed(4)}`])];
  list.push(`file '${path.basename(f.at(-1).file)}'`);
  fs.writeFileSync(path.join(p.dir, 'list.txt'), list.join('\n'));
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(p.dir, 'list.txt'),
    '-fps_mode', 'cfr', '-r', '30', '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', path.join(OUT, p.out)]);
  meta.videos[p.side] = { file: `rec/${p.out}`, start: f[0].t, rate: p.rate, fps: +(f.length / (f.at(-1).t - f[0].t) / p.rate).toFixed(1) };
  fs.rmSync(p.dir, { recursive: true });
}
// časy událostí v sekundách od začátku videa daného hráče
meta.events = events.map((e) => ({ ...e, ...Object.fromEntries(Object.entries(meta.videos).map(([s, v]) => [`t_${s}`, +((e.t - v.start) * v.rate).toFixed(3)])) }));
fs.writeFileSync(path.join(OUT, `battle-${PASS}.json`), JSON.stringify(meta, null, 1));
console.log('hotovo', JSON.stringify(meta.videos));
