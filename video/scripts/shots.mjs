/**
 * Screenshoty aplikace a SVG komponent pro prezentaci (../prezentace) nad demo světem (scripts/world_setup.py).
 *   node scripts/shots.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { APP, backend, open, sleep } from './rec.mjs';

const OUT = '../prezentace/shots';
fs.mkdirSync(OUT, { recursive: true });
const world = backend('scripts/world_setup.py');

// souboj: snímek ze záznamu skutečného souboje Bára × Kuba (record-battle.mjs), Ohnivá střela z hradeb
execFileSync('node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe',
  ['-loglevel', 'error', '-y', '-ss', '14', '-i', 'public/rec/battle-a-hd.mp4', '-frames:v', '1', `${OUT}/battle-arena.png`]);

/** Obrazovka telefonu; `scrollTo` = text nadpisu, na který se posune. */
async function shot(s, name, url, { wait, scrollTo, before } = {}) {
  const { page } = s;
  await page.goto(`${APP}${url}`, { waitUntil: 'networkidle0' });
  if (wait) await page.locator(wait).setTimeout(60000).wait();
  if (before) await before(page);
  if (scrollTo) await page.evaluate((t) => {
    const h = [...document.querySelectorAll('h1,h2')].find((x) => x.textContent.trim() === t);
    scrollTo(0, h.getBoundingClientRect().top + scrollY - 80);
  }, scrollTo);
  await sleep(1800); // dlaždice mapy, animace razítek
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('·', name);
}

const bara = await open({ token: world.bara, scale: 3, geo: { latitude: 50.1866, longitude: 12.7425 } });
await shot(bara, 'map', '/map', { wait: '[aria-label^="Mapa míst"]' });
await shot(bara, 'place', '/place/12', { wait: 'h1' });
await shot(bara, 'pass', '/pass', { wait: 'li a[aria-label*="orazítkováno"]' });
await shot(bara, 'pass-badges', '/pass', { wait: 'li a[aria-label*="orazítkováno"]', scrollTo: 'Odznaky' });
await shot(bara, 'pass-quests', '/pass', { wait: 'li a[aria-label*="orazítkováno"]', scrollTo: 'Úkoly' });
await shot(bara, 'pets', '/pets', { wait: '::-p-text(Tvorové)' });
await shot(bara, 'insights', '/insights', { wait: '::-p-text(razítek)' });
await shot(bara, 'insights-open', '/insights', { wait: '::-p-text(razítek)', scrollTo: 'Kam ještě nikdo nedošel' });
await shot(bara, 'leaderboard', '/leaderboard', {
  wait: 'ol li', before: (p) => p.locator('button[role="tab"]::-p-text(Školy)').click(),
});
await shot(bara, 'battle', '/battle', { wait: 'h1' });

// SVG komponenty z úvodní stránky: průvodci, krajina (barvy zůstávají jako CSS proměnné) a ikony kategorií
const { page } = bara;
await page.goto(APP, { waitUntil: 'networkidle0' });
await page.waitForSelector('#co ~ ul li svg');
const svgs = await page.evaluate(() => {
  const clean = (svg) => { const c = svg.cloneNode(true); c.removeAttribute('class'); c.removeAttribute('style'); return c.outerHTML; };
  const guide = (n) => clean(document.querySelector(`svg[aria-label^="${n},"]`));
  const icons = Object.fromEntries([...document.querySelectorAll('#co ~ ul li')].map((li) => [li.textContent.replace(/\d+$/, '').trim(), clean(li.querySelector('svg'))]));
  return { boza: guide('Bóža'), vridla: guide('Vřídla'), kukadlo: guide('Kukadlo'), landscape: clean(document.querySelector('section svg')), icons: JSON.stringify(icons, null, 1) };
});
await page.goto(`${APP}/place/12`, { waitUntil: 'networkidle0' });
const icons = JSON.parse(svgs.icons);
icons.Autobus = await page.evaluate(() => { // ikona u nejbližší zastávky
  const el = [...document.querySelectorAll('svg')].find((x) => x.parentElement.textContent.includes('Autobus staví')).cloneNode(true);
  el.removeAttribute('class');
  return el.outerHTML;
});
svgs.icons = JSON.stringify(icons, null, 1);
for (const [k, v] of Object.entries(svgs)) fs.writeFileSync(`${OUT}/${k}.${k === 'icons' ? 'json' : 'svg'}`, v);
await bara.browser.close();
console.log('hotovo');
