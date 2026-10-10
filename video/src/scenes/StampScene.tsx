import { AbsoluteFill, Easing, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { MapPin } from 'lucide-react';
import checkinRec from '../../public/rec/checkin.json';
import { C, Caption, HAND, PHONE, Phone, SANS, SideText, Stamp, Tap, clamp, easeOut, evt, type Rec } from '../kit';
import { HERO } from './PetBirth';

const REC = checkinRec as Rec;
const PHONE_IN = 84;        // telefon s aplikací přijede přes záběr turisty
const TAP = 104;            // ťuknutí na Vyfotit a orazítkovat
const LAND = 120;           // razítko dopadne na hudební úder (originál 24,1 s)
const PUSH = 24;            // najezd do razítka na konci scény
// razítko na konci = první snímek zrození tvora (PetBirth: střed 960 × 470, 420 px, -8°)
const END_Y = 470;

/** Scéna 4: turista zezadu na cestě k rozhledně, ověření polohy a fotky v aplikaci, razítko v Pasu. */
export function StampScene({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const enter = interpolate(f, [0, 10], [0, 1], { ...clamp, easing: easeOut }); // průlet z mapy
  const phone = interpolate(f, [PHONE_IN, PHONE_IN + 16], [0, 1], { ...clamp, easing: easeOut });
  const footageOut = interpolate(f, [PHONE_IN, PHONE_IN + 16], [0, 1], clamp);
  const meters = Math.round(interpolate(f, [8, 80], [320, 40], { ...clamp, easing: Easing.out(Easing.quad) }) / 10) * 10;
  const ring = interpolate(f, [8, 80], [1, 0.45], { ...clamp, easing: Easing.out(Easing.quad) });
  const inside = meters < 300;

  // razítko v Pasu
  const card = interpolate(f, [LAND - 10, LAND - 2], [0, 1], { ...clamp, easing: easeOut });
  const t = f - LAND;
  const stampScale = interpolate(t, [-8, 0, 5], [1.8, 0.95, 1], clamp);
  const stampRot = interpolate(t, [-8, 0, 5], [-16, -7, -8], clamp);
  const thud = t >= 0 && t < 9 ? Math.sin(t * 3) * (9 - t) * 1.6 : 0;
  // najezd do razítka a ztmavení do noci, kde se zrodí tvor
  const push = interpolate(f, [dur - PUSH, dur], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });

  return (
    <AbsoluteFill style={{ background: C.night, overflow: 'hidden', opacity: enter, transform: `scale(${1.12 - enter * 0.12})` }}>
      {/* turista: Mixkit (volná licence) */}
      <AbsoluteFill style={{ opacity: 1 - footageOut * 0.75, filter: `blur(${footageOut * 10}px)` }}>
        <OffthreadVideo src={staticFile('stock/hiker.mp4')} muted trimBefore={30}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${1.05 + f * 0.0008})`, filter: 'saturate(0.9) contrast(1.05)' }} />
        <AbsoluteFill style={{ background: 'linear-gradient(transparent 55%, rgb(0 0 0 / 0.55))' }} />
        {/* cíl na cestě: kruh se zmenšuje, jak se blíží rozhledna */}
        <svg width="1920" height="1080" style={{ position: 'absolute', opacity: interpolate(f, [6, 16, PHONE_IN, PHONE_IN + 8], [0, 1, 1, 0], clamp) }}>
          <g transform={`translate(960 545) scale(${ring})`}>
            <ellipse rx="520" ry="120" fill="none" stroke={inside ? C.yellow : C.cream} strokeWidth={5 / ring} strokeDasharray={`${18 / ring} ${14 / ring}`} opacity="0.9" />
            <ellipse rx="520" ry="120" fill={inside ? C.yellow : C.cream} opacity="0.08" />
          </g>
        </svg>
        <div style={{
          position: 'absolute', left: 960, top: 360, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 24px', borderRadius: 999, background: inside ? C.yellow : 'rgb(11 19 15 / 0.75)', color: inside ? C.spruce : C.cream,
          fontFamily: SANS, fontWeight: 800, fontSize: 34, opacity: interpolate(f, [6, 16, PHONE_IN, PHONE_IN + 8], [0, 1, 1, 0], clamp), whiteSpace: 'nowrap',
        }}>
          <MapPin size={34} strokeWidth={2.5} />
          {HERO.place} <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 400 }}>{meters} m</span>
        </div>
        <Caption from={10} to={PHONE_IN + 4} y={900} size={64}>Dojdi blíž než 300 m. Poloha se ověří.</Caption>
      </AbsoluteFill>

      {/* aplikace: Ema fotí Dianu, server ověří polohu a fotku */}
      <div style={{ position: 'absolute', inset: 0, opacity: phone * (1 - card), transform: `translateX(${(1 - phone) * 700}px)` }}>
        <Phone w={PHONE.w} style={{ left: PHONE.left, top: PHONE.top }}>
          <Sequence from={PHONE_IN}>
            <OffthreadVideo src={staticFile(REC.file)} muted trimBefore={Math.max(0, Math.round(evt(REC, 'tap').t * 30) - (TAP - PHONE_IN))}
              style={{ width: '100%', height: '100%' }} />
          </Sequence>
          <Tap at={TAP} x={evt(REC, 'tap').x!} y={evt(REC, 'tap').y!} />
        </Phone>
        <SideText from={PHONE_IN + 4} to={LAND} sub="Fotka zůstane jen tvoje, nikde se nezveřejní.">Foť místo, ne lidi.</SideText>
      </div>

      {/* Pas: razítko dopadne, pak najedeme do něj */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: card, transform: `translateY(${thud}px)` }}>
        <div style={{
          width: 1100, height: 640, borderRadius: 28, background: `repeating-linear-gradient(transparent 0 39px, #d3dacb 39px 40px), ${C.paper}`,
          boxShadow: '0 40px 80px -30px rgb(0 0 0 / 0.6)', position: 'relative', transform: `scale(${(0.92 + card * 0.08) * (1 + push * 1.6)})`,
          opacity: 1 - push,
        }}>
          <div style={{ position: 'absolute', left: 44, top: 30, fontFamily: SANS, fontWeight: 800, fontSize: 36, color: C.spruce }}>Pas</div>
          <div style={{ position: 'absolute', left: 60, top: 140, transform: 'rotate(12deg)', opacity: 0.45 }}>
            <Stamp title="Hrad Loket" date="3. 10. 2026" icon="castle" size={190} color={C.blue} />
          </div>
          <div style={{ position: 'absolute', right: 70, bottom: 50, fontFamily: HAND, fontSize: 40, color: C.moss, opacity: interpolate(t, [10, 20], [0, 1], clamp) }}>
            razítko č. 12
          </div>
        </div>
      </AbsoluteFill>
      {/* stejné pozadí, jakým začíná zrození tvora */}
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 44%, color-mix(in oklab, #fff36b 6%, #0b1020), #05070d 72%)', opacity: push }} />
      {f >= LAND - 8 && (
        <div style={{
          position: 'absolute', left: 960 - 210, top: interpolate(push, [0, 1], [540, END_Y]) - 210,
          transform: `translateY(${thud}px) scale(${stampScale}) rotate(${stampRot}deg)`, opacity: interpolate(t, [-8, -3], [0, 1], clamp),
        }}>
          <Stamp title={HERO.place} date="9. 10. 2026" size={420} color={push > 0.5 ? '#e0574f' : C.red} />
        </div>
      )}
      <Caption from={LAND + 12} to={dur - PUSH + 6} y={930}>Razítko je tvoje.</Caption>
    </AbsoluteFill>
  );
}
