'use client';

import { useState } from 'react';
import { Check, KeyRound } from 'lucide-react';
import { Guide } from '@/components/guide/Guide';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { authApi, errorMessage } from '@/lib/api';

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <Input className="mt-1.5" {...props} />
    </label>
  );
}

/**
 * E-mail a heslo k účtu. Onboarding zakládá účet jen se jménem, takže dokud si hráč nenastaví
 * vlastní údaje, k Pasu se z jiného zařízení nebo po odhlášení nevrátí.
 */
export function AccountSettings({ claimed }: { claimed: boolean }) {
  const { user, refreshUser } = useAuth();
  const [open, setOpen] = useState(!claimed);
  const [email, setEmail] = useState(claimed ? user?.email ?? '' : '');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [current, setCurrent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await authApi.setCredentials({ email, password, password2, ...(claimed ? { current_password: current } : {}) });
      await refreshUser();
      setPassword('');
      setPassword2('');
      setCurrent('');
      setDone(true);
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const form = (
    <form onSubmit={save} className="mt-4 space-y-3" noValidate>
      <Field label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      <Field label={claimed ? 'Nové heslo (nepovinné)' : 'Heslo'} type="password" value={password} onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password" minLength={8} required={!claimed} />
      <Field label="Heslo ještě jednou" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" />
      {claimed && <Field label="Aktuální heslo" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />}
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="w-full" isLoading={busy}>
        {claimed ? 'Uložit změny' : 'Pojistit účet'}
      </Button>
      <p className="text-xs text-muted-foreground">Heslo aspoň 8 znaků, ne jen čísla. Přihlásíš se pak přezdívkou nebo e-mailem.</p>
    </form>
  );

  if (!claimed) {
    return (
      <section id="ucet" className="scroll-mt-20 rounded-2xl border-2 border-trail-yellow/70 bg-trail-yellow/10 p-4" aria-labelledby="account-h">
        <h2 id="account-h" className="flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4" aria-hidden /> Pojisti si účet</h2>
        <p className="mt-1 text-sm text-muted-foreground">Bez e-mailu a hesla se k Pasu po odhlášení nebo z jiného telefonu nevrátíš.</p>
        {form}
      </section>
    );
  }

  return (
    <section id="ucet" className="scroll-mt-20 rounded-2xl border border-border bg-card p-4" aria-labelledby="account-h">
      <h2 id="account-h" className="flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4" aria-hidden /> Účet</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Přihlášení: přezdívka <b className="text-foreground">{user?.profile.nickname}</b> nebo e-mail <b className="text-foreground">{user?.email}</b>.
      </p>
      {done && <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-primary"><Check className="h-4 w-4" aria-hidden /> Uloženo.</p>}
      {open ? form : (
        <button onClick={() => { setOpen(true); setDone(false); }} className="mt-3 h-11 w-full cursor-pointer rounded-xl border border-border text-sm font-semibold hover:bg-accent">
          Změnit e-mail nebo heslo
        </button>
      )}
    </section>
  );
}

/** Upozornění nahoře na profilu, dokud účet není pojištěný. */
export function ClaimBanner() {
  return (
    <Guide who="boza" className="mt-5"
      action={<a href="#ucet" className="inline-flex h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground">Přidat e-mail a heslo</a>}>
      Tvůj Pas zatím drží jen tenhle telefon. Přidej si <b>e-mail a heslo</b>, ať se k razítkům a tvorům vrátíš odkudkoli.
    </Guide>
  );
}
