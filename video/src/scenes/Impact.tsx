import { AbsoluteFill, Easing, interpolate, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import insightsRec from '../../public/rec/insights.json';
import { PHONE, Phone, SideText, clamp, type Rec } from '../kit';
import { Constellation, SKY } from './Finale';
import { PHONE_BG } from './MapScene';
import { ScreenSwap } from './Progress';

const REC = insightsRec as Rec;
const OUT = 30; // poslední snímky: telefon zmizí a místa kraje se rozsvítí jako souhvězdí finále

/** Scéna 9: anonymní statistiky návštěvnosti (insights), přechod do souhvězdí finále. */
export function Impact({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const bg = interpolate(f, [0, 12], [0, 1], clamp); // Pas/žebříček ze scény 8 v tom samém telefonu prosvítá
  const out = interpolate(f, [dur - OUT, dur], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: PHONE_BG, opacity: bg * (1 - out) }} />
      <AbsoluteFill style={{ background: SKY, opacity: out }} />
      <Constellation t={(f - (dur - OUT)) * 1.2} style={{ opacity: out }} />

      <div style={{ position: 'absolute', inset: 0, opacity: 1 - out, transform: `scale(${1 - out * 0.12})`, transformOrigin: `${PHONE.left + PHONE.w / 2}px 540px` }}>
        <Phone w={PHONE.w} style={{ left: PHONE.left, top: PHONE.top }} bare>
          <ScreenSwap at={0}>
            <OffthreadVideo src={staticFile(REC.file)} muted trimBefore={6} playbackRate={0.85} style={{ width: '100%', height: '100%' }} />
          </ScreenSwap>
        </Phone>
        <SideText from={12} to={118} sub="Za málo navštěvovaná místa je bonus ×1,5 XP, turisté se rozejdou po celém kraji.">
          Turisté dojdou i tam, kam se jinak nedostanou.
        </SideText>
        <SideText from={122} to={dur - OUT + 10} sub="Oceněné Dobroty Karlovarského kraje jsou místa na mapě. Data: datazapad.cz">
          A utratí to u místních.
        </SideText>
      </div>
    </AbsoluteFill>
  );
}
