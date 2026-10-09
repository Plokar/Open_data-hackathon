'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Check, Clock, QrCode as QrIcon, Swords, UserMinus, UserPlus, X } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PetArt } from '@/components/pet/PetCard';
import { Challenges } from '@/components/battle/Challenges';
import { MascotArt } from '@/components/guide/Guide';
import { ShareQr } from '@/components/ui/share-qr';
import { useAuth } from '@/contexts/AuthContext';
import {
  authApi, errorMessage, friendsApi, gameApi,
  type FriendsData, type Person, type PetPreview, type PublicProfile,
} from '@/lib/api';
import { PET_TYPE, RARITY } from '@/lib/game';
import { cn } from '@/lib/utils';

const XP_PER_LEVEL = 200; // Profile.add_xp: level = 1 + xp // 200

function Avatar({ pet, size }: { pet: PetPreview | null; size: number }) {
  return pet
    ? <PetArt type={pet.type} seed={pet.seed} stage={pet.stage} rarity={pet.rarity} size={size} />
    : <MascotArt type="spring" seed={987654321} size={size} />;
}

function PersonRow({ p, children }: { p: Person; children?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2 pr-2.5">
      <Avatar pet={p.top_pet} size={48} />
      <Link href={`/u/${encodeURIComponent(p.nickname)}`} className="min-w-0 flex-1">
        <div className="truncate font-bold">{p.nickname}</div>
        <div className="text-xs text-muted-foreground">Úroveň {p.level} · hodnocení {p.rating}</div>
      </Link>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </li>
  );
}

const iconBtn = 'grid h-10 w-10 cursor-pointer place-items-center rounded-xl';

function Friends({ nickname }: { nickname: string }) {
  const [data, setData] = useState<FriendsData | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    friendsApi.list().then(setData).catch((e) => setError(errorMessage(e)));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- adresa až po hydrataci
    setOrigin(window.location.origin);
  }, []);

  const run = async (p: Promise<FriendsData>) => {
    setError('');
    setBusy(true);
    try {
      setData(await p);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && await run(friendsApi.add(name.trim()))) setName('');
  };

  return (
    <section className="mt-8" aria-labelledby="friends-h">
      <h2 id="friends-h" className="text-xl font-bold">Přátelé{data && data.friends.length > 0 && <span className="ml-2 text-base font-semibold text-muted-foreground">{data.friends.length}</span>}</h2>

      <Challenges className="mt-3" />

      {!!data?.incoming.length && (
        <div className="mt-3">
          <h3 className="text-sm font-semibold text-trail-red">Chtějí se s tebou kamarádit</h3>
          <ul className="mt-2 space-y-2">
            {data.incoming.map((p) => (
              <PersonRow key={p.id} p={p}>
                <button onClick={() => run(friendsApi.accept(p.id))} disabled={busy} aria-label={`Přijmout ${p.nickname}`} className={cn(iconBtn, 'bg-primary text-primary-foreground')}><Check className="h-5 w-5" /></button>
                <button onClick={() => run(friendsApi.remove(p.id))} disabled={busy} aria-label={`Odmítnout ${p.nickname}`} className={cn(iconBtn, 'bg-muted')}><X className="h-5 w-5" /></button>
              </PersonRow>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={add} className="mt-4 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Přezdívka kamaráda" aria-label="Přezdívka kamaráda" maxLength={30}
          className="h-12 min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <button type="submit" disabled={busy || !name.trim()} className="flex h-12 cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">
          <UserPlus className="h-5 w-5" aria-hidden /> Přidat
        </button>
      </form>
      <button onClick={() => setQr((v) => !v)} aria-expanded={qr}
        className="mt-2 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-semibold text-muted-foreground hover:bg-accent">
        <QrIcon className="h-4 w-4" aria-hidden /> {qr ? 'Skrýt můj QR kód' : 'Jste spolu? Ukaž svůj QR kód'}
      </button>
      {qr && origin && (
        <ShareQr className="mt-4" url={`${origin}/u/${encodeURIComponent(nickname)}?add=1`} title={`${nickname} v Západ GO`}
          hint="Kamarád naskenuje kód telefonem a jedním klepnutím si tě přidá." />
      )}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}

      {data && (
        data.friends.length ? (
          <ul className="mt-4 space-y-2">
            {data.friends.map((p) => (
              <PersonRow key={p.id} p={p}>
                <Link href={`/battle?invite=${encodeURIComponent(p.nickname)}`} aria-label={`Vyzvat ${p.nickname} na souboj`}
                  className="flex h-10 items-center gap-1.5 rounded-xl bg-trail-red px-3 text-sm font-bold text-white">
                  <Swords className="h-4 w-4" aria-hidden /> Vyzvat
                </Link>
                <button onClick={() => window.confirm(`Odebrat ${p.nickname} z přátel?`) && run(friendsApi.remove(p.id))} disabled={busy}
                  aria-label={`Odebrat ${p.nickname}`} className={cn(iconBtn, 'text-muted-foreground hover:bg-accent')}><UserMinus className="h-4 w-4" /></button>
              </PersonRow>
            ))}
          </ul>
        ) : !data.incoming.length && <p className="mt-4 text-sm text-muted-foreground">Zatím tu nikdo není. Přidej kamaráda podle přezdívky nebo mu ukaž svůj QR kód.</p>
      )}

      {!!data?.outgoing.length && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-muted-foreground">Čeká na potvrzení</h3>
          <ul className="mt-2 space-y-2">
            {data.outgoing.map((p) => (
              <PersonRow key={p.id} p={p}>
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" aria-hidden /> odesláno</span>
                <button onClick={() => run(friendsApi.remove(p.id))} disabled={busy} aria-label={`Zrušit žádost pro ${p.nickname}`} className={cn(iconBtn, 'text-muted-foreground hover:bg-accent')}><X className="h-4 w-4" /></button>
              </PersonRow>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Tlačítko přátelství na cizím profilu. */
function FriendAction({ p, onChange, highlight }: { p: PublicProfile; onChange: () => void; highlight: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const f = p.friendship!;
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      onChange();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const btn = 'flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold disabled:opacity-60';
  return (
    <div className="mt-4">
      <div className="flex gap-2">
        {f.state === 'none' && (
          <button disabled={busy} onClick={() => act(() => friendsApi.add(p.nickname))} className={cn(btn, 'bg-primary text-primary-foreground', highlight && 'ring-4 ring-trail-yellow/60')}>
            <UserPlus className="h-5 w-5" aria-hidden /> Přidat do přátel
          </button>
        )}
        {f.state === 'outgoing' && <div className={cn(btn, 'cursor-default bg-white/15')}><Clock className="h-5 w-5" aria-hidden /> Žádost odeslána</div>}
        {f.state === 'incoming' && (
          <button disabled={busy} onClick={() => act(() => friendsApi.accept(f.id!))} className={cn(btn, 'bg-primary text-primary-foreground')}>
            <Check className="h-5 w-5" aria-hidden /> Přijmout přátelství
          </button>
        )}
        {f.state === 'friends' && (
          <>
            <div className={cn(btn, 'cursor-default bg-white/15')}><Check className="h-5 w-5" aria-hidden /> Přátelé</div>
            <Link href={`/battle?invite=${encodeURIComponent(p.nickname)}`} className={cn(btn, 'bg-trail-red text-white')}>
              <Swords className="h-5 w-5" aria-hidden /> Vyzvat
            </Link>
          </>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-200">{error}</p>}
    </div>
  );
}

export default function ProfilePage() {
  const { nickname } = useParams<{ nickname: string }>();
  const { user, logout } = useAuth();
  const [p, setP] = useState<PublicProfile | null>(null);
  const [error, setError] = useState('');
  const [addParam, setAddParam] = useState(false);
  const nick = decodeURIComponent(nickname);

  const load = useCallback(() => {
    gameApi.user(nick).then(setP).catch(() => setError('Hráč nenalezen.'));
  }, [nick]);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- query až po hydrataci
    setAddParam(new URLSearchParams(window.location.search).has('add'));
  }, [load, user]);

  if (!p) return <AppShell><p className="text-sm text-muted-foreground">{error || 'Načítám…'}</p></AppShell>;
  const isMe = user?.profile.nickname === p.nickname;
  const color = p.top_pet ? PET_TYPE[p.top_pet.type].color : '#2e6a47';
  const inLevel = p.xp % XP_PER_LEVEL;

  const removeAccount = async () => {
    if (!window.confirm('Opravdu smazat účet, razítka, tvory a fotky? Nejde to vrátit.')) return;
    try {
      await authApi.deleteMe();
      window.location.href = '/';
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <AppShell>
      <section className="relative -mx-4 -mt-5 overflow-hidden px-5 pb-6 pt-6 text-white sm:mx-0 sm:rounded-b-3xl"
        style={{ background: `radial-gradient(120% 80% at 80% 0%, color-mix(in oklab, ${color} 70%, white 10%), transparent 60%), linear-gradient(160deg, color-mix(in oklab, ${color} 55%, #13201a), #13201a)` }}>
        <div className="flex items-center gap-4">
          <div className="pet-idle shrink-0 rounded-full bg-white/10 p-1 ring-2 ring-white/25"><Avatar pet={p.top_pet} size={104} /></div>
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-extrabold leading-tight">{p.nickname}</h1>
            <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
              <span className="rounded-full bg-white/15 px-2 py-0.5 font-semibold">Úroveň {p.level}</span>
              {p.school && <span className="rounded-full bg-white/15 px-2 py-0.5">{p.school}</span>}
              {p.team && <span className="rounded-full bg-white/15 px-2 py-0.5">tým {p.team}</span>}
            </div>
            <div className="mt-2 h-1.5 w-40 max-w-full rounded-full bg-white/20" role="progressbar" aria-valuenow={inLevel} aria-valuemin={0} aria-valuemax={XP_PER_LEVEL} aria-label="Postup na další úroveň">
              <div className="h-1.5 rounded-full bg-trail-yellow" style={{ width: `${(100 * inLevel) / XP_PER_LEVEL}%` }} />
            </div>
            <div className="mt-1 text-[11px] opacity-80">{p.xp} XP · další úroveň za {XP_PER_LEVEL - inLevel}</div>
          </div>
        </div>

        {p.friendship && <FriendAction p={p} onChange={load} highlight={addParam} />}
        {!user && (
          <Link href={`/start?redirect=${encodeURIComponent(`/u/${p.nickname}?add=1`)}`}
            className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-white font-semibold text-[#13201a]">
            <UserPlus className="h-5 w-5" aria-hidden /> Založ si Pas a přidej si {p.nickname}
          </Link>
        )}
      </section>
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}

      <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
        {([['Razítka', p.stamps], ['Výhry', p.wins], ['Hodnocení', p.rating], ['Přátelé', p.friends_count]] as const).map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-border bg-card px-1 py-3">
            <dd className="text-xl font-extrabold tabular-nums">{v}</dd>
            <dt className="text-[11px] text-muted-foreground">{k}</dt>
          </div>
        ))}
      </dl>

      {isMe && <Friends nickname={p.nickname} />}

      <h2 className="mt-8 text-xl font-bold">Tvorové <span className="text-base font-semibold text-muted-foreground">{p.pets.length}</span></h2>
      {p.pets.length ? (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {p.pets.map((pet) => (
            <li key={pet.id} className="flex flex-col items-center rounded-2xl border border-border bg-card px-1 pb-2 pt-1 text-center"
              style={{ background: `linear-gradient(to bottom, color-mix(in oklab, ${PET_TYPE[pet.type].color} 14%, var(--card)), var(--card) 70%)` }}>
              <PetArt type={pet.type} seed={pet.seed} stage={pet.stage} rarity={pet.rarity} size={84} />
              <div className="w-full truncate text-sm font-bold">{pet.name}</div>
              <div className="text-[11px] text-muted-foreground">lvl {pet.level} · <span className={cn('rounded px-1', RARITY[pet.rarity].className)}>{RARITY[pet.rarity].label}</span></div>
            </li>
          ))}
        </ul>
      ) : <p className="mt-1 text-sm text-muted-foreground">Zatím žádní.</p>}
      {isMe && p.pets.length > 0 && <Link href="/pets" className="mt-2 inline-block text-sm font-semibold text-primary underline">Spravovat tvory a evoluce</Link>}

      <h2 className="mt-8 text-xl font-bold">Odznaky</h2>
      {p.badges.length ? (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {p.badges.map((b) => (
            <li key={b.code} className="flex flex-col items-center gap-1 rounded-2xl bg-trail-yellow/15 p-3 text-center">
              <span className="text-3xl" aria-hidden>{b.icon}</span>
              <span className="text-xs font-semibold leading-tight">{b.name}</span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-1 text-sm text-muted-foreground">Zatím žádné.</p>}

      {isMe && (
        <div className="mt-10 space-y-2">
          <button onClick={logout} className="h-12 w-full cursor-pointer rounded-xl border border-border bg-card font-semibold">Odhlásit se</button>
          <button onClick={removeAccount} className="h-12 w-full cursor-pointer rounded-xl font-semibold text-destructive">Smazat účet a všechna data</button>
        </div>
      )}
    </AppShell>
  );
}
