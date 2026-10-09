import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import QRCode from 'qrcode';
import type { Category } from '@/lib/api';
import { Landscape } from '@/components/brand/Landscape';
import { GUIDES, MascotArt, type GuideId } from '@/components/guide/Guide';
import { CATEGORY } from '@/lib/game';
import { C, Caption, HILLS_NIGHT, Logo, SANS, clamp, easeOut } from '../kit';
import places from '../places.json';

export const APP_URL = 'https://zapadgo.vercel.app/';
const TEAM = 'KOREX'; 
const EVENT = 'Hackathon otevřených dat Karlovarského kraje 2026';
const CREDITS = 'Data: datazapad.cz, Dobroty Karlovarského kraje. Foto: Lubor Ferenc, Pakos / Wikimedia Commons, CC BY 4.0 a CC BY-SA 4.0.';

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
  at: 6 + (((i * 7919) % pts.length) / pts.length) * 84,
}));

const qr = QRCode.create(APP_URL, { errorCorrectionLevel: 'M' }).modules;
const QR_PATH = Array.from({ length: qr.size * qr.size }, (_, i) => (qr.data[i] ? `M${i % qr.size} ${Math.floor(i / qr.size)}h1v1h-1z` : '')).join('');

const RIDGE: { who: GuideId; x: number }[] = [{ who: 'boza', x: 1590 }, { who: 'vridla', x: 1710 }, { who: 'kukadlo', x: 1830 }];
const END = 120;

/** Scéna 10: kraj svítí místy, průvodci na hřebeni, pak logo, QR a fade do černé. */
export function Finale() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dim = interpolate(f, [END, END + 20], [0, 1], { ...clamp, easing: easeOut });
  const logo = spring({ frame: f - END - 6, fps, config: { damping: 14 } });
  const rest = interpolate(f, [END + 18, END + 34], [0, 1], { ...clamp, easing: easeOut });
  const black = interpolate(f, [212, 240], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });

  return (
    <AbsoluteFill style={{ background: 'linear-gradient(#04070a, #0b1712 70%, #14281d)', overflow: 'hidden' }}>
      <svg width="1920" height="1080" style={{
        position: 'absolute', opacity: 1 - dim * 0.7, filter: `blur(${dim * 5}px)`,
        transform: `scale(${interpolate(f, [0, END], [1.14, 1], { ...clamp, easing: easeOut })})`, transformOrigin: '50% 36%',
      }}>
        <filter id="dotglow"><feGaussianBlur stdDeviation="5" /></filter>
        <g filter="url(#dotglow)">
          {DOTS.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r="8" fill={d.color} opacity={interpolate(f, [d.at, d.at + 8], [0, 0.9], clamp)} />)}
        </g>
        {DOTS.map((d, i) => {
          const o = interpolate(f, [d.at, d.at + 4, d.at + 14], [0, 1, 0.85], clamp);
          return <circle key={i} cx={d.x} cy={d.y} r={2.6 + interpolate(f, [d.at, d.at + 4, d.at + 12], [0, 3, 0], clamp)} fill="#fff6dc" opacity={o} />;
        })}
      </svg>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 380, ...HILLS_NIGHT }}>
        <Landscape className="fill" />
      </div>
      {RIDGE.map(({ who, x }, i) => (
        <div key={who} style={{ position: 'absolute', left: x - 75, bottom: 64, opacity: 1 - dim, transform: `translateY(${Math.sin((f + i * 11) / 14) * 3}px)` }}>
          <MascotArt type={GUIDES[who].type} seed={GUIDES[who].seed} size={150} />
        </div>
      ))}

      <Caption from={26} to={END} y={880} size={62}>Karlovarský kraj. Odemkni ho celý.</Caption>

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
            <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: '-0.03em' }}>{APP_URL.replace(/^https:\/\/|\/$/g, '')}</div>
            <div style={{ marginTop: 14, fontSize: 28, opacity: 0.7 }}>{TEAM ? `${TEAM}, ${EVENT}` : EVENT}</div>
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 46, fontSize: 20, opacity: rest * 0.5 }}>{CREDITS}</div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: '#000', opacity: black }} />
    </AbsoluteFill>
  );
}
