import { AbsoluteFill, Html5Audio, interpolate, Sequence, staticFile } from 'remotion';
import { Film } from './kit';
import { Hook } from './scenes/Hook';
import { Title } from './scenes/Title';
import { MapScene } from './scenes/MapScene';
import { StampScene } from './scenes/StampScene';
import { PetBirth } from './scenes/PetBirth';
import { TypeWheel } from './scenes/TypeWheel';
import { Battle } from './scenes/Battle';
import { Progress } from './scenes/Progress';
import { Impact } from './scenes/Impact';
import { Finale } from './scenes/Finale';

export const F = 30;

/**
 * Časová osa (30 fps, 80 s) postavená na hudbě: skladba má fráze po 4 s (údery v 8,1 s, 12,1 s, … podle originálu).
 * Hudba se stříhá na hranicích frází, takže drop (originál 40,1 s) padne na začátek souboje
 * a závěrečný vrchol (originál 88,1 s) na finále.
 * `out` = kolik snímků scéna přesahuje do další (přechod), další scéna se kreslí přes ni.
 */
export const SCENES: { C: React.FC<{ dur: number }>; from: number; dur: number; out?: number }[] = [
  { C: Hook, from: 0, dur: 183 },               // 0:00 krajina, Loket, otázka
  { C: Title, from: 183, dur: 180 },            // 0:06,1 úder: průvodci a ZÁPAD GO
  { C: MapScene, from: 363, dur: 180, out: 10 }, // 0:12,1 piny po kategoriích, Diana
  { C: StampScene, from: 543, dur: 210 },       // 0:18,1 turista, razítko
  { C: PetBirth, from: 753, dur: 270 },         // 0:25,1 zrození tvora
  { C: TypeWheel, from: 1023, dur: 120 },       // 0:34,1 typová věž, náběh do dropu
  { C: Battle, from: 1143, dur: 360, out: 14 }, // 0:38,1 DROP: souboj
  { C: Progress, from: 1503, dur: 240, out: 12 }, // 0:50,1 Pas, úkoly, žebříček
  { C: Impact, from: 1743, dur: 240 },         // 0:58,1 co hráči objevují, přechod do souhvězdí
  { C: Finale, from: 1983, dur: 417 },          // 1:06,1 vrchol: souhvězdí, logo, QR
];
export const DURATION = 2400;

const MUSIC = 'Sovereign_of_the_High_Peak.mp3';
const XF = 4; // prolnutí na střihu hudby (snímky)
/** Úseky skladby v sekundách originálu: [od, do]. Střihy na hranicích frází. */
const CUTS: [number, number][] = [[2.0, 68.1], [88.1, 96.1], [100.1, 106.0]];

function Music() {
  let at = 0;
  return (
    <>
      {CUTS.map(([a, b], i) => {
        const len = Math.round((b - a) * F);
        const pre = i ? XF : 0; // další úsek začne o XF dřív a prolne se
        const seq = (
          <Sequence key={i} from={at - pre} durationInFrames={len + pre}>
            <Html5Audio src={staticFile(MUSIC)} trimBefore={Math.round(a * F) - pre}
              volume={(f) => Math.min(interpolate(f, [0, pre || 1], [pre ? 0 : 1, 1], { extrapolateRight: 'clamp' }),
                i < CUTS.length - 1 ? interpolate(f, [len + pre - XF, len + pre], [1, 0], { extrapolateLeft: 'clamp' }) : 1)} />
          </Sequence>
        );
        at += len;
        return seq;
      })}
    </>
  );
}

export function Video() {
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <style>{'.fill{position:absolute;inset:0;width:100%;height:100%}'}</style>
      {SCENES.map(({ C, from, dur, out = 0 }, i) => (
        <Sequence key={i} from={from} durationInFrames={dur + out}><C dur={dur} /></Sequence>
      ))}
      <Music />
      <Film />
    </AbsoluteFill>
  );
}
