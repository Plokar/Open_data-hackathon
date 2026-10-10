import {
  Castle, Cookie, Croissant, Droplet, Droplets, Flame, Ghost, Hexagon, Info, Landmark, Orbit, Pickaxe, Snail, Sprout,
  TowerControl, Trees, TrendingDown, type LucideIcon,
} from 'lucide-react';
import type { Category, MoveInfo, PetType, Rarity, StatusId } from './api';

export const CATEGORY: Record<Category, { label: string; color: string; Icon: LucideIcon }> = {
  castle: { label: 'Hrady a zámky', color: '#b45309', Icon: Castle },
  lookout: { label: 'Rozhledny', color: '#2f6fa8', Icon: TowerControl },
  spring: { label: 'Prameny', color: '#0d8a8a', Icon: Droplet },
  culture: { label: 'Kultura', color: '#7a3e6b', Icon: Landmark },
  nature: { label: 'Příroda', color: '#2e8a4e', Icon: Trees },
  heritage: { label: 'Technické a archeologické', color: '#6b5e4e', Icon: Pickaxe },
  food: { label: 'Dobroty kraje', color: '#b83a5e', Icon: Croissant },
  info: { label: 'Infocentra', color: '#56646c', Icon: Info },
};

export const PET_TYPE: Record<PetType, { label: string; color: string }> = {
  fortress: { label: 'Pevnost', color: '#b45309' },
  view: { label: 'Výhled', color: '#0284c7' },
  nature: { label: 'Příroda', color: '#16a34a' },
  spring: { label: 'Pramen', color: '#0d9488' },
  culture: { label: 'Kultura', color: '#7c3aed' },
  taste: { label: 'Chuť', color: '#db2777' },
};

/** Stavy v souboji: název, koho (na koho platí kombo), co dělá. Čísla zrcadlí apps/battles/engine.py. */
export const STATUS: Record<StatusId, { label: string; whom: string; text: string; color: string; Icon: LucideIcon }> = {
  burn: { label: 'Hoří', whom: 'hořícího', text: 'na konci každého tahu ztratí 6 % života', color: '#ea580c', Icon: Flame },
  wet: { label: 'Promočený', whom: 'promočeného', text: 'blesk ho zasáhne silněji a nemůže hořet', color: '#0284c7', Icon: Droplets },
  root: { label: 'Spoutaný', whom: 'spoutaného', text: 'nemůže se krýt, Obrana se mu změní v Útok', color: '#16a34a', Icon: Sprout },
  weak: { label: 'Oslabený', whom: 'oslabeného', text: 'útočí a kouzlí slaběji (×0,7)', color: '#64748b', Icon: TrendingDown },
  slow: { label: 'Zpomalený', whom: 'zpomaleného', text: 'má poloviční rychlost, jedná až po ostatních', color: '#4f46e5', Icon: Snail },
  curse: { label: 'Prokletý', whom: 'prokletého', text: 'léčení mu dá jen polovinu', color: '#7c3aed', Icon: Ghost },
  daze: { label: 'Omámený', whom: 'omámeného', text: 'v 35 % případů mu tah nevyjde', color: '#c026d3', Icon: Orbit },
  sticky: { label: 'Zalepený', whom: 'zalepeného', text: 'výdrž se mu neobnovuje', color: '#ca8a04', Icon: Hexagon },
  fed: { label: 'Sytý', whom: 'sytého', text: 'útočí a kouzlí silněji (×1,3)', color: '#db2777', Icon: Cookie },
};

/** Zrcadlo engine.BEATS: živel kouzla dává 1,5× proti typu, který poráží, a 0,75× proti tomu, kdo poráží jeho. */
export const BEATS: Partial<Record<PetType, PetType>> = { fortress: 'view', view: 'nature', nature: 'spring', spring: 'culture', culture: 'fortress' };
export const typeMult = (elem: PetType | null | undefined, target: PetType) =>
  !elem ? 1 : BEATS[elem] === target ? 1.5 : BEATS[target] === elem ? 0.75 : 1;
export const fmtMult = (x: number) => `×${String(Math.round(x * 100) / 100).replace('.', ',')}`;

/** Kombo: tah trefí cíl v tomto stavu silněji (blesk promočeného, prales spoutaného, chorál za neduhy). */
export function comboOn(m: MoveInfo, status: Partial<Record<StatusId, number>> = {}) {
  const has = Object.keys(status) as StatusId[];
  return has.some((k) => m.vs?.[k]) || (!!m.per_status && has.some((k) => k !== 'fed'));
}

/** Krátké štítky toho, čím je tah zvláštní (tlačítko v souboji, karta tvora). */
export function moveTags(m: MoveInfo): string[] {
  const t: string[] = [];
  if (m.status) t.push(STATUS[m.status[0]].label);
  if (m.self_status) t.push(STATUS[m.self_status[0]].label);
  if (m.break) t.push('Prorazí Obranu');
  if (m.solid) t.push('Nejde prorazit');
  if (m.pierce) t.push('Ignoruje obranu');
  if (m.first) t.push('Jde první');
  if (m.sap) t.push(`Ubere ${m.sap} výdrže`);
  if (m.hits) t.push(`${m.hits} zásahy`);
  if (m.aoe) t.push('Všichni soupeři');
  for (const [k, x] of Object.entries(m.vs ?? {})) t.push(`${fmtMult(x!)} na ${STATUS[k as StatusId].whom}`);
  if (m.per_status) t.push('Sílí s neduhy');
  if (m.cleanse) t.push('Očistí');
  if (m.drain) t.push('Vysává');
  return t;
}

/** `color` = pozadí karty tvora (míchá se s var(--card), takže funguje ve světlém i tmavém režimu). */
export const RARITY: Record<Rarity, { label: string; className: string; color: string }> = {
  common: { label: 'Běžný', className: 'bg-muted text-muted-foreground', color: '#94a3b8' },
  rare: { label: 'Vzácný', className: 'bg-trail-blue/15 text-trail-blue', color: 'var(--trail-blue)' },
  epic: { label: 'Epický', className: 'bg-[#7a3e6b]/15 text-[#7a3e6b] dark:text-[#d9a3c9]', color: '#a855f7' },
  legendary: { label: 'Legendární', className: 'bg-trail-yellow/30 text-[#6e5108] dark:text-trail-yellow', color: 'var(--trail-yellow)' },
};

/** Pozadí tvora podle rarity: barva rarity nahoře, dole do karty. */
export const rarityBg = (r: Rarity, strength = 24) =>
  `linear-gradient(to bottom, color-mix(in oklab, ${RARITY[r].color} ${strength}%, var(--card)), var(--card) 85%)`;

export const BADGE_XP = 100; // stejně jako badges.BADGE_XP na serveru

export function formatDistance(m: number | null | undefined) {
  if (m == null) return '–';
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

/** Vzdušná vzdálenost v metrech (jen pro zobrazení; ověřuje server). */
export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(a)));
}

/** Poloha pro výzvu bosse a připojení k partě (server ověří do 300 m od místa). */
export async function positionPayload(demo = false) {
  const pos = await position();
  return { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy, client_ts: Date.now(), ...(demo ? { demo: true } : {}) };
}

/**
 * Hrubá poloha (~1 km) pro počasí a místo dne. Jen když hráč už polohu povolil: stránka s úkoly se nemá ptát sama.
 * Jinak null a server vezme poslední razítko.
 */
export async function coarsePosition(): Promise<{ lat: number; lon: number } | null> {
  try {
    if ((await navigator.permissions?.query({ name: 'geolocation' }))?.state !== 'granted') return null;
    const pos = await new Promise<GeolocationPosition>((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: false, maximumAge: 30 * 60_000, timeout: 5000 }));
    return { lat: +pos.coords.latitude.toFixed(2), lon: +pos.coords.longitude.toFixed(2) };
  } catch {
    return null;
  }
}

/** Přesná poloha pro razítko a výzvu bosse (ověřuje server). */
export function position(): Promise<GeolocationPosition> {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('Prohlížeč neumí zjistit polohu.'));
    navigator.geolocation.getCurrentPosition(res, () => rej(new Error('Povol přístup k poloze (a použij HTTPS).')), {
      enableHighAccuracy: true, timeout: 20000, maximumAge: 0,
    });
  });
}
