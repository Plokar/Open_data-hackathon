/**
 * 2.5D bojová scéna (PixiJS v8 + pixi-filters + GSAP).
 * Soupeři stojí vzadu na menších plošinách a jsou vidět zepředu, ty (a spojenec ve 2v2) vpředu zezadu, jako v Pokémonech.
 * Bojovníci jsou ve slotech a–d (1v1, všichni proti všem, 2v2, boss).
 * Každý tah má `fx` z backendu (engine.MOVES) a barvy podle živlu útočníka.
 * Scéna je čistě vizuální: stav boje drží server, sem jdou jen události tahu.
 */
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { AdvancedBloomFilter, ColorOverlayFilter, GlowFilter, ShockwaveFilter } from 'pixi-filters';
import gsap from 'gsap';
import type { BattleFighter, PetType, TurnEvent } from './api';
import { petDataUrl } from './petArt';

export const W = 480;
export const H = 340;
type Side = string; // slot a–d
type Pt = { x: number; y: number };

const ELEMENT: Record<PetType, { main: number; alt: number; hot: number; shape: Shape; sky: [string, string, string]; hills: [string, string, string] }> = {
  fortress: { main: 0xff7a1a, alt: 0xffd27a, hot: 0xfff1d6, shape: 'shard', sky: ['#2a1b3d', '#a8483a', '#f6b26b'], hills: ['#5d3a4a', '#4a2f3a', '#3a2530'] },
  view: { main: 0xfff36b, alt: 0x9fd8ff, hot: 0xffffff, shape: 'spark', sky: ['#1e4a8c', '#5aa7e0', '#cfeafc'], hills: ['#7fa6c9', '#5b86ad', '#3f6b8f'] },
  nature: { main: 0xa3ff5c, alt: 0x2fbf4a, hot: 0xf9a8d4, shape: 'leaf', sky: ['#0f3b2e', '#3f8f5f', '#c8eab0'], hills: ['#3d7a4f', '#2c5e3b', '#1d452b'] },
  spring: { main: 0x5ce1ff, alt: 0x2b8cff, hot: 0xffffff, shape: 'drop', sky: ['#0b3954', '#1f8a9e', '#bdf1ef'], hills: ['#3a8fa0', '#2a7182', '#1c5563'] },
  culture: { main: 0xd58bff, alt: 0xffd84d, hot: 0xffffff, shape: 'note', sky: ['#120c2e', '#4a2a7a', '#c48fd9'], hills: ['#4b3470', '#38265a', '#271a42'] },
  taste: { main: 0xffb347, alt: 0xff6fae, hot: 0xfff1c1, shape: 'heart', sky: ['#4a1d3d', '#d8608a', '#ffd6a5'], hills: ['#b4567a', '#8e3f60', '#6a2c48'] },
};
type Shape = 'soft' | 'spark' | 'shard' | 'leaf' | 'drop' | 'note' | 'heart' | 'ring';

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wait = (s: number) => new Promise<void>((r) => gsap.delayedCall(s, r));

// ── Textury částic (bílé, barví se tintem) ───────────────────────────────────
function canvasTex(draw: (c: CanvasRenderingContext2D, s: number) => void, s = 64) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#fff';
  c.strokeStyle = '#fff';
  draw(c, s);
  return Texture.from(cv);
}

function makeTextures(): Record<Shape, Texture> {
  return {
    soft: canvasTex((c, s) => {
      const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
    }),
    spark: canvasTex((c, s) => {
      const m = s / 2;
      c.beginPath();
      c.moveTo(m, 0); c.quadraticCurveTo(m, m, s, m); c.quadraticCurveTo(m, m, m, s); c.quadraticCurveTo(m, m, 0, m); c.quadraticCurveTo(m, m, m, 0);
      c.fill();
    }),
    shard: canvasTex((c, s) => {
      c.beginPath();
      c.moveTo(s * 0.3, s * 0.05); c.lineTo(s * 0.85, s * 0.25); c.lineTo(s * 0.95, s * 0.7); c.lineTo(s * 0.45, s * 0.95); c.lineTo(s * 0.08, s * 0.6);
      c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.beginPath(); c.moveTo(s * 0.45, s * 0.95); c.lineTo(s * 0.95, s * 0.7); c.lineTo(s * 0.55, s * 0.5); c.closePath(); c.fill();
    }),
    leaf: canvasTex((c, s) => {
      c.beginPath();
      c.moveTo(s * 0.1, s * 0.9); c.bezierCurveTo(s * 0.1, s * 0.3, s * 0.6, s * 0.05, s * 0.95, s * 0.05);
      c.bezierCurveTo(s * 0.95, s * 0.5, s * 0.6, s * 0.95, s * 0.1, s * 0.9); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(s * 0.15, s * 0.85); c.lineTo(s * 0.8, s * 0.2); c.stroke();
    }),
    drop: canvasTex((c, s) => {
      c.beginPath();
      c.moveTo(s / 2, s * 0.02); c.bezierCurveTo(s * 0.85, s * 0.45, s * 0.85, s * 0.95, s / 2, s * 0.95);
      c.bezierCurveTo(s * 0.15, s * 0.95, s * 0.15, s * 0.45, s / 2, s * 0.02); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.arc(s * 0.58, s * 0.7, s * 0.16, 0, 7); c.fill();
    }),
    note: canvasTex((c, s) => {
      c.font = `900 ${s * 0.9}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('♪', s / 2, s / 2);
    }),
    heart: canvasTex((c, s) => {
      c.beginPath();
      c.moveTo(s / 2, s * 0.9); c.bezierCurveTo(s * -0.1, s * 0.45, s * 0.25, s * 0.0, s / 2, s * 0.3);
      c.bezierCurveTo(s * 0.75, s * 0.0, s * 1.1, s * 0.45, s / 2, s * 0.9); c.fill();
    }),
    ring: canvasTex((c, s) => { c.lineWidth = s * 0.08; c.beginPath(); c.arc(s / 2, s / 2, s * 0.42, 0, 7); c.stroke(); }),
  };
}

// ── Pozadí podle živlu soupeře (kopce, mlha, perspektiva země) ─────────────
function drawBackground(type: PetType, PAD: number) {
  const e = ELEMENT[type];
  const cv = document.createElement('canvas');
  const w = (cv.width = W + PAD * 2), h = (cv.height = H + PAD * 2);
  const c = cv.getContext('2d')!;
  const horizon = PAD + 150;
  const sky = c.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, e.sky[0]); sky.addColorStop(0.65, e.sky[1]); sky.addColorStop(1, e.sky[2]);
  c.fillStyle = sky; c.fillRect(0, 0, w, h);
  const sun = c.createRadialGradient(w * 0.2, PAD + 40, 0, w * 0.2, PAD + 40, 110);
  sun.addColorStop(0, 'rgba(255,255,240,0.9)'); sun.addColorStop(0.12, 'rgba(255,250,220,0.65)'); sun.addColorStop(1, 'rgba(255,240,200,0)');
  c.fillStyle = sun; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 46; i++) { const s = Math.random() < 0.2 ? 2 : 1.2; c.fillRect(Math.random() * w, Math.random() * horizon * 0.55, s, s); }
  e.hills.forEach((col, i) => {
    const base = horizon - 34 + i * 16;
    c.fillStyle = col;
    c.beginPath(); c.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) c.lineTo(x, base - Math.sin(x / (60 + i * 35) + i * 2) * (22 - i * 5) - Math.sin(x / 19 + i) * 3);
    c.lineTo(w, h); c.fill();
    if (i === 2) for (let x = 6; x < w; x += rand(10, 26)) {
      const y = base - Math.sin(x / 130 + 4) * 12 - Math.sin(x / 19 + 2) * 3;
      const th = rand(12, 22);
      c.beginPath(); c.moveTo(x, y - th); c.lineTo(x + th * 0.32, y + 2); c.lineTo(x - th * 0.32, y + 2); c.fill();
    }
  });
  const g = c.createLinearGradient(0, horizon, 0, h);
  g.addColorStop(0, '#7a9a55'); g.addColorStop(1, '#2f4a24');
  c.fillStyle = g; c.fillRect(0, horizon + 6, w, h);
  c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 2;
  for (let i = -14; i <= 14; i++) { c.beginPath(); c.moveTo(w / 2 + i * 14, horizon + 6); c.lineTo(w / 2 + i * 110, h); c.stroke(); }
  const fog = c.createLinearGradient(0, horizon - 30, 0, horizon + 30);
  fog.addColorStop(0, 'rgba(255,255,255,0)'); fog.addColorStop(0.5, 'rgba(255,255,255,0.22)'); fog.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = fog; c.fillRect(0, horizon - 30, w, 60);
  const vig = c.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.45)');
  c.fillStyle = vig; c.fillRect(0, 0, w, h);
  return Texture.from(cv);
}

// ── Částice ──────────────────────────────────────────────────────────────────
interface Particle { s: Sprite; vx: number; vy: number; g: number; drag: number; life: number; max: number; spin: number; grow: number; s0: number }
interface Emit {
  count: number; shape?: Shape; colors: number[]; speed?: [number, number]; angle?: [number, number]; life?: [number, number];
  scale?: [number, number]; gravity?: number; drag?: number; spin?: number; grow?: number; spread?: number; add?: boolean;
}

class Particles {
  list: Particle[] = [];
  off = false;
  constructor(private layer: Container, private tex: Record<Shape, Texture>) {}

  emit(x: number, y: number, o: Emit) {
    if (this.off) return;
    for (let i = 0; i < o.count; i++) {
      const s = new Sprite(this.tex[o.shape ?? 'soft']);
      s.anchor.set(0.5);
      s.tint = o.colors[i % o.colors.length];
      s.blendMode = o.add === false ? 'normal' : 'add';
      const sp = o.spread ?? 0;
      s.position.set(x + rand(-sp, sp), y + rand(-sp, sp));
      const sc = rand(...(o.scale ?? [0.2, 0.5]));
      s.scale.set(sc);
      s.rotation = rand(0, Math.PI * 2);
      const a = rand(...(o.angle ?? [0, 360])) * (Math.PI / 180);
      const v = rand(...(o.speed ?? [60, 220]));
      const life = rand(...(o.life ?? [0.4, 0.9]));
      this.layer.addChild(s);
      this.list.push({ s, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: o.gravity ?? 0, drag: o.drag ?? 1.5, life, max: life, spin: rand(-1, 1) * (o.spin ?? 4), grow: o.grow ?? -0.6, s0: sc });
    }
  }

  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.s.destroy();
        this.list.splice(i, 1);
        continue;
      }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy = p.vy * k + p.g * dt;
      p.s.x += p.vx * dt; p.s.y += p.vy * dt;
      p.s.rotation += p.spin * dt;
      const t = 1 - p.life / p.max;
      p.s.scale.set(Math.max(0.01, p.s0 * (1 + p.grow * t)));
      p.s.alpha = t < 0.15 ? t / 0.15 : 1 - Math.max(0, (t - 0.5) / 0.5);
    }
  }
}

// ── Bojovník ─────────────────────────────────────────────────────────────────
interface Fighter {
  side: Side; front: boolean; info: BattleFighter; group: Container; sprite: Sprite; size: number; base: Pt;
  overlay: ColorOverlayFilter; glow: GlowFilter; idle: gsap.core.Tween; el: (typeof ELEMENT)[PetType];
}
const center = (f: Fighter): Pt => ({ x: f.group.x + f.sprite.x, y: f.group.y + f.sprite.y - f.size * 0.4 });
const feet = (f: Fighter): Pt => ({ x: f.group.x + f.sprite.x, y: f.group.y + f.sprite.y });

async function petTexture(info: BattleFighter, back: boolean) {
  const img = new Image();
  img.src = petDataUrl({ type: info.type, type2: info.type2 || '', seed: info.seed, stage: info.stage ?? 1, rarity: info.rarity ?? 'common', back, shadow: false });
  await img.decode();
  return Texture.from(img);
}

export interface Hooks {
  say: (text: string) => void;
  change: (side: Side, delta: { hp?: number; sp?: number }) => void;
}

export class BattleScene {
  private app = new Application();
  private shake = new Container();
  private world = new Container();
  private dim = new Graphics();
  private fx = new Container();
  private texts = new Container();
  private tex!: Record<Shape, Texture>;
  private parts!: Particles;
  private f: Record<Side, Fighter> = {};
  private dead = false;

  static async create(el: HTMLElement, fighters: BattleFighter[]) {
    const s = new BattleScene();
    await s.app.init({ width: W, height: H, antialias: true, backgroundAlpha: 0, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true });
    s.app.canvas.style.width = '100%';
    s.app.canvas.style.height = 'auto';
    s.app.canvas.style.display = 'block';
    el.appendChild(s.app.canvas);
    await s.build(fighters);
    return s;
  }

  destroy() {
    this.dead = true;
    // Vlastní seznam animací: gsap.killTweensOf nezabije tweeny, které ještě nezačaly,
    // a ty by pak v globálním tickeru sahaly na zničené objekty a zastavily i jiné scény.
    this.anims.forEach((a) => a.kill());
    if (this.parts) this.parts.off = true;
    this.app.destroy(true, { children: true, texture: false });
  }

  private anims: gsap.core.Animation[] = [];
  private keep<T extends gsap.core.Animation>(a: T) {
    if (this.anims.length > 300) this.anims = this.anims.filter((x) => x.isActive() || x.progress() < 1);
    this.anims.push(a);
    return a;
  }
  private to = (t: gsap.TweenTarget, v: gsap.TweenVars) => this.keep(gsap.to(t, v));
  private fromTo = (t: gsap.TweenTarget, a: gsap.TweenVars, b: gsap.TweenVars) => this.keep(gsap.fromTo(t, a, b));
  private timeline = (v?: gsap.TimelineVars) => this.keep(gsap.timeline(v));

  private async build(list: BattleFighter[]) {
    this.tex = makeTextures();
    const stage = this.app.stage;
    stage.addChild(this.shake);
    this.shake.addChild(this.world);
    this.shake.filterArea = this.app.screen;
    this.world.pivot.set(W / 2, H / 2);
    this.world.position.set(W / 2, H / 2);

    const front = [...list.filter((f) => f.me), ...list.filter((f) => f.ally && !f.me)];
    const back = list.filter((f) => !f.ally && !f.me);
    const bg = new Sprite(drawBackground((back[0] ?? list[0]).type, 50));
    bg.position.set(-50, -50);
    this.world.addChild(bg);
    this.dim.rect(-60, -60, W + 120, H + 120).fill(0x000010);
    this.dim.alpha = 0;
    this.world.addChild(this.dim);

    const mk = (info: BattleFighter, isFront: boolean, t: Texture, x: number, y: number, size: number, prx: number): Fighter => {
      const group = new Container();
      group.position.set(x, y);
      const plat = new Graphics();
      plat.ellipse(0, 6, prx + 10, prx * 0.27 + 4).fill({ color: 0x000000, alpha: 0.25 });
      plat.ellipse(0, 0, prx, prx * 0.26).fill(info.boss ? 0x6b3b4f : 0x8fae6a).stroke({ color: info.boss ? 0x3a1d2a : 0x4f6b37, width: 3 });
      plat.ellipse(0, -3, prx * 0.8, prx * 0.19).fill({ color: info.boss ? 0xff9a6b : 0xc7dca0, alpha: 0.55 });
      plat.ellipse(-prx * 0.3, -6, prx * 0.25, prx * 0.06).fill({ color: 0xffffff, alpha: 0.25 });
      group.addChild(plat);
      const el = ELEMENT[info.type];
      if (info.boss) {  // boss: pulzující aura za tělem
        const aura = new Sprite(this.tex.soft);
        aura.anchor.set(0.5); aura.tint = el.main; aura.blendMode = 'add'; aura.position.set(0, -size * 0.42); aura.scale.set(size / 30);
        group.addChild(aura);
        this.to(aura, { alpha: 0.35, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      }
      const sprite = new Sprite(t);
      sprite.anchor.set(0.5, 0.93);
      sprite.width = sprite.height = size;
      if (info.hp <= 0) sprite.alpha = 0;  // po reconnectu už padlý
      const overlay = new ColorOverlayFilter({ color: 0xffffff, alpha: 0 });
      const glow = new GlowFilter({ distance: 14, outerStrength: 0, innerStrength: 0, color: el.main, quality: 0.2 });
      sprite.filters = [overlay, glow];
      group.addChild(sprite);
      const sc = sprite.scale.x;
      const idle = this.to(sprite.scale, { y: sc * 1.035, x: sc * 0.985, duration: rand(1.1, 1.5), yoyo: true, repeat: -1, ease: 'sine.inOut' });
      return { side: info.slot, front: isFront, info, group, sprite, size, base: { x, y }, overlay, glow, idle, el };
    };
    // Rozestavení: vzadu 1–2 soupeři (boss větší), vpředu ty a případně spojenec
    const BACK = back.length === 1
      ? [back[0].boss ? [345, 168, 196, 116] : [340, 158, 150, 92]]
      : [[292, 150, 126, 78], [410, 178, 132, 80]];
    const FRONT = front.length === 1 ? [[136, 318, 210, 128]]
      : front.length === 2 ? [[112, 326, 190, 114], [258, 300, 156, 94]]
      : [[96, 330, 176, 104], [222, 304, 144, 86], [340, 322, 140, 84]];  // parta tří na bosse
    const texF = await Promise.all(front.map((f) => petTexture(f, true)));
    const texB = await Promise.all(back.map((f) => petTexture(f, false)));
    const fb = back.map((f, i) => mk(f, false, texB[i], ...(BACK[i] as [number, number, number, number])));
    const ff = front.map((f, i) => mk(f, true, texF[i], ...(FRONT[i] as [number, number, number, number])));
    // vzdálenější vzadu se kreslí první, ty úplně navrch
    for (const f of [...fb, ...[...ff].reverse()]) this.world.addChild(f.group);
    for (const f of [...fb, ...ff]) this.f[f.side] = f;

    this.fx.filterArea = this.app.screen;
    this.fx.filters = [new AdvancedBloomFilter({ threshold: 0.35, bloomScale: 1.25, brightness: 1.05, blur: 6, quality: 4 })];
    this.world.addChild(this.fx);
    stage.addChild(this.texts);
    this.parts = new Particles(this.fx, this.tex);
    this.app.ticker.add((t) => this.parts.update(Math.min(0.05, t.deltaMS / 1000)));

    // vstup do arény: soupeři zprava, tvoje strana zleva
    const tl = this.timeline();
    for (const f of [...fb, ...ff]) {
      f.group.x += f.front ? -320 : 320;
      tl.to(f.group, { x: f.base.x, duration: 0.9, ease: 'power3.out' }, '<0.1');
    }
    for (const f of fb) tl.add(() => this.parts.emit(f.base.x, f.base.y - 10, { count: 14, shape: 'spark', colors: [f.el.main, 0xffffff], speed: [40, 140], angle: [200, 340], scale: [0.15, 0.35] }));
  }

  // ── Kamera a obrazovka ──
  private cam(p: Pt | null, zoom = 1, dur = 0.5) {
    const c = p ? { x: lerp(W / 2, p.x, 0.35), y: lerp(H / 2, p.y, 0.35) } : { x: W / 2, y: H / 2 };
    this.to(this.world.pivot, { x: c.x, y: c.y, duration: dur, ease: 'power2.inOut' });
    this.to(this.world.scale, { x: zoom, y: zoom, duration: dur, ease: 'power2.inOut' });
  }

  private quake(power: number, dur = 0.4) {
    const tl = this.timeline();
    const n = Math.round(dur / 0.04);
    for (let i = 0; i < n; i++) {
      const k = power * (1 - i / n);
      tl.to(this.shake, { x: rand(-k, k), y: rand(-k, k), duration: 0.04, ease: 'none' });
    }
    tl.to(this.shake, { x: 0, y: 0, duration: 0.05 });
  }

  private shockwave(p: Pt, power = 1) {
    const g = this.world.toGlobal(p);
    const f = new ShockwaveFilter({ center: { x: g.x, y: g.y }, amplitude: 22 * power, wavelength: 120, speed: 520, brightness: 1.12, radius: 320 });
    this.shake.filters = [...(this.shake.filters ?? []), f];
    this.fromTo(f, { time: 0 }, {
      time: 0.75, duration: 0.75, ease: 'none',
      onComplete: () => { if (!this.dead) this.shake.filters = (this.shake.filters ?? []).filter((x) => x !== f); },
    });
  }

  private flash(f: Fighter, color = 0xffffff, times = 2) {
    f.overlay.color = color;
    const tl = this.timeline();
    for (let i = 0; i < times; i++) tl.to(f.overlay, { alpha: 0.9, duration: 0.05 }).to(f.overlay, { alpha: 0, duration: 0.09 });
  }

  private screenFlash(color: number, alpha = 0.7) {
    const g = new Graphics().rect(0, 0, W, H).fill(color);
    g.alpha = 0;
    g.blendMode = 'add';
    this.app.stage.addChild(g);
    this.timeline().to(g, { alpha, duration: 0.06 }).to(g, { alpha: 0, duration: 0.45, onComplete: () => g.destroy() });
  }

  private popText(p: Pt, text: string, color: string, size = 30) {
    const g = this.world.toGlobal(p);
    const t = new Text({ text, style: { fontFamily: 'system-ui, sans-serif', fontWeight: '900', fontSize: size, fill: color, stroke: { color: '#14121c', width: 6, join: 'round' } } });
    t.anchor.set(0.5);
    t.position.set(Math.min(W - 40, Math.max(40, g.x + rand(-10, 10))), Math.max(70, g.y)); // při zoomu kamery nesmí utéct z obrazu
    t.scale.set(0.3);
    this.texts.addChild(t);
    this.timeline()
      .to(t.scale, { x: 1.25, y: 1.25, duration: 0.18, ease: 'back.out(3)' })
      .to(t.scale, { x: 1, y: 1, duration: 0.15 })
      .to(t, { y: t.y - 46, duration: 0.9, ease: 'power1.out' }, 0)
      .to(t, { alpha: 0, duration: 0.35, onComplete: () => t.destroy() }, 0.75);
  }

  private dodge(f: Fighter) {
    const dir = f.front ? -1 : 1;
    return this.timeline().to(f.sprite, { x: 34 * dir, duration: 0.12, ease: 'power2.out' }).to(f.sprite, { x: 0, duration: 0.3, ease: 'power2.inOut' }, '+=0.15');
  }

  private knock(f: Fighter, power: number) {
    const dir = f.front ? -1 : 1;
    this.timeline().to(f.sprite, { x: 16 * dir * power, rotation: 0.08 * dir * power, duration: 0.07 })
      .to(f.sprite, { x: 0, rotation: 0, duration: 0.45, ease: 'elastic.out(1, 0.4)' });
  }

  private charge(f: Fighter, color: number, dur = 0.55) {
    const c = center(f);
    this.timeline().to(f.glow, { outerStrength: 4, duration: dur * 0.7 }).to(f.glow, { outerStrength: 0, duration: 0.4 }, `+=${dur * 0.4}`);
    f.glow.color = color;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), r = rand(50, 90);
      const s = new Sprite(this.tex.soft);
      s.anchor.set(0.5); s.tint = color; s.blendMode = 'add'; s.scale.set(rand(0.15, 0.3));
      s.position.set(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * 0.7);
      this.fx.addChild(s);
      this.to(s, { x: c.x, y: c.y, alpha: 0, duration: dur, delay: (i / n) * dur * 0.5, ease: 'power2.in', onComplete: () => s.destroy() });
    }
    return wait(dur);
  }

  // ── Efekty ──
  private async lunge(a: Fighter, t: Fighter, k = 0.3) {
    const dx = (t.base.x - a.base.x) * k, dy = (t.base.y - a.base.y) * k;
    await this.timeline().to(a.sprite, { x: -dx * 0.15, y: -dy * 0.15, duration: 0.14, ease: 'power1.out' })
      .to(a.sprite, { x: dx, y: dy, duration: 0.13, ease: 'power3.in' });
    this.to(a.sprite, { x: 0, y: 0, duration: 0.35, delay: 0.1, ease: 'power2.out' });
  }

  private slashes(p: Pt, color: number) {
    for (let i = 0; i < 3; i++) {
      const g = new Graphics();
      const r = 46 + i * 6, a0 = -2.4 + i * 0.5;
      g.arc(0, 0, r, a0, a0 + 1.6).stroke({ width: 7 - i, color: i === 1 ? color : 0xffffff, cap: 'round' });
      g.position.set(p.x + rand(-8, 8), p.y + rand(-8, 8));
      g.rotation = rand(-0.5, 0.5);
      g.blendMode = 'add'; g.scale.set(0.6); g.alpha = 0;
      this.fx.addChild(g);
      this.timeline({ delay: i * 0.06 }).to(g, { alpha: 1, duration: 0.04 }).to(g.scale, { x: 1.2, y: 1.2, duration: 0.25 }, 0)
        .to(g, { alpha: 0, rotation: g.rotation + 0.4, duration: 0.25, onComplete: () => g.destroy() });
    }
  }

  private async projectile(a: Fighter, t: Fighter, color: number, hit: boolean, shape: Shape) {
    const from = center(a), to = center(t);
    if (!hit) to.x += t.front ? -70 : 70;
    const orb = new Container();
    orb.position.set(from.x, from.y); orb.scale.set(0.1);
    for (const [tint, sc] of [[color, 1], [0xffffff, 0.5]]) {
      const g = new Sprite(this.tex.soft);
      g.anchor.set(0.5); g.tint = tint; g.blendMode = 'add'; g.scale.set(sc);
      orb.addChild(g);
    }
    this.fx.addChild(orb);
    this.to(orb.scale, { x: 1.1, y: 1.1, duration: 0.45, ease: 'back.out(2)' });
    await this.charge(a, color, 0.45);
    const prog = { t: 0 };
    const ctrl = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 70 };
    await this.to(prog, {
      t: 1, duration: 0.42, ease: 'power1.in',
      onUpdate: () => {
        const u = prog.t;
        orb.x = (1 - u) ** 2 * from.x + 2 * (1 - u) * u * ctrl.x + u * u * to.x;
        orb.y = (1 - u) ** 2 * from.y + 2 * (1 - u) * u * ctrl.y + u * u * to.y;
        orb.scale.set(lerp(1.1, 0.75, u));
        this.parts.emit(orb.x, orb.y, { count: 2, shape, colors: [color, 0xffffff], speed: [10, 50], life: [0.25, 0.5], scale: [0.12, 0.3], spread: 6 });
      },
    });
    orb.destroy({ children: true });
    this.parts.emit(to.x, to.y, { count: 34, shape, colors: [color, 0xffffff], speed: [120, 380], scale: [0.2, 0.5], life: [0.4, 0.8], gravity: 260 });
    this.parts.emit(to.x, to.y, { count: 1, colors: [color], speed: [0, 1], scale: [2.6, 2.6], grow: 0.4, life: [0.35, 0.35] });
    this.shockwave(to, 1);
  }

  private async beam(a: Fighter, t: Fighter, color: number, hit: boolean) {
    const from = center(a), to = center(t);
    if (!hit) to.y -= 70;
    await this.charge(a, color, 0.6);
    const g = new Graphics();
    g.blendMode = 'add';
    this.fx.addChild(g);
    const st = { w: 0 };
    const draw = () => {
      g.clear();
      const w = st.w * rand(0.85, 1.15);
      g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: w * 2.2, color, alpha: 0.35, cap: 'round' });
      g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: w, color, cap: 'round' });
      g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: w * 0.35, color: 0xffffff, cap: 'round' });
      const u = Math.random();
      this.parts.emit(lerp(from.x, to.x, u), lerp(from.y, to.y, u), { count: 1, shape: 'spark', colors: [0xffffff, color], speed: [20, 80], scale: [0.12, 0.25], life: [0.2, 0.4] });
    };
    this.screenFlash(color, 0.25);
    await this.timeline({ onUpdate: draw }).to(st, { w: 26, duration: 0.12 }).to(st, { w: 22, duration: 0.55 }).to(st, { w: 0, duration: 0.18 });
    g.destroy();
    this.parts.emit(to.x, to.y, { count: 30, shape: 'spark', colors: [color, 0xffffff], speed: [100, 320], scale: [0.15, 0.4] });
    this.shockwave(to, 1.1);
  }

  private async rain(t: Fighter, color: number, alt: number, hit: boolean, shape: Shape) {
    const to = center(t);
    const n = 16;
    const drops: unknown[] = []; // GSAP tweeny jsou thenable
    for (let i = 0; i < n; i++) {
      const s = new Sprite(this.tex[shape]);
      s.anchor.set(0.5); s.tint = i % 3 ? color : alt; s.scale.set(rand(0.35, 0.7));
      s.position.set(to.x + rand(-90, 90), -40 - rand(0, 60));
      s.rotation = rand(0, 6);
      this.fx.addChild(s);
      const tx = to.x + rand(-45, 45) + (hit ? 0 : 80), ty = to.y + rand(-30, 40);
      drops.push(this.to(s, {
        x: tx, y: ty, rotation: s.rotation + rand(-4, 4), duration: rand(0.35, 0.5), delay: i * 0.045, ease: 'power2.in',
        onComplete: () => {
          this.parts.emit(tx, ty, { count: 5, shape, colors: [color, 0xffffff], speed: [60, 180], scale: [0.1, 0.25], gravity: 400, life: [0.3, 0.6], add: shape !== 'shard' });
          s.destroy();
          if (i % 4 === 0) this.quake(5, 0.12);
        },
      }));
    }
    await wait(0.45);
    await Promise.all(drops.slice(n / 2));
  }

  private async bolt(t: Fighter, color: number, hit: boolean) {
    const to = center(t);
    if (!hit) to.x += t.front ? -80 : 80;
    await this.to(this.dim, { alpha: 0.55, duration: 0.3 });
    const g = new Graphics();
    g.blendMode = 'add';
    this.fx.addChild(g);
    for (let k = 0; k < 4; k++) {
      g.clear();
      const pts: Pt[] = [{ x: to.x + rand(-40, 40), y: -40 }];
      while (pts[pts.length - 1].y < to.y) {
        const l = pts[pts.length - 1];
        pts.push({ x: lerp(l.x, to.x, 0.3) + rand(-26, 26), y: l.y + rand(22, 40) });
      }
      pts[pts.length - 1] = to;
      for (const [w, c, al] of [[18, color, 0.3], [8, color, 1], [3, 0xffffff, 1]] as const) {
        g.moveTo(pts[0].x, pts[0].y);
        for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
        g.stroke({ width: w, color: c, alpha: al, join: 'miter' });
      }
      if (k === 0) { this.screenFlash(0xffffff, 0.8); this.quake(12, 0.35); }
      await wait(0.07);
    }
    g.destroy();
    this.parts.emit(to.x, to.y, { count: 26, shape: 'spark', colors: [color, 0xffffff], speed: [120, 360], scale: [0.15, 0.35] });
    this.shockwave(to, 1.2);
    this.to(this.dim, { alpha: 0, duration: 0.5, delay: 0.2 });
  }

  private async wave(a: Fighter, t: Fighter, color: number, shape: Shape) {
    const from = center(a), to = center(t);
    for (let i = 0; i < 4; i++) {
      const g = new Graphics();
      g.ellipse(0, 0, 30, 14).stroke({ width: 5, color, alpha: 0.9 }).ellipse(0, 0, 30, 14).stroke({ width: 2, color: 0xffffff });
      g.blendMode = 'add'; g.position.set(from.x, from.y); g.alpha = 0;
      this.fx.addChild(g);
      this.timeline({ delay: i * 0.12 }).to(g, { alpha: 1, duration: 0.05 })
        .to(g, { x: to.x, y: to.y, duration: 0.45, ease: 'power1.in' }, 0)
        .to(g.scale, { x: 2.6, y: 2.6, duration: 0.5 }, 0)
        .to(g, { alpha: 0, duration: 0.2, onComplete: () => g.destroy() }, 0.4);
      const u = { t: 0 };
      this.to(u, {
        t: 1, duration: 0.45, delay: i * 0.12,
        onUpdate: () => this.parts.emit(lerp(from.x, to.x, u.t), lerp(from.y, to.y, u.t), { count: 1, shape, colors: [color, 0xffffff], speed: [20, 60], scale: [0.2, 0.4], life: [0.4, 0.7], spread: 20, add: shape !== 'note' }),
      });
    }
    await wait(0.62);
  }

  private async burst(t: Fighter, color: number, alt: number, shape: Shape) {
    const to = center(t);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2, r = rand(80, 120);
      const s = new Sprite(this.tex[i % 2 ? shape : 'soft']);
      s.anchor.set(0.5); s.tint = i % 3 ? color : alt; s.blendMode = 'add'; s.scale.set(rand(0.2, 0.4));
      s.position.set(to.x + Math.cos(a) * r, to.y + Math.sin(a) * r * 0.75);
      this.fx.addChild(s);
      this.to(s, { x: to.x, y: to.y, duration: 0.5, delay: rand(0, 0.15), ease: 'power3.in', onComplete: () => s.destroy() });
    }
    await wait(0.62);
    this.screenFlash(color, 0.5);
    this.parts.emit(to.x, to.y, { count: 46, shape, colors: [color, alt, 0xffffff], speed: [150, 420], scale: [0.2, 0.55], life: [0.5, 1] });
    this.parts.emit(to.x, to.y, { count: 1, shape: 'ring', colors: [color], speed: [0, 1], scale: [0.5, 0.5], grow: 6, life: [0.45, 0.45] });
    this.shockwave(to, 1.3);
    this.quake(10, 0.35);
  }

  private async vines(t: Fighter, color: number, alt: number) {
    const base = feet(t), c = center(t);
    const gs: Graphics[] = [];
    const st = { t: 0 };
    const curves = [-1, 1, -0.4].map((d, i) => ({ d, i }));
    const draw = () => {
      gs.forEach((g, k) => {
        const { d } = curves[k];
        g.clear();
        const steps = Math.max(2, Math.floor(st.t * 24));
        g.moveTo(base.x + d * 50, base.y + 8);
        for (let j = 1; j <= steps; j++) {
          const u = j / 24;
          g.lineTo(base.x + d * 50 * (1 - u) + Math.sin(u * 9 + k) * 28 * (1 - u * 0.4), lerp(base.y + 8, c.y - 30, u));
        }
        g.stroke({ width: 9 - k * 2, color: k === 2 ? alt : color, cap: 'round', join: 'round' });
      });
    };
    for (let k = 0; k < curves.length; k++) { const g = new Graphics(); this.fx.addChild(g); gs.push(g); }
    await this.to(st, { t: 1, duration: 0.55, ease: 'power2.out', onUpdate: draw });
    this.parts.emit(c.x, c.y, { count: 18, shape: 'leaf', colors: [color, alt], speed: [60, 200], scale: [0.2, 0.4], gravity: 120, add: false });
    this.to(gs, { alpha: 0, duration: 0.4, delay: 0.35, onComplete: () => gs.forEach((g) => g.destroy()) });
  }

  private async geyser(t: Fighter, color: number, hit: boolean) {
    const base = feet(t);
    if (!hit) base.x += t.front ? -70 : 70;
    const crack = new Graphics().ellipse(0, 0, 50, 13).fill({ color: 0x0b1d2a, alpha: 0.7 });
    crack.position.set(base.x, base.y); crack.scale.set(0.1);
    this.fx.addChild(crack);
    await this.to(crack.scale, { x: 1, y: 1, duration: 0.35, ease: 'back.out(2)' });
    this.quake(6, 0.3);
    const tick = gsap.ticker.add(() => this.parts.emit(base.x, base.y, { count: 4, shape: 'drop', colors: [color, 0xffffff, 0x2b8cff], speed: [380, 620], angle: [255, 285], scale: [0.25, 0.55], gravity: 700, drag: 0.4, life: [0.6, 0.9], spread: 10 }));
    if (hit) this.timeline().to(t.sprite, { y: -50, duration: 0.3, ease: 'power2.out' }).to(t.sprite, { y: 0, duration: 0.45, ease: 'bounce.out' }, '+=0.25');
    await wait(0.75);
    gsap.ticker.remove(tick);
    this.shockwave(base, 1);
    this.to(crack, { alpha: 0, duration: 0.6, delay: 0.3, onComplete: () => crack.destroy() });
  }

  private shield(f: Fighter, color: number) {
    const c = center(f);
    const g = new Graphics();
    const r = f.size * 0.55;
    g.circle(0, 0, r).fill({ color, alpha: 0.14 }).stroke({ width: 4, color, alpha: 0.9 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.moveTo(0, 0).lineTo(Math.cos(a) * r, Math.sin(a) * r).stroke({ width: 1.5, color, alpha: 0.35 });
    }
    g.arc(0, 0, r * 0.82, -2.6, -1.6).stroke({ width: 5, color: 0xffffff, alpha: 0.7, cap: 'round' });
    g.position.set(c.x, c.y); g.scale.set(0.2, 0.2); g.blendMode = 'add';
    this.fx.addChild(g);
    this.timeline().to(g.scale, { x: 1.08, y: 1.08, duration: 0.3, ease: 'back.out(3)' }).to(g.scale, { x: 1, y: 1, duration: 0.2 })
      .to(g, { alpha: 0.35, duration: 0.35, yoyo: true, repeat: 1 })
      .to(g, { alpha: 0, duration: 0.3, onComplete: () => g.destroy() });
    return wait(0.8);
  }

  private aura(f: Fighter, color: number) {
    const p = feet(f);
    f.glow.color = color;
    this.timeline().to(f.glow, { outerStrength: 5, duration: 0.3 }).to(f.glow, { outerStrength: 0, duration: 0.6 }, '+=0.4');
    const ring = new Sprite(this.tex.ring);
    ring.anchor.set(0.5); ring.tint = color; ring.blendMode = 'add'; ring.position.set(p.x, p.y); ring.scale.set(0.5, 0.15);
    this.fx.addChild(ring);
    this.to(ring.scale, { x: 4, y: 1.1, duration: 0.9 });
    this.to(ring, { alpha: 0, duration: 0.9, onComplete: () => ring.destroy() });
    const tick = gsap.ticker.add(() => this.parts.emit(p.x + rand(-f.size * 0.3, f.size * 0.3), p.y - rand(0, f.size * 0.3), { count: 1, shape: Math.random() < 0.5 ? 'spark' : 'soft', colors: [color, 0xffffff], speed: [40, 110], angle: [260, 280], scale: [0.12, 0.3], life: [0.6, 1] }));
    return wait(0.9).then(() => gsap.ticker.remove(tick));
  }

  private async drain(from: Fighter, to: Fighter, color: number) {
    const a = center(from), b = center(to);
    const all: unknown[] = [];
    for (let i = 0; i < 9; i++) {
      const s = new Sprite(this.tex.soft);
      s.anchor.set(0.5); s.tint = color; s.blendMode = 'add'; s.scale.set(0.35); s.position.set(a.x + rand(-20, 20), a.y + rand(-20, 20));
      this.fx.addChild(s);
      const mid = { x: (a.x + b.x) / 2 + rand(-60, 60), y: Math.min(a.y, b.y) - rand(20, 80) };
      const u = { t: 0 }, sx = s.x, sy = s.y;
      all.push(this.to(u, {
        t: 1, duration: 0.6, delay: i * 0.05, ease: 'power1.inOut',
        onUpdate: () => {
          s.x = (1 - u.t) ** 2 * sx + 2 * (1 - u.t) * u.t * mid.x + u.t * u.t * b.x;
          s.y = (1 - u.t) ** 2 * sy + 2 * (1 - u.t) * u.t * mid.y + u.t * u.t * b.y;
        },
        onComplete: () => s.destroy(),
      }));
    }
    await Promise.all(all);
  }

  private async faint(f: Fighter) {
    f.idle.pause();
    this.flash(f, 0xffffff, 3);
    await wait(0.3);
    await this.timeline().to(f.sprite, { y: 40, alpha: 0, duration: 0.7, ease: 'power2.in' })
      .to(f.sprite.scale, { y: f.sprite.scale.y * 0.4, duration: 0.7, ease: 'power2.in' }, 0);
    this.parts.emit(feet(f).x, feet(f).y - 10, { count: 20, shape: 'soft', colors: [0xffffff, f.el.main], speed: [30, 120], angle: [200, 340], scale: [0.3, 0.6], life: [0.5, 1], add: false });
  }

  // ── Jeden úkon tahu ──
  async play(e: TurnEvent, hp: Record<Side, number>, hooks: Hooks) {
    if (this.dead) return;
    try {
      await this.playEvent(e, hp, hooks);
    } catch (err) {
      if (!this.dead) throw err; // po odchodu ze stránky dobíhající animace tiše končí
    }
  }

  private async playEvent(e: TurnEvent, hp: Record<Side, number>, hooks: Hooks) {
    const A = this.f[e.actor];
    // cíl z události, jinak první soupeř (ve 2v2 / ffa se neútočí na spojence)
    const T = this.f[e.target ?? ''] ?? Object.values(this.f).find((f) => f.front !== A?.front && f.side !== A?.side);
    if (!A || !T) return;
    const el = A.el, phys = e.kind === 'phys';
    const color = phys ? 0xffffff : el.main;
    hooks.say(`${A.info.name} použil ${e.name}!`);
    if (e.cost) hooks.change(A.side, { sp: -e.cost });
    this.cam(center(A), 1.06, 0.4);

    // Obrana (i Hradní štít) a léčivá kouzla: nic neletí, jen štít / aura a +HP
    if (e.kind === 'guard' || e.fx === 'aura') {
      await Promise.all([
        e.kind === 'guard' ? this.shield(A, e.fx === 'shield' ? 0x7cc4ff : el.main) : null,
        e.fx === 'aura' ? this.aura(A, el.main) : null,
      ]);
      if (e.heal) {
        hooks.change(A.side, { hp: e.heal });
        hp[A.side] += e.heal;
        this.popText(center(A), `+${e.heal}`, '#7CFF8A');
      }
      this.cam(null);
      await wait(0.25);
      return;
    }

    const hit = !!e.hit;
    switch (e.fx) {
      case 'slash': await this.lunge(A, T, 0.42); if (hit) this.slashes(center(T), 0xfff3b0); break;
      case 'smash': {
        await this.timeline().to(A.sprite, { y: -70, x: (T.base.x - A.base.x) * 0.25, duration: 0.3, ease: 'power2.out' })
          .to(A.sprite, { y: (T.base.y - A.base.y) * 0.55, x: (T.base.x - A.base.x) * 0.55, duration: 0.16, ease: 'power3.in' });
        this.to(A.sprite, { x: 0, y: 0, duration: 0.45, delay: 0.12, ease: 'power2.out' });
        if (hit) { this.shockwave(center(T), 1.3); this.parts.emit(feet(T).x, feet(T).y, { count: 20, shape: 'shard', colors: [0x9b8b6e, 0xd6c7a1], speed: [120, 300], angle: [200, 340], gravity: 600, scale: [0.15, 0.35], add: false }); }
        break;
      }
      case 'projectile': await this.projectile(A, T, color, hit, el.shape); break;
      case 'beam': await this.beam(A, T, color, hit); break;
      case 'rain': this.cam(center(T), 1.08, 0.4); await this.rain(T, color, el.alt, hit, el.shape); break;
      case 'bolt': this.cam(center(T), 1.1, 0.3); await this.bolt(T, color, hit); break;
      case 'wave': await this.charge(A, color, 0.35); await this.wave(A, T, color, el.shape); break;
      case 'burst': this.cam(center(T), 1.1, 0.4); await this.burst(T, color, el.alt, el.shape); break;
      case 'vines': this.cam(center(T), 1.08, 0.4); await this.vines(T, color, el.alt); break;
      case 'geyser': this.cam(center(T), 1.08, 0.4); await this.geyser(T, color, hit); break;
      default: await this.lunge(A, T);
    }

    if (hit) {
      const dmg = e.damage ?? 0;
      const big = (e.effectiveness ?? 1) > 1 || e.crit;
      this.cam(center(T), big ? 1.12 : 1.06, 0.15);
      this.flash(T, e.crit ? 0xff4d4d : 0xffffff, big ? 3 : 2);
      this.knock(T, big ? 1.6 : 1);
      this.quake(big ? 11 : phys ? 6 : 8, big ? 0.4 : 0.25);
      if (phys) this.parts.emit(center(T).x, center(T).y, { count: 14, shape: 'spark', colors: [0xffffff, 0xfff3b0], speed: [100, 280], scale: [0.12, 0.3] });
      hooks.change(T.side, { hp: -dmg });
      hp[T.side] = Math.max(0, hp[T.side] - dmg);
      this.popText(center(T), String(dmg), e.crit ? '#FF5A5A' : big ? '#FFD23F' : '#FFFFFF', big ? 38 : 30);
      if (e.crit) { await wait(0.35); hooks.say('Kritický zásah!'); }
      if ((e.effectiveness ?? 1) > 1) { await wait(0.35); hooks.say('Je to velmi účinné!'); }
      else if ((e.effectiveness ?? 1) < 1) { await wait(0.35); hooks.say('Moc to nezabralo…'); }
      if (e.heal) {
        await this.drain(T, A, el.main);
        hooks.change(A.side, { hp: e.heal });
        hp[A.side] += e.heal;
        this.popText(center(A), `+${e.heal}`, '#7CFF8A');
      }
    } else {
      this.dodge(T);
      this.popText(center(T), 'Vedle!', '#B9C3D6', 26);
      hooks.say(`${T.info.name} uhnul!`);
    }
    await wait(0.5);
    this.cam(null);
    if (hp[T.side] <= 0) {
      await this.faint(T);
      hooks.say(`${T.info.name} padl!`);
      await wait(0.6);
    }
    await wait(0.25);
  }
}
