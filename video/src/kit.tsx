import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { loadFont as loadSans } from '@remotion/google-fonts/BricolageGrotesque';
import { loadFont as loadHand } from '@remotion/google-fonts/Caveat';
import type { Category } from '@/lib/api';
import { CATEGORY } from '@/lib/game';

export const SANS = loadSans('normal', { weights: ['400', '700', '800'], subsets: ['latin', 'latin-ext'] }).fontFamily;
export const HAND = loadHand('normal', { weights: ['600', '700'], subsets: ['latin', 'latin-ext'] }).fontFamily;

/** Paleta aplikace (globals.css) plus tmavý „filmový“ smrk pro noční scény. */
export const C = {
  night: '#0b130f',
  spruce: '#1c2b22',
  moss: '#2e6a47',
  paper: '#f2f4ec',
  cream: '#f6f8f1',
  red: '#c2362f',
  blue: '#2f6fa8',
  green: '#2e8a4e',
  yellow: '#e2b13c',
};

/** CSS proměnné, na kterých stojí Landscape z aplikace (světlý a noční režim). */
export const HILLS_DAY = {
  '--hill-far': '#d5dccb', '--hill-mid': '#a9bfa6', '--hill-near': '#2e6a47', '--tree': '#3c7a55',
  '--trail-red': C.red, '--trail-yellow': C.yellow,
} as React.CSSProperties;
export const HILLS_NIGHT = {
  '--hill-far': '#1a2a21', '--hill-mid': '#15231b', '--hill-near': '#0f1913', '--tree': '#13231a',
  '--trail-red': 'rgb(224 87 79 / 0.3)', '--trail-yellow': '#c9c2a2',
} as React.CSSProperties;

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export const easeOut = Easing.bezier(0.22, 1, 0.36, 1);

/** 0→1 mezi dvěma snímky s měkkým doběhem. */
export function useRamp(from: number, to: number, easing = easeOut) {
  return interpolate(useCurrentFrame(), [from, to], [0, 1], { ...clamp, easing });
}

/** Titulek na obrazovce. Zároveň slouží jako české titulky (porota může koukat bez zvuku). */
export function Caption({ from, to, children, y = 850, size = 68, small }: {
  from: number; to: number; children: React.ReactNode; y?: number; size?: number; small?: React.ReactNode;
}) {
  const f = useCurrentFrame();
  const inn = interpolate(f, [from, from + 16], [0, 1], { ...clamp, easing: easeOut });
  const out = interpolate(f, [to - 10, to], [1, 0], clamp);
  const o = Math.min(inn, out);
  if (o <= 0) return null;
  return (
    <div style={{
      position: 'absolute', left: 120, right: 120, top: y, textAlign: 'center', color: C.cream, opacity: o,
      fontFamily: SANS, fontWeight: 800, fontSize: size, lineHeight: 1.08, letterSpacing: '-0.025em', textWrap: 'balance',
      filter: `blur(${(1 - inn) * 10}px)`, transform: `translateY(${(1 - inn) * 18}px)`,
      textShadow: '0 4px 40px rgb(0 0 0 / 0.6), 0 2px 8px rgb(0 0 0 / 0.35)',
    }}>
      {children}
      {small && <div style={{ marginTop: 18, fontSize: 28, fontWeight: 400, letterSpacing: 0, opacity: 0.75 }}>{small}</div>}
    </div>
  );
}

// ponytail: kopie TrailMark z aplikace, originál v souboru táhne next/link
export function TrailMark({ color = C.red, height = 40 }: { color?: string; height?: number }) {
  return (
    <svg viewBox="0 0 30 21" height={height} style={{ flexShrink: 0 }}>
      <rect x="0.5" y="0.5" width="29" height="20" rx="2" fill="#fbfcf8" stroke="rgb(28 43 34 / 0.18)" />
      <rect x="0.5" y="7" width="29" height="7" fill={color} />
    </svg>
  );
}

export function Logo({ size = 200 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.22, fontFamily: SANS, fontWeight: 800, fontSize: size, letterSpacing: '-0.045em', lineHeight: 1, color: C.cream, whiteSpace: 'nowrap' }}>
      <TrailMark height={size * 0.62} />
      ZÁPAD GO
    </div>
  );
}

/** Inkoustové razítko jako v Pasu (start/page.tsx). */
export function Stamp({ title, date, icon = 'lookout', size = 420, color = C.red }: { title: string; date: string; icon?: Category; size?: number; color?: string }) {
  const Icon = CATEGORY[icon].Icon;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', border: `${size * 0.017}px solid ${color}`, color,
      display: 'grid', placeItems: 'center', fontFamily: SANS, textAlign: 'center',
    }}>
      <div style={{ width: size * 0.85, height: size * 0.85, borderRadius: '50%', border: `${size * 0.006}px dashed ${color}`, display: 'grid', placeItems: 'center' }}>
        <div>
          <Icon size={size * 0.2} strokeWidth={2} style={{ display: 'block', margin: '0 auto' }} />
          <div style={{ marginTop: size * 0.02, fontSize: size * 0.085, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1, letterSpacing: '0.04em' }}>{title}</div>
          <div style={{ fontFamily: HAND, fontSize: size * 0.11, lineHeight: 1.2 }}>{date}</div>
        </div>
      </div>
    </div>
  );
}

/** Zrno a vinětace přes celý film. */
export function Film() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 75% 75% at 50% 50%, transparent 55%, rgb(0 0 0 / 0.5))' }} />
      <svg width="1920" height="1080" style={{ position: 'absolute', opacity: 0.14, mixBlendMode: 'overlay' }}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed={f % 16} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="1920" height="1080" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
}

/** Rámeček telefonu kolem záznamu obrazovky (412 × 892 CSS px). `w` je šířka displeje ve videu. */
export function Phone({ w, children, style }: { w: number; children: React.ReactNode; style?: React.CSSProperties }) {
  const bezel = w * 0.035;
  return (
    <div style={{
      position: 'absolute', width: w + 2 * bezel, padding: bezel, borderRadius: w * 0.14, background: '#0a0d0b',
      boxShadow: '0 0 0 2px #2a302c, 0 50px 90px -30px rgb(0 0 0 / 0.8)', ...style,
    }}>
      <div style={{ position: 'relative', width: w, height: (w * 892) / 412, borderRadius: w * 0.11, overflow: 'hidden', background: C.paper }}>
        {children}
        <div style={{ position: 'absolute', top: w * 0.022, left: '50%', width: w * 0.27, height: w * 0.07, marginLeft: -w * 0.135, borderRadius: 99, background: '#000' }} />
      </div>
    </div>
  );
}

/** Ťuknutí prstem: kroužek, který se rozplyne. */
export function Tap({ at, x, y }: { at: number; x: number; y: number }) {
  const t = useCurrentFrame() - at;
  if (t < 0 || t > 16) return null;
  return (
    <div style={{
      position: 'absolute', left: `${x * 100}%`, top: `${y * 100}%`, width: 70, height: 70, margin: -35, borderRadius: '50%',
      background: 'rgb(255 255 255 / 0.35)', border: '3px solid rgb(255 255 255 / 0.9)',
      transform: `scale(${interpolate(t, [0, 16], [0.5, 1.4])})`, opacity: interpolate(t, [0, 4, 16], [0, 1, 0]),
    }} />
  );
}

/** Scéna, která čeká na živý záznam aplikace (natáčí se po feature freeze). */
export function Pending({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, ${C.spruce}, ${C.night} 75%)` }}>
      <div style={{ position: 'absolute', inset: 60, border: '3px dashed rgb(246 248 241 / 0.16)', borderRadius: 28 }} />
      <div style={{ position: 'absolute', left: 100, top: 92, fontFamily: SANS, fontSize: 30, color: 'rgb(246 248 241 / 0.4)' }}>{label}</div>
      {children}
    </AbsoluteFill>
  );
}
