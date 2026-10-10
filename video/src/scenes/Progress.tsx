import { AbsoluteFill, Easing, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import passRec from '../../public/rec/pass.json';
import lbRec from '../../public/rec/leaderboard.json';
import { PHONE, Phone, SideText, Tap, clamp, easeOut, type Rec } from '../kit';
import { Confetti } from './Battle';
import { PHONE_BG } from './MapScene';

const PASS = passRec as Rec, LB = lbRec as Rec;
const SWAP = 118; // Pas → žebříček (obsah se v telefonu přetáhne)

/** Swipe obsahu v jednom telefonu: nová obrazovka přijede zprava. */
export function ScreenSwap({ at, children }: { at: number; children: React.ReactNode }) {
  const p = interpolate(useCurrentFrame(), [at, at + 12], [100, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  return <AbsoluteFill style={{ clipPath: `inset(0 0 0 ${p}%)`, transform: `translateX(${p * 0.35}%)` }}>{children}</AbsoluteFill>;
}

/** Scéna 8: Pas se razítky, úkoly a odznaky, pak žebříček škol a týmů. Konfety ze souboje ještě dopadají. */
export function Progress({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const bg = interpolate(f, [0, 14], [0, 1], clamp); // souboj (telefony padají dolů) prosvítá
  const rise = interpolate(f, [0, 22], [1, 0], { ...clamp, easing: easeOut });
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: PHONE_BG, opacity: bg }} />
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${rise * 1100}px)` }}>
        <Phone w={PHONE.w} style={{ left: PHONE.left, top: PHONE.top }}>
          <OffthreadVideo src={staticFile(PASS.file)} muted trimBefore={12} playbackRate={1.3} style={{ width: '100%', height: '100%' }} />
          <Sequence from={SWAP}>
            <ScreenSwap at={0}>
              <OffthreadVideo src={staticFile(LB.file)} muted style={{ width: '100%', height: '100%' }} />
            </ScreenSwap>
          </Sequence>
          {LB.events.map((e) => <Tap key={e.name} at={SWAP + Math.round(e.t * 30)} x={e.x!} y={e.y!} />)}
        </Phone>
      </div>
      <SideText from={16} to={SWAP} sub="Místo dne, tři místa týdně, Ochutnej Dobrotu. Za splněné úkoly odznaky a vzácnější tvorové.">
        Každý den nový důvod vyrazit.
      </SideText>
      <SideText from={SWAP + 6} to={dur} sub="Žebříček hráčů, škol i týmů. Tvoje třída proti ostatním.">
        Soutěž s kamarády, ne s obrazovkou.
      </SideText>
      {f < 80 && <Confetti offset={60} />}
    </AbsoluteFill>
  );
}
