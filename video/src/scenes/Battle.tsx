import { AbsoluteFill, Easing, interpolate, OffthreadVideo, random, Sequence, staticFile, useCurrentFrame } from 'remotion';
import phonesRec from '../../public/rec/battle-phones.json';
import hdA from '../../public/rec/battle-a.json';
import hdB from '../../public/rec/battle-b.json';
import { C, Caption, Phone, SANS, clamp, easeOut } from '../kit';

/*
 * Scéna 7 ze skutečného souboje (scripts/record-battle.mjs): Bára (Vyhlídal) a Kuba (Baštoun), hodnocený matchmaking.
 * Střihy jsou navázané na události v záznamu (ťuknutí, tahy), takže po přenahrání sedí samy.
 */
type Side = 'a' | 'b';
type Rec = { videos: Partial<Record<Side, { file: string }>>; events: { name: string; x?: number; y?: number; [k: string]: unknown }[] };
const ev = (rec: Rec, name: string) => rec.events.find((e) => e.name === name)!;
/** Čas události v sekundách videa daného hráče. */
const at = (rec: Rec, name: string, side: Side) => ev(rec, name)[`t_${side}`] as number;
const F = 30;

// 7.2: kouzla ve 3×, aréna přes celou obrazovku. off = sekundy od ťuknutí druhého hráče v kole, d = délka ve snímcích,
// y = výřez (0 nahoře, 1 dole). Zásah KO padne na hudební akcent (originál 48,1 s).
const CLIPS: { side: Side; turn: string; off: number; d: number; rate?: number; y: number }[] = [
  { side: 'a', turn: 'turn1_b_rockfall', off: 0.25, d: 40, y: 0.1 },      // Blesk z výšin, kritický zásah
  { side: 'b', turn: 'turn2_b_siege_fire', off: 2.3, d: 45, y: 0.35 },    // Ohnivá střela z hradeb, velmi účinné
  { side: 'a', turn: 'turn3_b_rockfall', off: 0.5, d: 39, y: 0.4 },       // Sluneční paprsek
  { side: 'b', turn: 'turn6_b_siege_fire', off: 2.0, d: 116, rate: 0.5, y: 0 }, // KO ve zpomalení, HP bar na nulu
];
const HD = { a: hdA as Rec, b: hdB as Rec };
const PHONES = phonesRec as Rec;
const MONTAGE = 60, END = 300;
const FLASH = 0; // drop: blesk „Soupeř nalezen“, rovnou obě arény (Pixi scéna se v dev buildu staví ~7 s, to přeskočíme)

/** Scéna 7: drop, soupeř nalezen na dvou telefonech, střih kouzel, vítězství s konfetami. */
export function Battle({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const drop = interpolate(f, [dur - 2, dur + 12], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) }); // telefony odjedou dolů
  let from = MONTAGE;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, ${C.spruce}, ${C.night} 75%)`, overflow: 'hidden' }}>
      <Sequence durationInFrames={MONTAGE}><TwoPhones shots={[{ at: 0, cue: 'turn1_a_thunder', lead: 1.3 }]} match /></Sequence>
      {CLIPS.map((c) => {
        const s = <Sequence key={c.turn + c.side} from={from} durationInFrames={c.d}><Clip {...c} frames={c.d} /></Sequence>;
        from += c.d;
        return s;
      })}
      <Sequence from={END}>
        <div style={{ position: 'absolute', inset: 0, transform: `translateY(${drop * 1100}px)` }}><TwoPhones shots={[{ at: 0, cue: 'end', lead: 0.5 }]} /></div>
        <Confetti />
      </Sequence>

      <Caption from={4} to={MONTAGE - 2} y={950} size={56}>Souboj v reálném čase.</Caption>
      <Caption from={END + 2} to={dur + 10} y={950} size={56}>Každý tah počítá server. Nikdo nepodvádí.</Caption>
      {f >= MONTAGE && f < END && <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 220px rgb(0 0 0 / 0.55)' }} />}
      <AbsoluteFill style={{ background: '#fff', opacity: interpolate(f, [0, 8], [0.85, 0], clamp) }} />
    </AbsoluteFill>
  );
}

/** Oba telefony vedle sebe. Každý záběr (shot) od snímku `at` ukazuje záznam od `lead` s před událostí `cue`. */
function TwoPhones({ shots, match }: { shots: { at: number; cue: string; lead: number }[]; match?: boolean }) {
  const f = useCurrentFrame();
  const W = 380;
  const bolt = interpolate(f - FLASH, [-2, 1, 12], [0, 1, 0], clamp);
  const pill = interpolate(f - FLASH, [0, 8], [0, 1], { ...clamp, easing: easeOut });
  return (
    <AbsoluteFill>
      {(['a', 'b'] as Side[]).map((side, i) => (
        // na konci je vítěz (Kuba, vpravo) v popředí
        <Phone key={side} w={W} style={{
          left: 960 + (i ? 70 : -70 - W - 2 * W * 0.035), top: 60,
          ...(!match && { transform: `scale(${i ? 1.04 : 0.96})`, opacity: i ? 1 : 0.7 }),
        }}>
          {shots.map((s, j) => (
            <Sequence key={j} from={s.at} durationInFrames={shots[j + 1] ? shots[j + 1].at - s.at : undefined}>
              <OffthreadVideo src={staticFile(PHONES.videos[side]!.file)} muted
                trimBefore={Math.max(0, Math.round((at(PHONES, s.cue, side) - s.lead) * F))}
                style={{ width: '100%', height: '100%' }} />
            </Sequence>
          ))}
        </Phone>
      ))}
      {match && (
        <>
          <svg width="1920" height="1080" style={{ position: 'absolute', opacity: bolt }}>
            <path d="M960 120L915 380 985 400 925 640 1005 660 950 960" fill="none" stroke="#fff6c8" strokeWidth="14" strokeLinejoin="bevel"
              style={{ filter: `drop-shadow(0 0 22px ${C.yellow}) drop-shadow(0 0 50px ${C.yellow})` }} />
          </svg>
          <AbsoluteFill style={{ background: '#fff', opacity: bolt * 0.35 }} />
          <div style={{
            position: 'absolute', left: 960, top: 470, transform: `translate(-50%, -50%) scale(${0.6 + pill * 0.4})`, opacity: pill,
            padding: '16px 34px', borderRadius: 999, background: C.yellow, color: C.spruce, fontFamily: SANS, fontWeight: 800, fontSize: 40, whiteSpace: 'nowrap',
            boxShadow: '0 20px 50px -10px rgb(0 0 0 / 0.6)',
          }}>Soupeř nalezen</div>
        </>
      )}
    </AbsoluteFill>
  );
}

/** Jedno kouzlo z HD záznamu: aréna roztažená na šířku obrazu, mírný najezd a záblesk na střihu. */
function Clip({ side, turn, off, rate = 1, y, frames }: (typeof CLIPS)[number] & { frames: number }) {
  const f = useCurrentFrame();
  const k = 1920 / 1236; // HD záznam je 1236 × 2676
  const arenaTop = 300 * k, arenaH = 876 * k;
  const top = arenaTop + y * (arenaH - 1080);
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${interpolate(f, [0, frames], [1, 1.06])})` }}>
        <OffthreadVideo src={staticFile(HD[side].videos[side]!.file)} muted playbackRate={rate}
          trimBefore={Math.round((at(HD[side], turn, side) + off) * F)}
          style={{ position: 'absolute', left: 0, top: -top, width: 1920, height: 2676 * k }} />
      </div>
      <AbsoluteFill style={{ background: '#fff', opacity: interpolate(f, [0, 4], [0.55, 0], clamp) }} />
    </AbsoluteFill>
  );
}

/** Konfety v barvách turistických značek. `offset` = navázání v další scéně (padají dál). */
export function Confetti({ offset = 0 }: { offset?: number }) {
  const f = useCurrentFrame() + offset;
  const colors = [C.red, C.blue, C.green, C.yellow, C.cream];
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: 90 }, (_, i) => {
        const x = random(`x${i}`) * 1920, delay = random(`d${i}`) * 20, speed = 9 + random(`s${i}`) * 9;
        const t = f - delay;
        if (t < 0) return null;
        return (
          <div key={i} style={{
            position: 'absolute', left: x + Math.sin(t / 8 + i) * 30, top: -40 + t * speed, width: 14, height: 22, borderRadius: 3,
            background: colors[i % colors.length], transform: `rotate(${t * (6 + (i % 7))}deg) rotateX(${t * 9}deg)`,
          }} />
        );
      })}
    </AbsoluteFill>
  );
}
