import type { Category, PetType, Rarity } from './api';

export const CATEGORY: Record<Category, { label: string; color: string; icon: string }> = {
  castle: { label: 'Hrady a zámky', color: '#b45309', icon: '🏰' },
  lookout: { label: 'Rozhledny', color: '#0284c7', icon: '🗼' },
  spring: { label: 'Prameny', color: '#0d9488', icon: '💧' },
  culture: { label: 'Kultura', color: '#7c3aed', icon: '🏛️' },
  nature: { label: 'Příroda', color: '#16a34a', icon: '🌲' },
  heritage: { label: 'Technické a archeologické', color: '#57534e', icon: '⛏️' },
  food: { label: 'Dobroty kraje', color: '#db2777', icon: '🥨' },
  info: { label: 'Infocentra', color: '#64748b', icon: 'ℹ️' },
};

export const PET_TYPE: Record<PetType, { label: string; color: string }> = {
  fortress: { label: 'Pevnost', color: '#b45309' },
  view: { label: 'Výhled', color: '#0284c7' },
  nature: { label: 'Příroda', color: '#16a34a' },
  spring: { label: 'Pramen', color: '#0d9488' },
  culture: { label: 'Kultura', color: '#7c3aed' },
  taste: { label: 'Chuť', color: '#db2777' },
};

export const RARITY: Record<Rarity, { label: string; className: string }> = {
  common: { label: 'Běžný', className: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300' },
  rare: { label: 'Vzácný', className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  epic: { label: 'Epický', className: 'bg-violet-500/15 text-violet-700 dark:text-violet-300' },
  legendary: { label: 'Legendární', className: 'bg-amber-500/20 text-amber-700 dark:text-amber-300' },
};

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
