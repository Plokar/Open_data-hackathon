import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { Caption, clamp } from '../kit';

// ponytail: fotky z Wikimedia Commons (960 px) jsou zástupné; až bude letecký stock záběr, vyměnit za <OffthreadVideo>
const GRADE = 'saturate(0.8) contrast(1.08) brightness(0.84) sepia(0.14)';
const photo: React.CSSProperties = { position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', filter: GRADE };

/** Scéna 1: tma, jedna GPS tečka, krajina Krušných hor, push-in na věž Lokte. */
export function Hook() {
  const f = useCurrentFrame();
  const dot = interpolate(f, [30, 40, 100, 128], [0, 1, 1, 0], clamp);
  const ring = ((f + 15) % 45) / 45;
  const land = interpolate(f, [90, 135, 205, 222], [0, 1, 1, 0], clamp);
  const castle = interpolate(f, [205, 222], [0, 1], clamp);
  const mist = interpolate(f, [282, 300], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });

  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <Img src={staticFile('krusne-hory.jpg')} style={{
        ...photo, opacity: land,
        transform: `scale(${interpolate(f, [90, 222], [1.06, 1.2])}) translateX(${interpolate(f, [90, 222], [18, -26])}px)`,
      }} />
      {/* věž je na fotce zhruba v 62 % šířky a 30 % výšky */}
      <Img src={staticFile('loket.jpg')} style={{
        ...photo, opacity: castle, transformOrigin: '62% 30%',
        transform: `scale(${interpolate(f, [205, 300], [1.02, 1.55], { ...clamp, easing: Easing.in(Easing.quad) })})`,
      }} />
      <AbsoluteFill style={{ background: 'linear-gradient(rgb(0 0 0 / 0.25), transparent 35%, transparent 55%, rgb(0 0 0 / 0.6))' }} />

      {/* jediná GPS tečka ve tmě */}
      <div style={{ position: 'absolute', left: 960, top: 540, opacity: dot }}>
        <div style={{
          position: 'absolute', width: 180, height: 180, left: -90, top: -90, borderRadius: '50%',
          border: '2px solid rgb(255 236 190 / 0.8)', transform: `scale(${0.1 + ring * 0.9})`, opacity: 1 - ring,
        }} />
        <div style={{ position: 'absolute', width: 18, height: 18, left: -9, top: -9, borderRadius: '50%', background: '#fff3d6', boxShadow: '0 0 24px 8px rgb(255 214 130 / 0.7)' }} />
      </div>

      <Caption from={110} to={206} y={470} size={120}>Karlovarský kraj.</Caption>
      <Caption from={226} to={298} size={76}>Kolik z jeho příběhů jsi opravdu viděl?</Caption>
      {/* mlha, ze které se v další scéně vynoří ilustrovaná krajina */}
      <AbsoluteFill style={{ background: '#eef1e8', opacity: mist }} />
    </AbsoluteFill>
  );
}
