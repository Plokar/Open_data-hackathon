import { AbsoluteFill, Easing, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { PetType } from '@/lib/api';
import { PET_TYPE } from '@/lib/game';
import { ELEMENT_GLOW, petDataUrl } from '@/lib/petArt';
import { C, Caption, SANS, clamp, easeOut } from '../kit';

/** Pořadí jako BEATS v battles/engine.py: každý přebíjí následujícího. */
const RING: { type: PetType; seed: number }[] = [
  { type: 'fortress', seed: 854670 },
  { type: 'view', seed: 451592 },
  { type: 'nature', seed: 629374 },
  { type: 'spring', seed: 637293 },
  { type: 'culture', seed: 734103 },
];
const CX = 960, CY = 440, R = 320, ARC = 180, SIZE = 210;
const deg = (i: number) => -90 + i * 72;
const at = (r: number, d: number) => [CX + r * Math.cos((d * Math.PI) / 180), CY + r * Math.sin((d * Math.PI) / 180)];
const hitAt = (i: number) => 8 + i * 11; // šipky na osminy v náběhu do dropu
const FOCUS = 70; // pak kamera najede na Pevnost → Výhled: přesně tenhle souboj přijde
const [FX, FY] = at(R * 0.7, -54); // mezi Pevností a Výhledem

/** Scéna 6: typová věž jako kámen-nůžky-papír, zoom na souboj Pevnosti s Výhledem a záblesk do dropu. */
export function TypeWheel({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const focus = interpolate(f, [FOCUS, dur], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const dimOthers = interpolate(f, [FOCUS - 6, FOCUS + 8], [1, 0.22], clamp);
  const flash = Math.max(interpolate(f, [0, 10], [0.85, 0], clamp), interpolate(f, [dur - 10, dur], [0, 0.85], clamp));
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 42%, ${C.spruce}, ${C.night} 70%)`, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: `${FX}px ${FY}px`, transform: `scale(${1 + focus * 1.6})` }}>
        <svg width="1920" height="1080" style={{ position: 'absolute' }}>
          <circle cx={CX} cy={CY} r={ARC} fill="none" stroke="rgb(246 248 241 / 0.08)" strokeWidth="2" />
          {RING.map(({ type }, i) => {
            const glow = ELEMENT_GLOW[type];
            const [x1, y1] = at(ARC, deg(i) + 12);
            const [x2, y2] = at(ARC, deg(i + 1) - 12);
            const [lx, ly] = at(ARC - 62, deg(i) + 36);
            const draw = interpolate(f, [hitAt(i), hitAt(i) + 10], [1, 0], { ...clamp, easing: easeOut });
            return (
              <g key={type} opacity={draw < 1 ? (i === 0 ? 1 : dimOthers) : 0}>
                <defs>
                  <marker id={`head-${type}`} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                    <path d="M0 0L10 5 0 10z" fill={glow} />
                  </marker>
                </defs>
                <path d={`M${x1} ${y1}A${ARC} ${ARC} 0 0 1 ${x2} ${y2}`} fill="none" stroke={glow} strokeWidth="9" strokeLinecap="round"
                  pathLength={1} strokeDasharray="1" strokeDashoffset={draw} markerEnd={draw < 0.05 ? `url(#head-${type})` : undefined}
                  style={{ filter: `drop-shadow(0 0 12px ${glow})` }} />
                <text x={lx} y={ly + 12} textAnchor="middle" fontFamily={SANS} fontWeight="800" fontSize="34" fill={glow}
                  opacity={interpolate(f, [hitAt(i) + 6, hitAt(i) + 12], [0, 1], clamp)}>×1,5</text>
              </g>
            );
          })}
        </svg>

        {RING.map(({ type, seed }, i) => {
          const [x, y] = at(R, deg(i));
          const pop = spring({ frame: f - i * 2, fps, config: { damping: 11 } });
          // útočník pulzne, poražený se otřese, když na něj šipka dorazí
          const pulse = interpolate(f, [hitAt(i), hitAt(i) + 5, hitAt(i) + 12], [1, 1.14, 1], clamp);
          const hit = f - (hitAt((i + 4) % 5) + 10);
          const shake = hit >= 0 && hit < 10 ? Math.sin(hit * 2.6) * 10 * (1 - hit / 10) : 0;
          return (
            <div key={type} style={{ position: 'absolute', left: x - SIZE / 2, top: y - SIZE / 2 - 20, width: SIZE, textAlign: 'center', opacity: i < 2 ? 1 : dimOthers }}>
              <Img src={petDataUrl({ type, seed, stage: 2, rarity: 'rare' })} width={SIZE} height={SIZE}
                style={{ transform: `translateX(${shake}px) scale(${pop * pulse})`, filter: shake ? 'brightness(1.6)' : 'none' }} />
              <div style={{ marginTop: -8, fontFamily: SANS, fontSize: 34, fontWeight: 800, color: ELEMENT_GLOW[type], opacity: pop }}>{PET_TYPE[type].label}</div>
            </div>
          );
        })}
      </AbsoluteFill>

      <Caption from={6} to={FOCUS + 24} y={890} size={64}>Žádný tvor není nejsilnější. Vyber toho správného.</Caption>
      <AbsoluteFill style={{ background: '#fff', opacity: flash }} />
    </AbsoluteFill>
  );
}
