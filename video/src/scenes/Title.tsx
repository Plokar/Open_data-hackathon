import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { Landscape } from '@/components/brand/Landscape';
import { GUIDES, MascotArt, type GuideId } from '@/components/guide/Guide';
import { C, HAND, HILLS_DAY, Logo, SANS, clamp, easeOut } from '../kit';

/** Bóža pod svým hradem, Kukadlo pod rozhlednou (ilustrace Landscape v 780 px výšky). */
const ROW: { who: GuideId; x: number; at: number }[] = [
  { who: 'boza', x: 640, at: 92 },
  { who: 'vridla', x: 960, at: 104 },
  { who: 'kukadlo', x: 1280, at: 116 },
];
const SIZE = 250;
export const HIT = 300; // hudební hit v 0:20, titulek dopadne přesně na něj

/** Scéna 2: krajina z mlhy, tři průvodci naskočí (hop-in), titulek ZÁPAD GO. */
export function Title() {
  const f = useCurrentFrame();
  const cam = interpolate(f, [0, 120], [0, 1], { ...clamp, easing: easeOut });
  const mist = interpolate(f, [0, 70], [1, 0], { ...clamp, easing: Easing.out(Easing.quad) });
  // náběh (riser) 0:18–0:20, pak hit
  const rise = interpolate(f, [236, HIT], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const slam = interpolate(f, [HIT, HIT + 12], [1.1, 1], { ...clamp, easing: easeOut });
  const flash = interpolate(f, [HIT, HIT + 12], [0.6, 0], clamp);
  const sub = interpolate(f, [HIT + 6, HIT + 22], [0, 1], { ...clamp, easing: easeOut });

  return (
    <AbsoluteFill style={{ background: 'linear-gradient(#b7c8c4, #e8e4d2 58%, #f2f4ec)', overflow: 'hidden' }}>
      <AbsoluteFill style={{
        transform: `translateY(${(1 - cam) * 260}px) scale(${1.3 - 0.3 * cam + rise * 0.08})`,
        filter: `blur(${rise * 10}px)`, transformOrigin: '50% 80%',
      }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 780, ...HILLS_DAY }}>
          <Landscape className="fill" />
        </div>
        {ROW.map(({ who, x, at }) => {
          const t = f - at;
          const y = interpolate(t, [0, 13, 21], [70, -15, 0], { ...clamp, easing: easeOut });
          const s = interpolate(t, [0, 13, 21], [0.92, 1.02, 1], clamp);
          const breathe = t > 21 ? Math.sin((t - 21) / 12) * 4 : 0;
          const label = interpolate(t, [22, 34, 124, 136], [0, 1, 1, 0], clamp);
          return (
            <div key={who} style={{ position: 'absolute', left: x - SIZE / 2, bottom: 110, width: SIZE, textAlign: 'center' }}>
              <div style={{ opacity: interpolate(t, [0, 13], [0, 1], clamp), transform: `translateY(${y + breathe}px) scale(${s})`, transformOrigin: '50% 100%' }}>
                <MascotArt type={GUIDES[who].type} seed={GUIDES[who].seed} size={SIZE} />
              </div>
              <div style={{ position: 'absolute', top: SIZE + 4, left: -80, right: -80, opacity: label, color: C.cream, textShadow: '0 2px 14px rgb(0 0 0 / 0.5)', transform: `translateY(${(1 - label) * 10}px)` }}>
                <div style={{ fontFamily: HAND, fontWeight: 700, fontSize: 56, lineHeight: 0.9 }}>{GUIDES[who].name}</div>
                <div style={{ fontFamily: SANS, fontSize: 24, opacity: 0.85 }}>{GUIDES[who].role}</div>
              </div>
            </div>
          );
        })}
      </AbsoluteFill>

      {/* mlha se rozplývá */}
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{
          position: 'absolute', width: 1500, height: 380, left: -300 + i * 520 + f * (i % 2 ? 1.6 : -1.2), top: 180 + i * 190,
          borderRadius: '50%', background: '#f4f6ef', filter: 'blur(70px)', opacity: interpolate(f, [0, 130], [0.9, 0], clamp),
        }} />
      ))}
      <AbsoluteFill style={{ background: '#eef1e8', opacity: mist }} />

      {/* titulek */}
      <AbsoluteFill style={{ background: C.spruce, opacity: rise * 0.9 }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: Math.min(1, rise * 3) }}>
        <div style={{ transform: `scale(${f < HIT ? 0.55 + rise * 0.37 : slam})`, filter: `blur(${(1 - rise) * 14}px)` }}>
          <Logo size={230} />
        </div>
        <div style={{ marginTop: 34, fontFamily: SANS, fontSize: 58, fontWeight: 400, color: C.cream, opacity: sub * 0.85, transform: `translateY(${(1 - sub) * 14}px)` }}>
          Kraj, který se dá sbírat.
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: '#fff', opacity: f >= HIT ? flash : 0 }} />
    </AbsoluteFill>
  );
}
