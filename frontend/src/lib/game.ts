import { Castle, Croissant, Droplet, Info, Landmark, Pickaxe, TowerControl, Trees, type LucideIcon } from 'lucide-react';
import type { Category, PetType, Rarity } from './api';

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

export const RARITY: Record<Rarity, { label: string; className: string }> = {
  common: { label: 'Běžný', className: 'bg-muted text-muted-foreground' },
  rare: { label: 'Vzácný', className: 'bg-trail-blue/15 text-trail-blue' },
  epic: { label: 'Epický', className: 'bg-[#7a3e6b]/15 text-[#7a3e6b] dark:text-[#d9a3c9]' },
  legendary: { label: 'Legendární', className: 'bg-trail-yellow/30 text-[#6e5108] dark:text-trail-yellow' },
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
