/**
 * Společné nahrávání obrazovky aplikace pro video: telefon 412 × 892, CDP screencast do JPEG snímků → 30 fps MP4.
 * ponytail: ve 2–3× stíhá screencast málo snímků, proto `rate` zpomalí čas animací v prohlížeči (server běží normálně)
 * a video se při skládání zrychlí zpět. Stejný trik jako v record-battle.mjs.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

export const APP = 'http://localhost:3000';
export const SIZE = { width: 412, height: 892 };
const OUT = 'public/rec';
const FFMPEG = 'node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Spustí python skript v kontejneru backendu a vrátí JSON z řádku RESULT. */
export function backend(file) {
  const raw = execFileSync('docker', ['exec', '-i', '-e', 'PYTHONIOENCODING=utf-8', 'web_template-backend-1', 'python', 'manage.py', 'shell'],
    { input: fs.readFileSync(file) }).toString();
  return JSON.parse(raw.slice(raw.indexOf('RESULT ') + 7));
}

/** Prohlížeč s přihlášeným hráčem (JWT cookie) a volitelnou polohou. */
export async function open({ token, scale = 2, rate = 1, geo }) {
  const browser = await puppeteer.launch({
    headless: true,
    // screencast posílá snímky ve škálování okna, ne podle emulovaného DPR, proto vynucené
    args: [`--force-device-scale-factor=${scale}`, '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11',
      '--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
  });
  if (token) await browser.setCookie({ name: 'access_token', value: token, domain: 'localhost', path: '/', httpOnly: true });
  if (geo) await browser.defaultBrowserContext().overridePermissions(APP, ['geolocation']);
  const page = await browser.newPage();
  await page.setViewport({ ...SIZE, deviceScaleFactor: scale, isMobile: true, hasTouch: true });
  if (geo) await page.setGeolocation({ accuracy: 9, ...geo });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('zg-tip-map-seen', '1'); // bublina s tipem by zakryla mapu
    addEventListener('DOMContentLoaded', () => // dev indikátor Next.js do videa nepatří
      document.head.append(Object.assign(document.createElement('style'), { textContent: 'nextjs-portal{display:none!important}' })));
  });
  if (rate < 1) {
    await page.evaluateOnNewDocument((r) => {
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
    await cdp.send('Animation.setPlaybackRate', { playbackRate: rate });
  }
  return { browser, page, rate };
}

/** Plynulé posunutí stránky o `dy` px za `ms` (časem stránky, takže sedí i se zpomalením). */
export const scrollBy = (page, dy, ms) => page.evaluate((dy, ms) => new Promise((done) => {
  const y0 = scrollY, t0 = performance.now();
  const step = () => {
    const t = Math.min(1, (performance.now() - t0) / ms);
    scrollTo(0, y0 + dy * (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2));
    t < 1 ? requestAnimationFrame(step) : done();
  };
  requestAnimationFrame(step);
}), dy, ms);

/** Záznam obrazovky. `mark` ukládá události, `stop` složí MP4 a JSON s časy v sekundách videa. */
export async function record({ page, rate }, name) {
  const dir = path.join(OUT, `frames-${name}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const frames = [], events = [];
  let stopped = false;
  const cdp = await page.createCDPSession();
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    if (stopped) return; // snímky, které dorazí po zastavení
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    const file = path.join(dir, `${String(frames.length).padStart(5, '0')}.jpg`);
    frames.push({ file, t: metadata.timestamp });
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
  return {
    mark(ev, extra = {}) { events.push({ name: ev, t: Date.now() / 1000, ...extra }); console.log('·', name, ev); },
    async tap(selector, ev) {
      const el = await page.waitForSelector(selector, { timeout: 60000 });
      const box = await el.boundingBox();
      await el.tap();
      this.mark(ev, { x: (box.x + box.width / 2) / SIZE.width, y: (box.y + box.height / 2) / SIZE.height });
    },
    async stop() {
      stopped = true;
      const end = Date.now() / 1000; // statická stránka neposílá snímky, poslední musí vydržet až sem
      await cdp.send('Page.stopScreencast');
      const start = frames[0].t;
      const list = ['ffconcat version 1.0', ...frames.flatMap((x, i) => [
        `file '${path.basename(x.file)}'`, `duration ${(((frames[i + 1]?.t ?? end) - x.t) * rate).toFixed(4)}`])];
      list.push(`file '${path.basename(frames.at(-1).file)}'`);
      fs.writeFileSync(path.join(dir, 'list.txt'), list.join('\n'));
      execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'),
        '-fps_mode', 'cfr', '-r', '30', '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', path.join(OUT, `${name}.mp4`)]);
      const meta = {
        file: `rec/${name}.mp4`, fps: +(frames.length / (frames.at(-1).t - start) / rate).toFixed(1),
        events: events.map((e) => ({ ...e, t: +((e.t - start) * rate).toFixed(3) })),
      };
      fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(meta, null, 1));
      fs.rmSync(dir, { recursive: true });
      console.log('hotovo', name, meta.fps, 'fps');
      return meta;
    },
  };
}
