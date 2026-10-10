import { AbsoluteFill, Easing, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { Bus } from 'lucide-react';
import mapRec from '../../public/rec/map.json';
import { C, Logo, PHONE, Phone, SANS, SideText, Tap, clamp, easeOut, type Rec } from '../kit';
import { TITLE_LOGO } from './Title';

const REC = mapRec as Rec;
const START = 16, RATE = 1.25; // záznam běží o něco rychleji, ať se karta Diany vejde do 6 s
const local = (t: number) => START + (t * 30) / RATE;

/** Pozadí scén s telefonem. */
export const PHONE_BG = `radial-gradient(circle at 70% 45%, #24372c, ${C.night} 70%)`;

/** Scéna 3: logo z titulku předá místo telefonu, piny přibývají po kategoriích, přiblížení na Dianu, karta místa. */
export function MapScene({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const handoff = interpolate(f, [0, 16], [0, 1], { ...clamp, easing: easeOut });
  const rise = interpolate(f, [4, 26], [1, 0], { ...clamp, easing: easeOut });
  // průlet do displeje do další scény
  const dive = interpolate(f, [dur - 8, dur + 10], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const bus = interpolate(f, [112, 126], [0, 1], { ...clamp, easing: easeOut });

  return (
    <AbsoluteFill style={{ background: PHONE_BG, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: C.spruce, opacity: 1 - handoff }} />
      {/* logo a podtitul přesně tam, kde skončil titulek, pak odjedou */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: 1 - handoff, transform: `translateY(${-handoff * 120}px) scale(${1 - handoff * 0.25})` }}>
        <Logo size={TITLE_LOGO} />
        <div style={{ marginTop: 34, fontFamily: SANS, fontSize: 58, color: C.cream, opacity: 0.85 }}>Kraj, který se dá sbírat.</div>
      </AbsoluteFill>

      <div style={{
        position: 'absolute', inset: 0, transformOrigin: `${PHONE.left + PHONE.w / 2}px 620px`,
        transform: `translateY(${rise * 1000}px) scale(${1 + dive * 2.2})`, filter: `blur(${dive * 6}px)`,
      }}>
        <Phone w={PHONE.w} style={{ left: PHONE.left, top: PHONE.top }}>
          <Sequence from={START}>
            <OffthreadVideo src={staticFile(REC.file)} muted playbackRate={RATE} style={{ width: '100%', height: '100%' }} />
          </Sequence>
          {REC.events.filter((e) => e.x != null && e.x < 1).map((e) => (
            <Tap key={e.name} at={Math.round(local(e.t))} x={e.x!} y={e.y!} />
          ))}
        </Phone>
      </div>

      <SideText from={22} to={108} sub="Hrady, rozhledny, prameny, kultura i Dobroty kraje. Data: datazapad.cz">
        617 míst z otevřených dat kraje.
      </SideText>
      <SideText from={112} to={dur} sub="U každého místa najdeš nejbližší autobusovou zastávku.">
        Bez auta? Taky to jde.
      </SideText>
      <div style={{
        position: 'absolute', left: 170, top: 700, display: 'flex', alignItems: 'center', gap: 18, padding: '18px 26px', borderRadius: 22,
        background: 'rgb(246 248 241 / 0.08)', border: '1px solid rgb(246 248 241 / 0.18)', fontFamily: SANS, color: C.cream, fontSize: 30,
        opacity: bus * (1 - dive), transform: `translateY(${(1 - bus) * 20}px)`,
      }}>
        <Bus size={40} color={C.cream} strokeWidth={2} />
        <span>Rozhledna Diana: zastávka <b>Karlovy Vary, Gejzírpark</b>, 603 m</span>
      </div>
    </AbsoluteFill>
  );
}
