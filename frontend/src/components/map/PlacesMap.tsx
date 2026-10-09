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

export default function PlacesMap({ features, stamped, onSelect, onLocate, centerOnMe }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const me = useRef<L.CircleMarker | null>(null);
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
    L.control.zoom({ position: 'topright' }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    m.on('locationfound', (e: L.LocationEvent) => {
      const ll = e.latlng;
      if (!me.current) {
        me.current = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).addTo(m);
      } else me.current.setLatLng(ll);
      cb.current.onLocate?.(ll.lat, ll.lng);
    });
    m.locate({ watch: true, enableHighAccuracy: true });
    map.current = m;
    return () => {
      m.stopLocate();
      m.remove();
      me.current = null;
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
        color: done ? '#facc15' : '#ffffff',
        weight: done ? 3 : 1.5,
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
