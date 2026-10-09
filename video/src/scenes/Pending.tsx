import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { C, Caption, HAND, Pending, SANS, Stamp, clamp } from '../kit';
import { HERO } from './PetBirth';

/*
 * Scény, které stojí na živém záznamu aplikace (Playwright / telefon, natáčí se po feature freeze).
 * Titulky už jsou v čase podle scénáře; záznam se vloží jako <OffthreadVideo> pod ně.
 */
const s = (sec: number) => Math.round(sec * 30);
const DATA = 'Data: datazapad.cz, otevřená data Karlovarského kraje';

export const MapScene = () => (
  <Pending label="ZÁZNAM: /map, piny podle kategorií → karta místa se zastávkou → palec na Vyrazit (v mockupu telefonu)">
    <Caption from={s(0.3)} to={s(4)} small={DATA}>617 míst z otevřených dat kraje.</Caption>
    <Caption from={s(4)} to={s(7)}>Bez auta? Taky to jde.</Caption>
  </Pending>
);

/** 4.3 razítko dopadne na stránku Pasu, zbytek je terénní záběr a záznam focení. */
export function StampScene() {
  const f = useCurrentFrame();
  const land = s(8);
  const t = f - land;
  // stamp-down z globals.css, zpomalené na slow-mo
  const scale = interpolate(t, [0, 14, 20], [1.7, 0.96, 1], clamp);
  const rot = interpolate(t, [0, 14, 20], [-14, -7, -8], clamp);
  const thud = t >= 14 && t < 22 ? Math.sin(t * 3) * (22 - t) * 0.8 : 0;
  return (
    <Pending label="ZÁZNAM: člověk zezadu stoupá k rozhledně + kruh 300 m; pak screen Vyfotit místo a ověření polohy">
      {f >= land - 8 && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: interpolate(t, [-8, 0], [0, 1], clamp), transform: `translateY(${thud}px)` }}>
          <div style={{
            width: 1100, height: 640, borderRadius: 28, background: `repeating-linear-gradient(transparent 0 39px, #d3dacb 39px 40px), ${C.paper}`,
            boxShadow: '0 40px 80px -30px rgb(0 0 0 / 0.6)', position: 'relative', display: 'grid', placeItems: 'center',
          }}>
            <div style={{ position: 'absolute', left: 44, top: 30, fontFamily: SANS, fontWeight: 800, fontSize: 36, color: C.spruce }}>Pas</div>
            <div style={{ position: 'absolute', left: 60, top: 140, transform: 'rotate(12deg)', opacity: 0.45 }}>
              <Stamp title="Hrad Loket" date="3. 10. 2026" icon="castle" size={190} color={C.blue} />
            </div>
            <div style={{ transform: `scale(${scale}) rotate(${rot}deg)`, opacity: interpolate(t, [0, 6], [0, 1], clamp) }}>
              <Stamp title={HERO.place} date="9. 10. 2026" size={420} />
            </div>
            <div style={{ position: 'absolute', right: 70, bottom: 50, fontFamily: HAND, fontSize: 40, color: C.moss, opacity: interpolate(t, [24, 34], [0, 1], clamp) }}>
              razítko č. 12
            </div>
          </div>
        </AbsoluteFill>
      )}
      <Caption from={s(0.4)} to={s(4)} size={52}>Foť místo, ne lidi.</Caption>
      <Caption from={s(4)} to={s(8)}>Dojdi blíž než 300 m. Poloha se ověří.</Caption>
      <Caption from={land + 16} to={s(12)} y={900}>Razítko je tvoje.</Caption>
    </Pending>
  );
}

export const Progress = () => (
  <Pending label="ZÁZNAM: Pas se plní, odznaky Hradní pán, Rozhledník, Pramenař, Dobrotník; questy; týmový žebříček">
    <Caption from={s(4)} to={s(7)}>Každý den nový důvod vyrazit.</Caption>
    <Caption from={s(7)} to={s(10)}>Soutěž s kamarády, ne s obrazovkou.</Caption>
  </Pending>
);

export const Impact = () => (
  <Pending label="ZÁZNAM: /insights, kategorie a okresy podle návštěvnosti, skok na místo Dobroty">
    <Caption from={s(0.3)} to={s(7)} size={60} small="Data: datazapad.cz, Dobroty Karlovarského kraje">
      Turisté dojdou i tam, kam se jinak nedostanou. A utratí to u místních.
    </Caption>
  </Pending>
);
