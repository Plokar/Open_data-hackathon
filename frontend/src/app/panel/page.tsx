'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { HeartPulse, LogOut, RefreshCw, Search, ShieldAlert, Trash2, Wand2 } from 'lucide-react';
import { PetArt } from '@/components/pet/PetCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PetType, Rarity } from '@/lib/api';
import { PET_TYPE, RARITY } from '@/lib/game';
import { cn } from '@/lib/utils';

/**
 * Admin „cheat“ panel: hráči, hesla, profily, odznaky a tvorové.
 * Přihlášení jménem a heslem z .env (ADMIN_PANEL_USERNAME / ADMIN_PANEL_PASSWORD), token jen v sessionStorage.
 */
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const TOKEN_KEY = 'zg-panel-token';

interface Row {
  id: number; username: string; nickname: string; first_name: string; email: string; claimed: boolean; is_staff: boolean;
  level: number; xp: number; wins: number; rating: number; school: string; stamps: number; pets: number; date_joined: string;
}
interface PanelPet { id: number; name: string; species: string; type: PetType; rarity: Rarity; seed: number; level: number; xp: number; stage: number; place: string; injured: boolean }
interface Detail extends Omit<Row, 'pets'> { pets: PanelPet[]; badges: { code: string; name: string; icon: string; owned: boolean }[] }
interface Stats { users: number; pets: number; checkins: number; demo_checkins: number; battles: number; injured: number }

class PanelError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function call<T>(token: string, path: string, method = 'GET', body?: unknown): Promise<T> {
  const r = await fetch(`${API}/api/panel/${path}`, {
    method, credentials: 'omit', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Panel ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (r.status === 204) return null as T;
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new PanelError(d.detail || `Chyba ${r.status}`, r.status);
  return d as T;
}

const store = {
  get: () => { try { return sessionStorage.getItem(TOKEN_KEY) ?? ''; } catch { return ''; } },
  set: (t: string) => { try { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY); } catch { /* soukromé okno */ } },
};

function randomPassword() {
  const a = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(a, (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
}

function Login({ onToken }: { onToken: (t: string, isDefault: boolean) => void }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await call<{ token: string; default_credentials: boolean }>('', 'login/', 'POST', { username: u, password: p });
      onToken(r.token, r.default_credentials);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepovedlo se.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5">
      <ShieldAlert className="h-10 w-10 text-trail-red" aria-hidden />
      <h1 className="mt-3 text-2xl font-extrabold">Admin panel</h1>
      <p className="mt-1 text-sm text-muted-foreground">Správa hráčů, tvorů a odznaků Západ GO.</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <Input value={u} onChange={(e) => setU(e.target.value)} placeholder="Jméno" aria-label="Jméno" autoComplete="username" autoFocus />
        <Input value={p} onChange={(e) => setP(e.target.value)} placeholder="Heslo" aria-label="Heslo" type="password" autoComplete="current-password" />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="w-full" isLoading={busy}>Vstoupit</Button>
      </form>
    </main>
  );
}

function PetRow({ pet, onSave, onDelete }: { pet: PanelPet; onSave: (d: Record<string, unknown>) => void; onDelete: () => void }) {
  const [level, setLevel] = useState(pet.level);
  const [stage, setStage] = useState(pet.stage);
  const [rarity, setRarity] = useState(pet.rarity);
  const changed = level !== pet.level || stage !== pet.stage || rarity !== pet.rarity;
  const sel = 'h-9 rounded-lg border border-input bg-card px-2 text-sm';
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-2">
      <PetArt type={pet.type} seed={pet.seed} stage={pet.stage} rarity={pet.rarity} size={56} />
      <div className="min-w-32 flex-1">
        <div className="font-bold">{pet.name} {pet.injured && <span className="ml-1 rounded bg-destructive/15 px-1.5 text-xs font-semibold text-destructive">zraněný</span>}</div>
        <div className="text-xs text-muted-foreground">{pet.species}, {PET_TYPE[pet.type].label} · {pet.place}</div>
      </div>
      <label className="text-xs">lvl <input type="number" min={1} max={30} value={level} onChange={(e) => setLevel(Number(e.target.value))} className={cn(sel, 'w-16')} /></label>
      <select value={stage} onChange={(e) => setStage(Number(e.target.value))} className={sel} aria-label="Stupeň evoluce">
        <option value={1}>Mládě</option><option value={2}>Dospělec</option><option value={3}>Prastarý</option>
      </select>
      <select value={rarity} onChange={(e) => setRarity(e.target.value as Rarity)} className={sel} aria-label="Rarita">
        {(Object.keys(RARITY) as Rarity[]).map((r) => <option key={r} value={r}>{RARITY[r].label}</option>)}
      </select>
      <div className="flex gap-1">
        {changed && <Button size="sm" onClick={() => onSave({ level, stage, rarity })}>Uložit</Button>}
        {pet.injured && <Button size="sm" variant="outline" onClick={() => onSave({ heal: true })}><HeartPulse className="h-4 w-4" /> Vyléčit</Button>}
        <button onClick={onDelete} aria-label={`Smazat ${pet.name}`} className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
      </div>
    </li>
  );
}

function UserDetail({ d, token, onChange, onDeleted, onError }: {
  d: Detail; token: string; onChange: (d: Detail) => void; onDeleted: () => void; onError: (e: unknown) => void;
}) {
  const [form, setForm] = useState({ nickname: d.nickname, first_name: d.first_name, email: d.email, school: d.school, xp: d.xp, wins: d.wins, is_staff: d.is_staff });
  const [password, setPassword] = useState('');
  const [saved, setSaved] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? Number(e.target.value) : e.target.value });

  const run = async (p: Promise<Detail>, msg: string) => {
    try {
      onChange(await p);
      setSaved(msg);
    } catch (e) {
      onError(e);
    }
  };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    run(call<Detail>(token, `users/${d.id}/`, 'PATCH', { ...form, ...(password ? { password } : {}) }),
      password ? `Uloženo. Nové heslo: ${password}` : 'Uloženo.');
  };
  const remove = async () => {
    if (window.prompt(`Smazat hráče i s razítky a tvory? Napiš jeho přezdívku: ${d.nickname}`) !== d.nickname) return;
    try {
      await call(token, `users/${d.id}/`, 'DELETE');
      onDeleted();
    } catch (e) {
      onError(e);
    }
  };
  const lbl = 'block text-xs font-semibold text-muted-foreground';

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold">{d.nickname}</h2>
          <p className="text-xs text-muted-foreground">#{d.id} · {d.username} · od {new Date(d.date_joined).toLocaleDateString('cs-CZ')}</p>
        </div>
        <Link href={`/u/${encodeURIComponent(d.nickname)}`} target="_blank" className="text-sm font-semibold text-primary underline">Profil ↗</Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
        <span className="rounded-full bg-muted px-2 py-0.5">úroveň {d.level}</span>
        <span className="rounded-full bg-muted px-2 py-0.5">hodnocení {d.rating}</span>
        <span className="rounded-full bg-muted px-2 py-0.5">razítek {d.stamps}</span>
        <span className={cn('rounded-full px-2 py-0.5', d.claimed ? 'bg-primary/15 text-primary' : 'bg-trail-yellow/30')}>{d.claimed ? 'účet pojištěný' : 'jen jméno, bez e-mailu'}</span>
      </div>

      <form onSubmit={save} className="mt-4 grid grid-cols-2 gap-3">
        <label className={lbl}>Přezdívka<Input className="mt-1 h-10" value={form.nickname} onChange={set('nickname')} /></label>
        <label className={lbl}>Jméno<Input className="mt-1 h-10" value={form.first_name} onChange={set('first_name')} /></label>
        <label className={cn(lbl, 'col-span-2')}>E-mail<Input className="mt-1 h-10" type="email" value={form.email} onChange={set('email')} /></label>
        <label className={lbl}>XP (úroveň = 1 + XP/200)<Input className="mt-1 h-10" type="number" min={0} value={form.xp} onChange={set('xp')} /></label>
        <label className={lbl}>Výhry<Input className="mt-1 h-10" type="number" min={0} value={form.wins} onChange={set('wins')} /></label>
        <label className={cn(lbl, 'col-span-2')}>Škola<Input className="mt-1 h-10" value={form.school} onChange={set('school')} /></label>
        <label className={cn(lbl, 'col-span-2')}>Nové heslo (prázdné = beze změny)
          <div className="mt-1 flex gap-2">
            <Input className="h-10" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="aspoň 6 znaků" autoComplete="off" />
            <Button type="button" variant="outline" onClick={() => setPassword(randomPassword())}><Wand2 className="h-4 w-4" /> Vygenerovat</Button>
          </div>
        </label>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_staff} onChange={set('is_staff')} className="h-4 w-4" /> Organizátor (demo razítka bez kontroly vzdálenosti)
        </label>
        <div className="col-span-2 flex flex-wrap items-center gap-2">
          <Button type="submit">Uložit hráče</Button>
          <Button type="button" variant="ghost" className="text-destructive" onClick={remove}><Trash2 className="h-4 w-4" /> Smazat hráče</Button>
          {saved && <span className="text-sm font-semibold text-primary">{saved}</span>}
        </div>
      </form>

      <h3 className="mt-6 font-bold">Odznaky</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {d.badges.map((b) => (
          <button key={b.code} onClick={() => run(call<Detail>(token, `users/${d.id}/badges/`, 'POST', { code: b.code, award: !b.owned }), b.owned ? `Odebrán: ${b.name}` : `Udělen: ${b.name}`)}
            aria-pressed={b.owned}
            className={cn('cursor-pointer rounded-full border px-3 py-1 text-sm', b.owned ? 'border-transparent bg-trail-yellow/40 font-semibold' : 'border-dashed border-border text-muted-foreground hover:bg-accent')}>
            {b.icon} {b.name}
          </button>
        ))}
      </div>

      <h3 className="mt-6 font-bold">Tvorové ({d.pets.length})</h3>
      <ul className="mt-2 space-y-2">
        {d.pets.map((p) => (
          <PetRow key={`${p.id}-${p.level}-${p.stage}-${p.rarity}-${p.injured}`} pet={p}
            onSave={(body) => run(call<Detail>(token, `pets/${p.id}/`, 'PATCH', body), `${p.name} upraven.`)}
            onDelete={() => window.confirm(`Smazat tvora ${p.name}?`) && run(call<Detail>(token, `pets/${p.id}/`, 'DELETE'), `${p.name} smazán.`)} />
        ))}
        {!d.pets.length && <li className="text-sm text-muted-foreground">Žádní tvorové.</li>}
      </ul>
    </div>
  );
}

export default function PanelPage() {
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage až po hydrataci
    setToken(store.get());
    setReady(true);
  }, []);

  const logout = useCallback(() => {
    store.set('');
    setToken('');
    setDetail(null);
  }, []);
  const fail = useCallback((e: unknown) => {
    if (e instanceof PanelError && (e.status === 401 || e.status === 403)) logout();
    else setMsg(e instanceof Error ? e.message : 'Chyba.');
  }, [logout]);

  const loadRows = useCallback(() => {
    if (!token) return;
    call<Row[]>(token, `users/?q=${encodeURIComponent(q)}`).then(setRows).catch(fail);
    call<Stats>(token, 'stats/').then(setStats).catch(fail);
  }, [token, q, fail]);
  useEffect(() => {
    const t = setTimeout(loadRows, 250); // hledání při psaní
    return () => clearTimeout(t);
  }, [loadRows]);

  const open = (id: number) => call<Detail>(token, `users/${id}/`).then((d) => { setDetail(d); setMsg(''); }).catch(fail);
  const action = (a: string) => call<{ message: string }>(token, 'actions/', 'POST', { action: a }).then((r) => { setMsg(r.message); loadRows(); }).catch(fail);

  if (!ready) return null;
  if (!token) return <Login onToken={(t, d) => { store.set(t); setToken(t); setIsDefault(d); }} />;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <ShieldAlert className="h-6 w-6 text-trail-red" aria-hidden />
          <h1 className="text-lg font-extrabold">Západ GO · cheat panel</h1>
          {stats && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              {([['hráčů', stats.users], ['tvorů', stats.pets], ['razítek', stats.checkins], ['demo razítek', stats.demo_checkins], ['soubojů', stats.battles], ['zraněných', stats.injured]] as const).map(([k, v]) => (
                <span key={k} className="rounded-full bg-muted px-2 py-0.5"><b className="tabular-nums">{v}</b> {k}</span>
              ))}
            </div>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => action('heal_all')}><HeartPulse className="h-4 w-4" /> Vyléčit všechny</Button>
            <Button size="sm" variant="outline" onClick={() => action('recompute_ratings')}><RefreshCw className="h-4 w-4" /> Přepočítat hodnocení</Button>
            <Button size="sm" variant="ghost" onClick={logout}><LogOut className="h-4 w-4" /> Odhlásit</Button>
          </div>
        </div>
      </header>

      {isDefault && (
        <p role="alert" className="mx-auto mt-3 max-w-7xl px-4">
          <span className="block rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">
            Panel používá výchozí heslo admin/admin. Před nasazením nastav ADMIN_PANEL_USERNAME a ADMIN_PANEL_PASSWORD v .env.
          </span>
        </p>
      )}
      {msg && <p role="status" className="mx-auto mt-3 max-w-7xl px-4 text-sm font-semibold text-primary">{msg}</p>}

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section aria-label="Hráči">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hledat přezdívku, e-mail, jméno…" aria-label="Hledat hráče"
            leftIcon={<Search className="h-4 w-4" />} />
          <div className="mt-3 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>{['Hráč', 'E-mail', 'Úr.', 'Hodn.', 'Razítka', 'Tvorové'].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => open(r.id)} className={cn('cursor-pointer border-t border-border hover:bg-accent', detail?.id === r.id && 'bg-primary/10')}>
                    <td className="px-3 py-2">
                      <button className="cursor-pointer text-left font-semibold" onClick={(e) => { e.stopPropagation(); open(r.id); }}>{r.nickname}</button>
                      {r.is_staff && <span className="ml-1 rounded bg-trail-blue/15 px-1 text-[10px] text-trail-blue">org</span>}
                    </td>
                    <td className="max-w-40 truncate px-3 py-2 text-muted-foreground">{r.claimed ? r.email : <i>jen jméno</i>}</td>
                    <td className="px-3 py-2 tabular-nums">{r.level}</td>
                    <td className="px-3 py-2 tabular-nums">{r.rating}</td>
                    <td className="px-3 py-2 tabular-nums">{r.stamps}</td>
                    <td className="px-3 py-2 tabular-nums">{r.pets}</td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Nikdo nenalezen.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-label="Detail hráče" className="lg:sticky lg:top-20 lg:self-start">
          {detail ? (
            <div className="rounded-2xl border border-border bg-card p-4">
              <UserDetail key={detail.id} d={detail} token={token} onChange={(d) => { setDetail(d); loadRows(); }}
                onDeleted={() => { setDetail(null); setMsg('Hráč smazán.'); loadRows(); }} onError={fail} />
            </div>
          ) : <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">Vyber hráče vlevo.</p>}
        </section>
      </main>
    </div>
  );
}
