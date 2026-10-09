import { AbsoluteFill, Easing, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Rarity } from '@/lib/api';
import { PET_TYPE } from '@/lib/game';
import { ELEMENT_GLOW, petDataUrl } from '@/lib/petArt';
import { C, Caption, SANS, Stamp, clamp, easeOut } from '../kit';

export const HERO = { type: 'view', seed: 419916, name: 'Vyhlídal', place: 'Rozhledna Diana' } as const;
const GLOW = ELEMENT_GLOW[HERO.type];
const TYPE_COLOR = PET_TYPE[HERO.type].color;

const REVEAL = 122;
const RARITIES: { at: number; r: Rarity; label: string; color: string }[] = [
  { at: REVEAL, r: 'common', label: 'Běžný', color: '#a8b0aa' },
  { at: 148, r: 'rare', label: 'Vzácný', color: '#5aa9f0' },
  { at: 168, r: 'epic', label: 'Epický', color: '#c084fc' },
  { at: 186, r: 'legendary', label: 'Legendární', color: '#fcd34d' },
];
const STATS: [string, number, number][] = [['Život', 312, 320], ['Útok', 61, 70], ['Obrana', 38, 45], ['Rychlost', 35, 40], ['Magie', 66, 70]];
const SEEDS = [{ label: 'místo', tilt: -18 }, { label: 'foto', tilt: 42 }, { label: 'hráč', tilt: 102 }];
const STAGES = ['Mládě', 'Dospělec', 'Prastarý'];
const CRACKS = ['M0 0l-60-40-30-90-70-60', 'M0 0l80-20 60-80 90-30', 'M0 0l20 90 70 50 10 80', 'M0 0l-90 40-40 80-90 20', 'M0 0l40-70'];
const CX = 960, CY = 470;

/** Scéna 5: razítko praskne, z místa + fota + hráče se zrodí tvor, odhalí se rarita a evoluce. */
export function PetBirth() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const burst = 46;
  const flash = Math.max(interpolate(f, [burst - 1, burst, burst + 14], [0, 0.7, 0], clamp), interpolate(f, [112, REVEAL, REVEAL + 18], [0, 1, 0], clamp));
  const rarity = [...RARITIES].reverse().find((x) => f >= x.at) ?? RARITIES[0];
  const montage = interpolate(f, [258, 276], [0, 1], clamp);

  return (
    <AbsoluteFill style={{
      overflow: 'hidden',
      background: `radial-gradient(circle at 50% 44%, color-mix(in oklab, ${f >= REVEAL ? rarity.color : GLOW} ${interpolate(f, [0, burst, REVEAL], [6, 24, 34], clamp)}%, #0b1020), #05070d 72%)`,
    }}>
      {f < REVEAL && <Birth f={f} burst={burst} />}
      {f >= REVEAL && f < 276 && <Reveal f={f} fps={fps} rarity={rarity} out={montage} />}
      {f >= 258 && <Evolution f={f} fps={fps} fade={montage} />}

      <Caption from={10} to={114} y={880}>Tvor se zrodí z místa, které jsi dobyl.</Caption>
      <Caption from={336} to={388} y={880}>Každý hráč má jiného. A roste s tebou.</Caption>
      <AbsoluteFill style={{ background: '#fff', opacity: flash }} />
    </AbsoluteFill>
  );
}

function Birth({ f, burst }: { f: number; burst: number }) {
  const shake = interpolate(f, [8, burst], [0, 9], clamp);
  const crack = interpolate(f, [10, burst - 2], [1, 0], { ...clamp, easing: Easing.in(Easing.quad) });
  const fly = interpolate(f, [burst, burst + 40], [0, 1], { ...clamp, easing: easeOut });
  const core = interpolate(f, [burst - 4, burst + 16], [0, 1], { ...clamp, easing: easeOut });
  const pull = interpolate(f, [40, 118], [1, 0.04], { ...clamp, easing: Easing.in(Easing.cubic) });
  const quarters = ['0 0, 52% 0, 48% 50%, 0 46%', '52% 0, 100% 0, 100% 54%, 48% 50%', '48% 50%, 100% 54%, 100% 100%, 50% 100%', '0 46%, 48% 50%, 50% 100%, 0 100%'];
  const dirs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

  return (
    <>
      {/* razítko se třese, praská a rozletí */}
      {quarters.map((q, i) => (
        <div key={i} style={{
          position: 'absolute', left: CX - 210, top: CY - 210, clipPath: `polygon(${q})`, opacity: 1 - fly,
          transform: `translate(${Math.sin(f * 2.3) * shake + dirs[i][0] * fly * 520}px, ${Math.cos(f * 1.9) * shake + dirs[i][1] * fly * 380}px) rotate(${-8 + dirs[i][0] * fly * 50}deg)`,
        }}>
          <Stamp title={HERO.place} date="9. 10. 2026" size={420} color="#e0574f" />
        </div>
      ))}
      <svg width="1920" height="1080" style={{ position: 'absolute', opacity: 1 - fly }}>
        <g transform={`translate(${CX} ${CY})`} stroke="#fff6c8" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" style={{ filter: `drop-shadow(0 0 10px ${GLOW})` }}>
          {CRACKS.map((d, i) => <path key={i} d={d} pathLength={1} strokeDasharray="1" strokeDashoffset={crack} />)}
        </g>
      </svg>

      {/* jiskra */}
      <div style={{
        position: 'absolute', left: CX - 90, top: CY - 90, width: 180, height: 180, borderRadius: '50%',
        background: `radial-gradient(circle, #fff 0 18%, ${GLOW} 38%, transparent 70%)`,
        transform: `scale(${core * (1 + Math.sin(f / 3) * 0.08) * (1 + (1 - pull) * 0.8)})`,
      }} />

      {/* tři „řetězce“ DNA: místo, foto, hráč, stahují se do jiskry */}
      <svg width="1920" height="1080" style={{ position: 'absolute', opacity: interpolate(f, [34, 52, 108, 118], [0, 1, 1, 0], clamp) }}>
        {SEEDS.map(({ label, tilt }, k) => {
          const rx = 420 * pull, ry = 120 * pull;
          const th = f / (6 + pull * 10) + (k * Math.PI * 2) / 3;
          const a = (tilt * Math.PI) / 180;
          const ex = rx * Math.cos(th), ey = ry * Math.sin(th);
          const x = CX + ex * Math.cos(a) - ey * Math.sin(a), y = CY + ex * Math.sin(a) + ey * Math.cos(a);
          return (
            <g key={label}>
              <ellipse cx={CX} cy={CY} rx={rx} ry={ry} transform={`rotate(${tilt} ${CX} ${CY})`} fill="none" stroke={GLOW} strokeOpacity="0.45" strokeWidth="4" strokeDasharray="1 16" strokeLinecap="round" />
              <circle cx={x} cy={y} r="11" fill="#fff" style={{ filter: `drop-shadow(0 0 14px ${GLOW})` }} />
              <text x={x} y={y - 26} textAnchor="middle" fill={C.cream} fontFamily={SANS} fontWeight="700" fontSize="40" opacity={pull > 0.25 ? 1 : pull * 4}>{label}</text>
            </g>
          );
        })}
      </svg>
    </>
  );
}

function Reveal({ f, fps, rarity, out }: { f: number; fps: number; rarity: (typeof RARITIES)[number]; out: number }) {
  const t = f - REVEAL;
  const pop = spring({ frame: t, fps, config: { damping: 9, mass: 0.8 } });
  const legendary = interpolate(f, [186, 196, 226], [0, 1, 0.55], clamp);
  const panel = interpolate(t, [18, 40], [0, 1], { ...clamp, easing: easeOut });
  return (
    <AbsoluteFill style={{ opacity: 1 - out, transform: `scale(${1 - out * 0.15})` }}>
      {/* paprsky jako v Evolution.tsx */}
      <div style={{
        position: 'absolute', left: 700 - 1100, top: CY - 1100, width: 2200, height: 2200,
        background: `repeating-conic-gradient(from ${t * 0.8}deg, ${rarity.color}30 0deg 8deg, transparent 8deg 22deg)`,
        maskImage: 'radial-gradient(circle, #000 8%, transparent 48%)',
      }} />
      <div style={{
        position: 'absolute', left: 700 - 380, top: CY - 380, width: 760, height: 760, borderRadius: '50%',
        background: `radial-gradient(circle, ${rarity.color}${legendary > 0 ? 'aa' : '66'}, transparent 65%)`, transform: `scale(${1 + legendary * 0.25})`,
      }} />
      <div style={{ position: 'absolute', left: 700 - 300, top: CY - 330, perspective: 1400 }}>
        <Img src={petDataUrl({ type: HERO.type, seed: HERO.seed, stage: 2, rarity: rarity.r })} width={600} height={600}
          style={{ transform: `rotateY(${Math.sin(t / 34) * 16}deg) translateY(${Math.sin(t / 11) * 6}px) scale(${0.4 + pop * 0.6})` }} />
      </div>

      <div style={{ position: 'absolute', left: 1100, top: 210, width: 640, fontFamily: SANS, color: C.cream, opacity: panel, transform: `translateX(${(1 - panel) * 60}px)` }}>
        <div style={{ height: 58, overflow: 'hidden' }}>
          <span key={rarity.r} style={{
            display: 'inline-block', padding: '8px 22px', borderRadius: 999, fontSize: 30, fontWeight: 800, color: '#0b1020', background: rarity.color,
            transform: `translateY(${interpolate(f - rarity.at, [0, 6], [40, 0], clamp)}px)`,
          }}>{rarity.label}</span>
        </div>
        <div style={{ marginTop: 18, fontSize: 124, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>{HERO.name}</div>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 16, fontSize: 30 }}>
          <span style={{ padding: '6px 18px', borderRadius: 999, background: TYPE_COLOR, fontWeight: 700 }}>Výhled</span>
          <span style={{ opacity: 0.75 }}>vylíhl se na rozhledně Diana</span>
        </div>
        <div style={{ marginTop: 38, display: 'grid', gap: 16 }}>
          {STATS.map(([label, v, max], i) => {
            const fill = interpolate(t, [34 + i * 6, 64 + i * 6], [0, 1], { ...clamp, easing: easeOut });
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 28 }}>
                <span style={{ width: 150, opacity: 0.75 }}>{label}</span>
                <span style={{ width: 70, textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{Math.round(v * fill)}</span>
                <span style={{ flex: 1, height: 12, borderRadius: 99, background: 'rgb(255 255 255 / 0.12)' }}>
                  <span style={{ display: 'block', height: 12, borderRadius: 99, width: `${(100 * v * fill) / max}%`, background: label === 'Magie' ? GLOW : TYPE_COLOR, boxShadow: `0 0 12px ${label === 'Magie' ? GLOW : TYPE_COLOR}` }} />
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Evolution({ f, fps, fade }: { f: number; fps: number; fade: number }) {
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      {STAGES.map((label, i) => {
        const at = 280 + i * 22;
        const t = f - at;
        const silhouette = t < 6;
        const pop = spring({ frame: t, fps, config: { damping: 10 } });
        const x = 480 + i * 480;
        return (
          <div key={label} style={{ position: 'absolute', left: x - 230, top: 170, width: 460, textAlign: 'center', opacity: t < 0 ? 0 : 1 }}>
            <Img src={petDataUrl({ type: HERO.type, seed: HERO.seed, stage: i + 1, rarity: 'legendary' })} width={460} height={460}
              style={{
                transform: `scale(${0.6 + pop * 0.4}) translateY(${Math.sin((f + i * 9) / 12) * 5}px)`, transformOrigin: '50% 90%',
                filter: silhouette ? 'brightness(0) invert(1) drop-shadow(0 0 18px #fff)' : 'none',
              }} />
            <div style={{ marginTop: 6, fontFamily: SANS, fontSize: 44, fontWeight: 800, color: i === 2 ? GLOW : C.cream, opacity: interpolate(t, [6, 16], [0, 1], clamp) }}>{label}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}
