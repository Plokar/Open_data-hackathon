'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PlaceFeature } from '@/lib/api';
import { CATEGORY } from '@/lib/game';

interface Props {
  features: PlaceFeature[];
  stamped: Set<number>;
  onSelect: (f: PlaceFeature) => void;
  onLocate?: (lat: number, lon: number) => void;
  centerOnMe?: number; // změna hodnoty = vycentrovat na mou polohu
}

/** Poloha hráče: špendlík s turistickou značkou, ať se neplete s kolečky míst. Styly v globals.css (.me-*). */
const ME_ICON = L.divIcon({
  className: 'me-icon',
  iconSize: [36, 44],
  iconAnchor: [18, 43],
  html: `<span class="me-pulse"></span><svg viewBox="0 0 36 44" width="36" height="44" aria-hidden="true">
    <path d="M18 42.5S32.5 28.4 32.5 18a14.5 14.5 0 0 0-29 0C3.5 28.4 18 42.5 18 42.5z" fill="#1c2b22" stroke="#fff" stroke-width="2.5"/>
    <rect x="8.5" y="11.5" width="19" height="13" rx="2" fill="#fbfcf8"/><rect x="8.5" y="15.8" width="19" height="4.4" fill="#c2362f"/></svg>`,
});

export default function PlacesMap({ features, stamped, onSelect, onLocate, centerOnMe }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const me = useRef<L.Marker | null>(null);
  const accuracy = useRef<L.Circle | null>(null);
  const cb = useRef({ onSelect, onLocate });
  useEffect(() => {
    cb.current = { onSelect, onLocate };
  });

  useEffect(() => {
    const m = L.map(el.current!, { center: [50.15, 12.7], zoom: 9, preferCanvas: true, zoomControl: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · data © DATA ZÁPAD (CC0)',
    }).addTo(m);
    // ponytail: bez +/- tlačítek, na telefonu se zoomuje prsty a na desktopu kolečkem
    layer.current = L.layerGroup().addTo(m);
    m.on('locationfound', (e: L.LocationEvent) => {
      const ll = e.latlng;
      if (!me.current) {
        accuracy.current = L.circle(ll, { radius: e.accuracy, color: '#2f6fa8', weight: 1, fillOpacity: 0.08, interactive: false }).addTo(m);
        me.current = L.marker(ll, { icon: ME_ICON, zIndexOffset: 1000, keyboard: false, title: 'Tady jsi' }).addTo(m);
      } else {
        me.current.setLatLng(ll);
        accuracy.current?.setLatLng(ll).setRadius(e.accuracy);
      }
      cb.current.onLocate?.(ll.lat, ll.lng);
    });
    m.locate({ watch: true, enableHighAccuracy: true });
    map.current = m;
    return () => {
      m.stopLocate();
      m.remove();
      me.current = null;
      accuracy.current = null;
    };
  }, []);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    for (const f of features) {
      const [lon, lat] = f.geometry.coordinates;
      const done = stamped.has(f.properties.id);
      L.circleMarker([lat, lon], {
        radius: done ? 9 : 7,
        color: done ? '#e2b13c' : '#ffffff',
        weight: done ? 3.5 : 2,
        fillColor: CATEGORY[f.properties.category].color,
        fillOpacity: 0.95,
      })
        .bindTooltip(f.properties.name)
        .on('click', () => cb.current.onSelect(f))
        .addTo(g);
    }
  }, [features, stamped]);

  useEffect(() => {
    if (centerOnMe && me.current && map.current) map.current.setView(me.current.getLatLng(), 14);
  }, [centerOnMe]);

  return <div ref={el} className="h-full w-full" role="application" aria-label="Mapa míst Karlovarského kraje" />;
}
