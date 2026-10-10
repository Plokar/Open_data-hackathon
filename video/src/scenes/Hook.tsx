import { AbsoluteFill, Easing, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { Caption, clamp } from '../kit';

/*
 * Záběry: Joe999 / Videezy.com (dron nad krajinou, zřícenina v lese, hrad Loket), Videezy Standard License s uvedením zdroje.
 * Každý záběr se prolne do dalšího (XF snímků), kamera pomalu najíždí.
 */
const XF = 8;
const SHOTS = [
  { src: 'stock/landscape.mp4', from: 0, to: 84, trim: 0.2, zoom: [1, 1.07], origin: '50% 62%' },
  { src: 'stock/ruin.mp4', from: 84 - XF, to: 118, trim: 0.6, zoom: [1.04, 1.12], origin: '55% 45%' },
  { src: 'stock/loket.mp4', from: 118 - XF, to: 183, trim: 0, zoom: [1.02, 1.4], origin: '58% 22%' }, // věž Lokte
];
const GRADE = 'saturate(0.88) contrast(1.07) brightness(0.9)';

/** Scéna 1: hudba se rozjíždí z ticha, dron nad krajem, zřícenina, push-in na věž Lokte, mlha. */
export function Hook({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const fromBlack = interpolate(f, [0, 22], [1, 0], clamp);
  const mist = interpolate(f, [dur - 18, dur], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      {SHOTS.map((s, i) => (
        <Sequence key={s.src} from={s.from} durationInFrames={s.to - s.from}>
          <Shot {...s} len={s.to - s.from} fadeIn={i ? XF : 0} />
        </Sequence>
      ))}
      <AbsoluteFill style={{ background: 'linear-gradient(rgb(0 0 0 / 0.3), transparent 30%, transparent 55%, rgb(0 0 0 / 0.6))' }} />
      <AbsoluteFill style={{ background: '#000', opacity: fromBlack }} />

      <Caption from={14} to={80} y={455} size={124}>Karlovarský kraj.</Caption>
      <Caption from={94} to={dur - 4} size={76}>Kolik z jeho příběhů jsi opravdu viděl?</Caption>
      {/* mlha, ze které se v další scéně vynoří ilustrovaná krajina (hudební úder) */}
      <AbsoluteFill style={{ background: '#eef1e8', opacity: mist }} />
    </AbsoluteFill>
  );
}

function Shot({ src, trim, zoom, origin, len, fadeIn }: { src: string; trim: number; zoom: number[]; origin: string; len: number; fadeIn: number }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: fadeIn ? interpolate(f, [0, fadeIn], [0, 1], clamp) : 1 }}>
      <OffthreadVideo src={staticFile(src)} muted trimBefore={Math.round(trim * 30)}
        style={{
          width: '100%', height: '100%', objectFit: 'cover', filter: GRADE, transformOrigin: origin,
          transform: `scale(${interpolate(f, [0, len], zoom, { ...clamp, easing: Easing.inOut(Easing.quad) })})`,
        }} />
    </AbsoluteFill>
  );
}
