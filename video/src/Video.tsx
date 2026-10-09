import { AbsoluteFill, Html5Audio, Series, staticFile } from 'remotion';
import { Film } from './kit';
import { Hook } from './scenes/Hook';
import { Title } from './scenes/Title';
import { PetBirth } from './scenes/PetBirth';
import { TypeWheel } from './scenes/TypeWheel';
import { Finale } from './scenes/Finale';
import { Battle } from './scenes/Battle';
import { Impact, MapScene, Progress, StampScene } from './scenes/Pending';

// ponytail: až bude skladba, dát ji do public/ a sem její název; synchronizace je v časech scén níže
const MUSIC: string | null = null;

/**
 * Časová osa podle VIDEO_SCENAR.md (30 fps). Každá scéna je modul: nová featura = přestřihnout jednu scénu.
 * Odchylka od scénáře: titulek trvá do 0:21, aby hudební hit v 0:20 dopadl na ZÁPAD GO, mapa je o 1 s kratší.
 */
export const SCENES: [React.FC, number][] = [
  [Hook, 300],       // 0:00 hook
  [Title, 330],      // 0:10 průvodci a titulek
  [MapScene, 270],   // 0:21 mapa
  [StampScene, 360], // 0:30 razítko
  [PetBirth, 390],   // 0:42 zrození tvora
  [TypeWheel, 210],  // 0:55 typová věž
  [Battle, 390],     // 1:02 souboj
  [Progress, 300],   // 1:15 odznaky, questy, žebříček
  [Impact, 210],     // 1:25 dopad na region
  [Finale, 240],     // 1:32 finále
];
export const DURATION = SCENES.reduce((sum, [, d]) => sum + d, 0);

export function Video() {
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <style>{'.fill{position:absolute;inset:0;width:100%;height:100%}'}</style>
      <Series>
        {SCENES.map(([Scene, d], i) => <Series.Sequence key={i} durationInFrames={d}><Scene /></Series.Sequence>)}
      </Series>
      {MUSIC && <Html5Audio src={staticFile(MUSIC)} />}
      <Film />
    </AbsoluteFill>
  );
}
