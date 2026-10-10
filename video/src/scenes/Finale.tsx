import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import QRCode from 'qrcode';
import type { Category } from '@/lib/api';
import { Landscape } from '@/components/brand/Landscape';
import { GUIDES, MascotArt, type GuideId } from '@/components/guide/Guide';
import { CATEGORY } from '@/lib/game';
import { C, Caption, HILLS_NIGHT, Logo, SANS, clamp, easeOut } from '../kit';
import places from '../places.json';

export const APP_URL = 'https://zapadgo-app.nervelabs.co.uk/';
const TEAM = 'KOREX';
const EVENT = 'Hackathon otevřených dat Karlovarského kraje 2026';
const CREDITS = 'Data: datazapad.cz, Dobroty Karlovarského kraje, © OpenStreetMap. Záběry: Joe999 / Videezy.com, Mixkit. Foto: Wikimedia Commons (CC BY-SA). Hudba: Sovereign of the High Peak.';

// Místa z DB (export v src/places.json), promítnutá do rámečku 1100 × 600 nad hřebenem.
const pts = places as [number, number, Category][];
const lats = pts.map((p) => p[0]), lons = pts.map((p) => p[1]);
const [lat0, lat1, lon0, lon1] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
const kx = Math.cos((((lat0 + lat1) / 2) * Math.PI) / 180);
const scale = Math.min(1100 / ((lon1 - lon0) * kx), 600 / (lat1 - lat0));
const DOTS = pts.map(([lat, lon, cat], i) => ({
  x: 960 + ((lon - (lon0 + lon1) / 2) * kx) * scale,
  y: 390 - (lat - (lat0 + lat1) / 2) * scale,
  color: CATEGORY[cat]?.color ?? C.cream,
  at: (((i * 7919) % pts.length) / pts.length) * 24, // rozsvícení během přechodu ze scény 9
}));
export const SKY = 'linear-gradient(#04070a, #0b1712 70%, #14281d)';
export const CAM0 = 1.14; // počáteční přiblížení souhvězdí (scéna 9 ho tak předá)

/** 617 míst kraje jako souhvězdí. `t` = snímky od začátku rozsvěcení, `pulse` = záblesk na hudební vrchol. */
export function Constellation({ t, cam = CAM0, pulse = 0, style }: { t: number; cam?: number; pulse?: number; style?: React.CSSProperties }) {
  return (
    <svg width="1920" height="1080" style={{ position: 'absolute', transform: `scale(${cam})`, transformOrigin: '50% 36%', ...style }}>
      <filter id="dotglow"><feGaussianBlur stdDeviation="5" /></filter>
      <g filter="url(#dotglow)">
        {DOTS.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={8 + pulse * 5} fill={d.color} opacity={interpolate(t, [d.at, d.at + 8], [0, 0.9], clamp)} />)}
      </g>
      {DOTS.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={2.6 + pulse * 2.2 + interpolate(t, [d.at, d.at + 4, d.at + 12], [0, 3, 0], clamp)} fill="#fff6dc"
          opacity={interpolate(t, [d.at, d.at + 4, d.at + 14], [0, 1, 0.85], clamp)} />
      ))}
    </svg>
  );
}

const qr = QRCode.create(APP_URL, { errorCorrectionLevel: 'M' }).modules;
const QR_PATH = Array.from({ length: qr.size * qr.size }, (_, i) => (qr.data[i] ? `M${i % qr.size} ${Math.floor(i / qr.size)}h1v1h-1z` : '')).join('');

const RIDGE: { who: GuideId; x: number; at: number }[] = [{ who: 'boza', x: 1590, at: 12 }, { who: 'vridla', x: 1710, at: 20 }, { who: 'kukadlo', x: 1830, at: 28 }];
const END = 150; // závěrečná karta

/** Scéna 10: hudební vrchol, kraj svítí místy, průvodci na hřebeni, pak logo, QR a fade do černé s doznívajícím akordem. */
export function Finale({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dim = interpolate(f, [END, END + 20], [0, 1], { ...clamp, easing: easeOut });
  const logo = spring({ frame: f - END - 6, fps, config: { damping: 14 } });
  const rest = interpolate(f, [END + 18, END + 34], [0, 1], { ...clamp, easing: easeOut });
  const black = interpolate(f, [dur - 40, dur], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const ridge = interpolate(f, [0, 26], [1, 0], { ...clamp, easing: easeOut });

  return (
    <AbsoluteFill style={{ background: SKY, overflow: 'hidden' }}>
      <Constellation t={100} pulse={interpolate(f, [0, 3, 18], [0, 1, 0], clamp)}
        cam={interpolate(f, [0, END], [CAM0, 1], { ...clamp, easing: easeOut })}
        style={{ opacity: 1 - dim * 0.7, filter: `blur(${dim * 5}px)` }} />

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 380, ...HILLS_NIGHT, transform: `translateY(${ridge * 380}px)` }}>
        <Landscape className="fill" />
      </div>
      {RIDGE.map(({ who, x, at }, i) => {
        const t = f - at;
        return (
          <div key={who} style={{
            position: 'absolute', left: x - 75, bottom: 64, opacity: Math.min(interpolate(t, [0, 6], [0, 1], clamp), 1 - dim),
            transform: `translateY(${interpolate(t, [0, 8, 13], [60, -10, 0], clamp) + Math.sin((f + i * 11) / 14) * 3}px)`,
          }}>
            <MascotArt type={GUIDES[who].type} seed={GUIDES[who].seed} size={150} />
          </div>
        );
      })}

      <Caption from={14} to={END} y={880} size={62}>Karlovarský kraj. Odemkni ho celý.</Caption>

      {/* závěrečná karta */}
      <AbsoluteFill style={{ background: 'rgb(5 8 10 / 0.55)', opacity: dim }} />
      <AbsoluteFill style={{ alignItems: 'center', fontFamily: SANS, color: C.cream, opacity: dim }}>
        <div style={{ marginTop: 210, transform: `scale(${0.85 + logo * 0.15})` }}><Logo size={150} /></div>
        <div style={{ marginTop: 26, fontSize: 46, opacity: 0.85 }}>Kraj, který se dá sbírat.</div>
        <div style={{ marginTop: 64, display: 'flex', alignItems: 'center', gap: 48, opacity: rest, transform: `translateY(${(1 - rest) * 20}px)` }}>
          <svg viewBox={`-2 -2 ${qr.size + 4} ${qr.size + 4}`} width="250" height="250" shapeRendering="crispEdges" style={{ background: C.cream, borderRadius: 20 }}>
            <path d={QR_PATH} fill={C.spruce} />
          </svg>
          <div>
            <div style={{ fontSize: 34, opacity: 0.7 }}>Hraj hned na</div>
            <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-0.03em' }}>{APP_URL.replace(/^https:\/\/|\/$/g, '')}</div>
            <div style={{ marginTop: 14, fontSize: 28, opacity: 0.7 }}>{TEAM ? `${TEAM}, ${EVENT}` : EVENT}</div>
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 40, left: 120, right: 120, textAlign: 'center', fontSize: 19, lineHeight: 1.4, opacity: rest * 0.5 }}>{CREDITS}</div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: '#000', opacity: black }} />
    </AbsoluteFill>
  );
}
