/**
 * Procedurální generátor tvorů. Ze (seed, typ, stupeň evoluce, rarita) složí SVG:
 * stavba těla, hlava, hřebínek podle typu, uši, ocas, křídla, vzor, oči, stínování a záře rarity.
 * Stejný vstup = vždy stejný tvor. Výstup je samostatné SVG (data URL), takže jde do <img> i do Pixi textury.
 */
import type { PetType, Rarity } from './api';

export interface PetLook {
  type: PetType;
  seed: number;
  stage?: number;
  rarity?: Rarity;
  back?: boolean; // pohled zezadu (tvůj tvor v aréně)
  shadow?: boolean;
}

const TYPE_LOOK: Record<PetType, { hue: number; accent: string; glow: string }> = {
  fortress: { hue: 28, accent: '#9aa0ab', glow: '#ff7a1a' },
  view: { hue: 205, accent: '#fde68a', glow: '#fff36b' },
  nature: { hue: 135, accent: '#84cc16', glow: '#a3ff5c' },
  spring: { hue: 182, accent: '#67e8f9', glow: '#5ce1ff' },
  culture: { hue: 268, accent: '#facc15', glow: '#d58bff' },
  taste: { hue: 335, accent: '#f59e0b', glow: '#ffb347' },
};
export const ELEMENT_GLOW = Object.fromEntries(Object.entries(TYPE_LOOK).map(([k, v]) => [k, v.glow])) as Record<PetType, string>;

/** mulberry32 nad hashem seedu (seed z backendu může přesáhnout 2^53, proto přes string). */
function rng(seed: number, salt: number) {
  let h = 1779033703 ^ salt;
  for (const ch of String(seed)) {
    h = Math.imul(h ^ ch.charCodeAt(0), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Elipsa z Bézierů s nezávislou horní/dolní výškou a plošším spodkem: měkčí „plyšový“ tvar. */
function blob(cx: number, cy: number, rx: number, top: number, bottom: number) {
  const k = 0.56, kb = 0.72;
  return `M${cx - rx},${cy}C${cx - rx},${cy - k * top} ${cx - k * rx},${cy - top} ${cx},${cy - top}` +
    `C${cx + k * rx},${cy - top} ${cx + rx},${cy - k * top} ${cx + rx},${cy}` +
    `C${cx + rx},${cy + kb * bottom} ${cx + kb * rx},${cy + bottom} ${cx},${cy + bottom}` +
    `C${cx - kb * rx},${cy + bottom} ${cx - rx},${cy + kb * bottom} ${cx - rx},${cy}Z`;
}

const star = (x: number, y: number, r: number, fill: string, op = 1) =>
  `<path d="M${x},${y - r}Q${x + r * 0.18},${y - r * 0.18} ${x + r},${y}Q${x + r * 0.18},${y + r * 0.18} ${x},${y + r}Q${x - r * 0.18},${y + r * 0.18} ${x - r},${y}Q${x - r * 0.18},${y - r * 0.18} ${x},${y - r}Z" fill="${fill}" opacity="${op}"/>`;

function crest(type: PetType, x: number, y: number, s: number, stage: number, c: Colors) {
  const t = (inner: string) => `<g transform="translate(${x} ${y}) scale(${s})">${inner}</g>`;
  const o = `stroke="${c.ink}" stroke-width="2.4" stroke-linejoin="round"`;
  switch (type) {
    case 'fortress':
      return t(`<path d="M-22,4V-14h8v6h6v-6h8v6h6v-6h8V4Z" fill="${c.accent}" ${o}/>
        <path d="M-22,-2h44" stroke="#0003" stroke-width="3"/>` +
        (stage >= 3 ? `<path d="M0,-14V-38" ${o}/><path d="M0,-38l16,5-16,6Z" fill="${c.glow}" ${o}/>` : '') +
        (stage >= 2 ? `<rect x="-4" y="-6" width="8" height="10" rx="4" fill="${c.ink}"/>` : ''));
    case 'view':
      return t([-1, 0, 1].slice(0, stage >= 2 ? 3 : 2).map((i, k, a) => {
        const ang = (a.length === 2 ? [-14, 14][k] : i * 24);
        return `<path transform="rotate(${ang})" d="M0,2C-9,-12 -6,-30 0,-${34 + stage * 4}C6,-30 9,-12 0,2Z" fill="${k % 2 ? c.light : c.accent}" ${o}/>`;
      }).join('') + (stage >= 3 ? star(0, -50, 9, c.glow) : ''));
    case 'nature':
      return t(`<path d="M0,2C-4,-10 -20,-18 -26,-10C-20,-2 -8,2 0,2Z" fill="${c.accent}" ${o}/>
        <path d="M0,2C4,-14 20,-24 28,-16C22,-6 8,0 0,2Z" fill="#65a30d" ${o}/>` +
        (stage >= 2 ? `<circle cx="0" cy="-8" r="7" fill="#f472b6" ${o}/><circle cx="0" cy="-8" r="2.8" fill="#fde047"/>` : '') +
        (stage >= 3 ? `<path d="M-6,-12C-14,-34 -2,-44 0,-50C2,-44 14,-34 6,-12Z" fill="${c.glow}" ${o}/>` : ''));
    case 'spring':
      return t(`<path d="M0,-${30 + stage * 5}C10,-18 14,-10 14,-4A14,14 0 0 1 -14,-4C-14,-10 -10,-18 0,-${30 + stage * 5}Z" fill="${c.accent}" ${o}/>
        <ellipse cx="-5" cy="-10" rx="3" ry="5" fill="#fff" opacity=".8"/>` +
        (stage >= 3 ? `<circle cx="18" cy="-26" r="5" fill="${c.glow}" ${o}/><circle cx="-19" cy="-30" r="3.5" fill="${c.glow}" ${o}/>` : ''));
    case 'culture':
      return t(stage === 1
        ? `<path d="M0,-22L10,-8 0,4 -10,-8Z" fill="${c.accent}" ${o}/>`
        : `<path d="M-24,4L-20,-20 -10,-8 0,-28 10,-8 20,-20 24,4Z" fill="${c.accent}" ${o}/>
           <path d="M0,-12L5,-5 0,2 -5,-5Z" fill="${c.glow}"/>` +
          (stage >= 3 ? `<ellipse cx="0" cy="-38" rx="26" ry="7" fill="none" stroke="${c.glow}" stroke-width="3.5"/>` : ''));
    case 'taste':
      return t(`<path d="M-20,2C-26,-8 -12,-14 -10,-10C-14,-22 6,-26 6,-14C14,-20 26,-8 18,2Z" fill="#fff7ed" ${o}/>
        <path d="M-12,-6q8,-4 18,0" stroke="${c.light}" stroke-width="3" fill="none"/>` +
        (stage >= 2 ? `<path d="M2,-22q2,-10 9,-14" stroke="${c.ink}" stroke-width="2.4" fill="none"/><circle cx="2" cy="-21" r="6.5" fill="#dc2626" ${o}/>` : '') +
        (stage >= 3 ? star(-14, -26, 7, c.glow) : ''));
  }
}

interface Colors { base: string; dark: string; light: string; belly: string; ink: string; accent: string; glow: string; cheek: string }

export function petSvg({ type, seed, stage = 1, rarity = 'common', back = false, shadow = true }: PetLook): string {
  const r = rng(seed, stage * 7 + 1);
  const L = TYPE_LOOK[type];
  const hue = (L.hue + Math.round((r() - 0.5) * 28) + 360) % 360;
  const sat = 52 + Math.round(r() * 16);
  const c: Colors = {
    base: `hsl(${hue} ${sat}% 56%)`, dark: `hsl(${hue} ${sat}% 34%)`, light: `hsl(${hue} ${sat + 10}% 78%)`,
    belly: `hsl(${(hue + 25) % 360} 70% 90%)`, ink: `hsl(${hue} 45% 16%)`, accent: L.accent, glow: L.glow,
    cheek: `hsl(${(hue + 330) % 360} 85% 72%)`,
  };
  // Stavba těla a doplňky se losují jednou pro tvora (salt bez stupně), aby evoluce zůstala „tím samým“ tvorem.
  const f = rng(seed, 99);
  const plan = (['blob', 'bean', 'headed', 'quad'] as const)[Math.floor(f() * 4)];
  const ears = (['cat', 'round', 'long', 'none'] as const)[Math.floor(f() * 4)];
  const pattern = (['spots', 'stripes', 'plain', 'mask'] as const)[Math.floor(f() * 4)];
  const mouth = (['smile', 'fang', 'open'] as const)[Math.floor(f() * 3)];
  const sc = [0.74, 0.88, 1][stage - 1] ?? 1;

  // Geometrie (v souřadnicích před škálováním, zem je y=182)
  const G = 182;
  const body = plan === 'blob' ? { cx: 100, cy: 128, rx: 50, top: 50, bottom: 50 }
    : plan === 'bean' ? { cx: 100, cy: 122, rx: 40, top: 58, bottom: 56 }
    : plan === 'headed' ? { cx: 100, cy: 146, rx: 48, top: 34, bottom: 32 }
    : { cx: 100, cy: 146, rx: 60, top: 30, bottom: 28 };
  const headed = plan === 'headed' || plan === 'quad';
  const head = headed ? { cx: 100, cy: 98, rx: plan === 'quad' ? 38 : 36, top: 36, bottom: 32 } : body;
  const faceY = headed ? head.cy + 4 : body.cy - 8;
  const topY = head.cy - head.top;

  const out: string[] = [];
  const defs = `<defs>
    <radialGradient id="g" cx="36%" cy="28%" r="80%"><stop offset="0" stop-color="${c.light}"/><stop offset=".45" stop-color="${c.base}"/><stop offset="1" stop-color="${c.dark}"/></radialGradient>
    <radialGradient id="gb" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${c.belly}"/></radialGradient>
    <radialGradient id="aura"><stop offset="0" stop-color="${c.glow}" stop-opacity=".55"/><stop offset=".6" stop-color="${c.glow}" stop-opacity=".18"/><stop offset="1" stop-color="${c.glow}" stop-opacity="0"/></radialGradient>
    <radialGradient id="eye" cx="40%" cy="35%"><stop offset="0" stop-color="${stage >= 3 ? c.glow : '#3b3b4f'}"/><stop offset="1" stop-color="${stage >= 3 ? c.dark : '#0b0b14'}"/></radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
    <clipPath id="clipBody"><path d="${blob(body.cx, body.cy, body.rx, body.top, body.bottom)}"/></clipPath>
    <clipPath id="clipHead"><path d="${blob(head.cx, head.cy, head.rx, head.top, head.bottom)}"/></clipPath>
  </defs>`;

  if (shadow) out.push(`<ellipse cx="100" cy="${G + 4}" rx="${54 * sc}" ry="${8 * sc}" fill="#000" opacity=".22"/>`);
  // Aura: legendární a 3. stupeň
  if (rarity === 'legendary' || stage >= 3) out.push(`<circle cx="100" cy="${G - 70 * sc}" r="${92 * sc}" fill="url(#aura)"/>`);
  const haloY = Math.max(14, G + (topY - 40 - stage * 6 - G) * sc);
  if (rarity === 'legendary') out.push(`<ellipse cx="100" cy="${haloY}" rx="${30 * sc}" ry="${7 * sc}" fill="none" stroke="#fcd34d" stroke-width="4" opacity=".9" filter="url(#glow)"/><ellipse cx="100" cy="${haloY}" rx="${30 * sc}" ry="${7 * sc}" fill="none" stroke="#fde68a" stroke-width="2.5"/>`);

  const parts: string[] = [];
  const o = `stroke="${c.ink}" stroke-width="3" stroke-linejoin="round"`;

  // Křídla: Výhled od 2. stupně, všichni ve 3.
  const wings = stage >= 3 || (type === 'view' && stage >= 2);
  const wing = (dir: 1 | -1) => {
    const x = body.cx + dir * body.rx * 0.6, y = body.cy - body.top * 0.5;
    const span = 38 + stage * 6;
    return `<path d="M${x},${y}C${x + dir * span * 0.6},${y - span} ${x + dir * span * 1.2},${y - span * 0.6} ${x + dir * span},${y + 4}
      C${x + dir * span * 0.8},${y - 4} ${x + dir * span * 0.7},${y + 10} ${x + dir * span * 0.5},${y + 8}
      C${x + dir * span * 0.4},${y + 2} ${x + dir * span * 0.25},${y + 16} ${x},${y + 14}Z" fill="${c.light}" ${o} opacity=".95"/>
      <path d="M${x + dir * 6},${y + 4}C${x + dir * span * 0.5},${y - span * 0.55} ${x + dir * span * 0.8},${y - span * 0.4} ${x + dir * span * 0.9},${y - 2}" stroke="${c.glow}" stroke-width="2.5" fill="none" opacity=".8"/>`;
  };

  // Ocas podle typu
  const tail = () => {
    const x = back ? body.cx + 6 : body.cx + body.rx * 0.75, y = back ? body.cy + body.bottom * 0.55 : body.cy + body.bottom * 0.35;
    const s = 0.8 + stage * 0.2;
    const tt = (inner: string) => `<g transform="translate(${x} ${y}) scale(${back ? -s : s} ${s})">${inner}</g>`;
    switch (type) {
      case 'fortress': return tt(`<path d="M0,0C14,-2 22,-12 26,-22" stroke="${c.dark}" stroke-width="9" stroke-linecap="round" fill="none"/><circle cx="28" cy="-26" r="11" fill="${c.accent}" ${o}/>`);
      case 'view': return tt(`<path d="M0,0C16,-6 30,-26 36,-40C28,-30 14,-26 6,-22Z" fill="${c.light}" ${o}/>`);
      case 'nature': return tt(`<path d="M0,0C10,-10 24,-14 30,-30C34,-18 28,-2 12,4Z" fill="${c.accent}" ${o}/><path d="M6,-2C14,-8 22,-14 28,-26" stroke="#3f6212" stroke-width="2" fill="none"/>`);
      case 'spring': return tt(`<path d="M0,0C14,-4 20,-18 34,-20C30,-10 34,4 24,6C16,8 8,6 0,4Z" fill="${c.accent}" ${o}/>`);
      case 'culture': return tt(`<path d="M0,0C12,-2 16,-20 30,-22C22,-14 30,-4 20,2" stroke="${c.glow}" stroke-width="6" stroke-linecap="round" fill="none"/>`);
      case 'taste': return tt(`<path d="M0,0C16,-2 24,-14 18,-24C12,-32 0,-22 8,-16" stroke="${c.dark}" stroke-width="8" stroke-linecap="round" fill="none"/>`);
    }
  };

  const ear = (dir: 1 | -1) => {
    const x = head.cx + dir * head.rx * 0.62, y = head.cy - head.top * 0.72;
    if (ears === 'cat') return `<path d="M${x - dir * 14},${y + 8}L${x + dir * 8},${y - 26}L${x + dir * 16},${y + 6}Z" fill="${c.base}" ${o}/><path d="M${x - dir * 6},${y + 4}L${x + dir * 7},${y - 15}L${x + dir * 10},${y + 3}Z" fill="${c.cheek}"/>`;
    if (ears === 'round') return `<circle cx="${x + dir * 4}" cy="${y - 6}" r="14" fill="${c.base}" ${o}/><circle cx="${x + dir * 4}" cy="${y - 6}" r="7" fill="${c.cheek}"/>`;
    if (ears === 'long') return `<ellipse transform="rotate(${dir * 18} ${x} ${y})" cx="${x}" cy="${y - 22}" rx="10" ry="28" fill="${c.base}" ${o}/><ellipse transform="rotate(${dir * 18} ${x} ${y})" cx="${x}" cy="${y - 20}" rx="4.5" ry="19" fill="${c.cheek}"/>`;
    return '';
  };

  const legs = () => {
    const y = G - 8;
    const foot = (x: number) => `<ellipse cx="${x}" cy="${y}" rx="15" ry="10" fill="${c.dark}" ${o}/>`;
    if (plan === 'quad') return foot(62) + foot(138) + foot(82) + foot(118);
    return foot(body.cx - body.rx * 0.5) + foot(body.cx + body.rx * 0.5);
  };

  const patternOn = (clip: string, b: typeof body) => {
    const p = rng(seed, 7);
    if (pattern === 'spots') return `<g clip-path="url(#${clip})">${Array.from({ length: 5 }, () =>
      `<circle cx="${b.cx + (p() - 0.5) * b.rx * 1.8}" cy="${b.cy + (p() - 0.6) * b.top * 1.4}" r="${4 + p() * 7}" fill="${c.dark}" opacity=".35"/>`).join('')}</g>`;
    if (pattern === 'stripes') return `<g clip-path="url(#${clip})" opacity=".35">${[0, 1, 2].map((i) =>
      `<path d="M${b.cx - 14 + i * 14},${b.cy - b.top - 2}q${i === 1 ? 0 : (i - 1) * 6},16 0,${b.top * 0.5}" stroke="${c.dark}" stroke-width="6" stroke-linecap="round" fill="none"/>`).join('')}</g>`;
    return '';
  };

  if (wings && !back) parts.push(wing(-1), wing(1));
  if (!back) parts.push(tail());
  if (headed) parts.push(ear(-1), ear(1));
  parts.push(legs());
  // Tělo + stínování + břicho
  parts.push(`<path d="${blob(body.cx, body.cy, body.rx, body.top, body.bottom)}" fill="url(#g)" ${o}/>`);
  if (!back) parts.push(`<g clip-path="url(#clipBody)"><ellipse cx="${body.cx}" cy="${body.cy + body.bottom * 0.45}" rx="${body.rx * 0.62}" ry="${body.bottom * 0.75}" fill="url(#gb)" opacity=".95"/></g>`);
  parts.push(patternOn('clipBody', body));
  parts.push(`<g clip-path="url(#clipBody)"><ellipse cx="${body.cx + body.rx * 0.3}" cy="${body.cy + body.bottom}" rx="${body.rx}" ry="${body.bottom * 0.45}" fill="#000" opacity=".16"/></g>`);
  // Ručky
  const armY = headed ? body.cy - 4 : body.cy + 10;
  parts.push(`<ellipse cx="${body.cx - body.rx + 4}" cy="${armY}" rx="9" ry="13" transform="rotate(25 ${body.cx - body.rx + 4} ${armY})" fill="${c.base}" ${o}/>`,
    `<ellipse cx="${body.cx + body.rx - 4}" cy="${armY}" rx="9" ry="13" transform="rotate(-25 ${body.cx + body.rx - 4} ${armY})" fill="${c.base}" ${o}/>`);
  if (headed) {
    parts.push(`<path d="${blob(head.cx, head.cy, head.rx, head.top, head.bottom)}" fill="url(#g)" ${o}/>`);
    parts.push(patternOn('clipHead', head));
  } else {
    parts.push(ear(-1), ear(1));
  }
  // Lesk
  parts.push(`<ellipse cx="${head.cx - head.rx * 0.38}" cy="${head.cy - head.top * 0.55}" rx="${head.rx * 0.28}" ry="${head.top * 0.16}" transform="rotate(-25 ${head.cx - head.rx * 0.38} ${head.cy - head.top * 0.55})" fill="#fff" opacity=".45"/>`);
  if (pattern === 'mask' && !back) parts.push(`<g clip-path="url(#${headed ? 'clipHead' : 'clipBody'})"><ellipse cx="${head.cx}" cy="${faceY - 2}" rx="${head.rx * 0.8}" ry="13" fill="${c.dark}" opacity=".4"/></g>`);
  // Runy 3. stupně
  if (stage >= 3) parts.push(`<g filter="url(#glow)">${star(body.cx, body.cy + (back ? -6 : 18), 8, c.glow)}</g>`, star(body.cx, body.cy + (back ? -6 : 18), 6, '#fff', 0.9));

  // Obličej
  if (!back) {
    const ex = Math.min(head.rx * 0.42, 17) + (stage - 1) * 1.5;
    const er = [11, 9.5, 9][stage - 1] ?? 9;
    for (const d of [-1, 1]) {
      const x = head.cx + d * ex;
      parts.push(`<ellipse cx="${x}" cy="${faceY}" rx="${er * 0.85}" ry="${er}" fill="url(#eye)"/>`);
      if (stage >= 3) parts.push(`<ellipse cx="${x}" cy="${faceY}" rx="1.8" ry="${er * 0.6}" fill="#111"/>`);
      parts.push(`<circle cx="${x - er * 0.3}" cy="${faceY - er * 0.35}" r="${er * 0.32}" fill="#fff"/><circle cx="${x + er * 0.3}" cy="${faceY + er * 0.35}" r="${er * 0.14}" fill="#fff" opacity=".8"/>`);
      if (stage >= 2) parts.push(`<path d="M${x - d * 10},${faceY - er - 6}L${x + d * 8},${faceY - er - 2}" stroke="${c.ink}" stroke-width="3.5" stroke-linecap="round"/>`);
      parts.push(`<ellipse cx="${x + d * 9}" cy="${faceY + er + 3}" rx="6" ry="3.5" fill="${c.cheek}" opacity=".7"/>`);
    }
    const my = faceY + er + 6;
    if (mouth === 'smile') parts.push(`<path d="M${head.cx - 7},${my}q7,7 14,0" stroke="${c.ink}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`);
    if (mouth === 'fang') parts.push(`<path d="M${head.cx - 8},${my}q8,6 16,0" stroke="${c.ink}" stroke-width="2.8" fill="none" stroke-linecap="round"/><path d="M${head.cx + 3},${my + 2.5}l2,6 2,-5.5" fill="#fff" stroke="${c.ink}" stroke-width="1.5"/>`);
    if (mouth === 'open') parts.push(`<path d="M${head.cx - 7},${my - 1}q7,12 14,0Z" fill="#7f1d1d" stroke="${c.ink}" stroke-width="2.4" stroke-linejoin="round"/><ellipse cx="${head.cx}" cy="${my + 4}" rx="3.5" ry="2" fill="#f87171"/>`);
  }
  parts.push(crest(type, head.cx, topY + 4, 0.85 + stage * 0.15, stage, c));
  if (back) { parts.push(tail()); if (wings) parts.push(wing(-1), wing(1)); }

  out.push(`<g transform="translate(100 ${G}) scale(${sc}) translate(-100 -${G})">${parts.join('')}</g>`);

  // Třpytky rarity
  const sp = rng(seed, 3);
  const sparkles = { common: 0, rare: 2, epic: 3, legendary: 4 }[rarity];
  const sc2 = rarity === 'legendary' ? '#fde047' : rarity === 'epic' ? '#e9a8ff' : '#bae6fd';
  for (let i = 0; i < sparkles; i++) out.push(star(30 + sp() * 140, 30 + sp() * 90, 5 + sp() * 5, sc2, 0.95));
  if (rarity === 'epic') out.unshift(`<circle cx="100" cy="${G - 70 * sc}" r="${80 * sc}" fill="#c084fc" opacity=".18" filter="url(#glow)"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="400" height="400">${defs}${out.join('')}</svg>`;
}

const cache = new Map<string, string>();
/** Data URL pro <img> / Pixi; kešované, generování je čisté. */
export function petDataUrl(look: PetLook) {
  const key = JSON.stringify(look);
  let url = cache.get(key);
  if (!url) {
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(petSvg(look))}`;
    cache.set(key, url);
  }
  return url;
}
