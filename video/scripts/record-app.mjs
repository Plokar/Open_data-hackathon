/**
 * Záznamy aplikace pro scény 3, 4, 8 a 9 nad demo světem (scripts/world_setup.py).
 *   node scripts/record-app.mjs [map] [checkin] [pass] [leaderboard] [insights]   (bez argumentů vše)
 * Výstup: public/rec/<název>.mp4 + .json s časy událostí.
 */
import { APP, backend, open, record, scrollBy, sleep } from './rec.mjs';

const DIANA = { latitude: 50.218977, longitude: 12.872259 };
const want = process.argv.slice(2);
const run = (name) => !want.length || want.includes(name);

const world = backend('scripts/world_setup.py');
console.log('Bára razítek', world.bara_stamps, 'odznaky', world.bara_badges.join(','));

// 3) mapa: piny po kategoriích, přiblížení na Dianu, karta místa
if (run('map')) {
  const s = await open({ token: world.ema, rate: 0.5, geo: { latitude: 50.2291, longitude: 12.8561 } });
  const { page } = s;
  const w = (ms) => sleep(ms / s.rate); // čas videa
  await page.goto(`${APP}/map`, { waitUntil: 'networkidle0' });
  await page.locator('button::-p-text(Hrady a zámky)').click();
  await sleep(2500); // dlaždice a piny hradů
  const r = await record(s, 'map');
  await w(400);
  for (const label of ['Rozhledny', 'Prameny', 'Kultura', 'Příroda', 'Technické a archeologické', 'Dobroty kraje']) {
    await r.tap(`button[aria-pressed]::-p-text(${label})`, `cat_${label}`);
    await w(420);
  }
  await w(300);
  // Diana v pixelech: Leaflet začíná na [50.15, 12.7], zoom 9 (PlacesMap.tsx)
  const p = await page.evaluate(({ latitude, longitude }) => {
    const box = document.querySelector('[aria-label="Mapa míst Karlovarského kraje"]').getBoundingClientRect();
    const proj = (lat, lon) => {
      const s = 256 * 2 ** 9, sin = Math.sin((lat * Math.PI) / 180);
      return [((lon + 180) / 360) * s, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s];
    };
    const [cx, cy] = proj(50.15, 12.7), [x, y] = proj(latitude, longitude);
    return { x: box.left + box.width / 2 + x - cx, y: box.top + box.height / 2 + y - cy };
  }, DIANA);
  r.mark('zoom', { x: p.x / 412, y: p.y / 892 });
  await page.mouse.move(p.x, p.y);
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel({ deltaY: -110 });
    await w(330);
  }
  await w(500);
  await page.touchscreen.tap(p.x, p.y);
  r.mark('pin', { x: p.x / 412, y: p.y / 892 });
  await page.locator('::-p-text(od tebe)').setTimeout(10000).wait().catch(() => {});
  await w(2300);
  await r.stop();
  await s.browser.close();
}

// 4) razítko na Dianě: fotka, ověření polohy, výsledek
if (run('checkin')) {
  const s = await open({ token: world.ema, rate: 0.5, geo: { latitude: 50.2193, longitude: 12.8727 } });
  const { page } = s;
  const w = (ms) => sleep(ms / s.rate); // čas videa
  await page.goto(`${APP}/place/82`, { waitUntil: 'networkidle0' });
  const btn = await page.waitForSelector('button[aria-label="Vyfotit místo a získat razítko"]');
  await btn.evaluate((b) => b.scrollIntoView({ block: 'center' }));
  await sleep(1500);
  const r = await record(s, 'checkin');
  await w(600);
  const [chooser] = await Promise.all([page.waitForFileChooser(), r.tap('button[aria-label="Vyfotit místo a získat razítko"]', 'tap')]);
  await chooser.accept(['../backend/media/places/82.jpg']);
  r.mark('photo');
  await page.locator('::-p-text(Razítko je tvoje)').setTimeout(30000).wait();
  r.mark('stamp');
  await w(2500);
  await r.stop();
  await s.browser.close();
}

// 8) Pas: razítka, úkoly, odznaky
if (run('pass')) {
  const s = await open({ token: world.bara, rate: 0.5 });
  const { page } = s;
  const w = (ms) => sleep(ms / s.rate); // čas videa
  await page.goto(`${APP}/pass`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('li a[aria-label*="orazítkováno"]');
  await sleep(1500);
  const r = await record(s, 'pass');
  await w(1000);
  const top = (text) => page.evaluate((t) => [...document.querySelectorAll('h2')].find((h) => h.textContent === t).getBoundingClientRect().top + scrollY - 70, text);
  const quests = await top('Úkoly'), badges = await top('Odznaky');
  r.mark('stamps');
  await scrollBy(page, quests - 120, 1800);
  r.mark('quests');
  await w(900);
  await scrollBy(page, badges - quests + 120, 1800);
  r.mark('badges');
  await w(1600);
  await r.stop();
  await s.browser.close();
}

// 8) Žebříček: hráči, školy, týmy
if (run('leaderboard')) {
  const s = await open({ token: world.bara, rate: 0.5 });
  const { page } = s;
  const w = (ms) => sleep(ms / s.rate); // čas videa
  await page.goto(`${APP}/leaderboard`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('ol li');
  await sleep(1200);
  const r = await record(s, 'leaderboard');
  await w(800);
  await r.tap('button[role="tab"]::-p-text(Školy)', 'schools');
  await w(1500);
  await r.tap('button[role="tab"]::-p-text(Týmy)', 'teams');
  await w(1800);
  await r.stop();
  await s.browser.close();
}

// 9) Co hráči objevují: souhrn, mapa návštěvnosti, okresy, kategorie
if (run('insights')) {
  const s = await open({ token: world.bara, rate: 0.5 });
  const { page } = s;
  const w = (ms) => sleep(ms / s.rate); // čas videa
  await page.goto(`${APP}/insights`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('::-p-text(razítek)');
  await sleep(3000); // mapové dlaždice
  const r = await record(s, 'insights');
  await w(1500);
  r.mark('scroll');
  await scrollBy(page, 420, 2000);
  r.mark('bars');
  await w(1200);
  await scrollBy(page, 520, 2000);
  r.mark('lists');
  await w(1500);
  await r.stop();
  await s.browser.close();
}
