'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function RegisterPage() {
  const router = useRouter();
  const { register, user } = useAuth();
  const [f, setF] = React.useState({ nickname: '', email: '', password: '', password2: '', school: '' });
  const [ageGroup, setAgeGroup] = React.useState<'adult' | 'under18' | ''>('');
  const [consent, setConsent] = React.useState(false);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (user) router.push('/map');
  }, [user, router]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (f.password !== f.password2) return setError('Hesla se neshodují.');
    if (!ageGroup) return setError('Vyber věkovou skupinu.');
    if (!consent) return setError('Bez souhlasu se nelze registrovat.');
    setLoading(true);
    try {
      await register({
        username: f.nickname.trim(), nickname: f.nickname.trim(), email: f.email.trim(),
        password: f.password, password2: f.password2, school: f.school.trim(),
        age_group: ageGroup, consent_confirmed: consent,
      });
      router.push('/map');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registrace se nezdařila.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6">
      <Link href="/" className="text-2xl font-extrabold">ZÁPAD <span className="text-primary">GO</span></Link>
      <h1 className="mt-4 text-xl font-bold">Založ si Pas</h1>
      <p className="text-sm text-muted-foreground">Veřejně uvidí ostatní jen tvoji přezdívku.</p>

      {error && (
        <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <form onSubmit={submit} className="mt-4 space-y-3">
        <label className="block text-sm font-semibold">Přezdívka (slouží i k přihlášení)
          <Input value={f.nickname} onChange={set('nickname')} required minLength={3} maxLength={30} pattern="[\w.\-]+" placeholder="vandrovnik_42" autoComplete="username" />
        </label>
        <label className="block text-sm font-semibold">E-mail
          <Input type="email" value={f.email} onChange={set('email')} required autoComplete="email" />
        </label>
        <label className="block text-sm font-semibold">Heslo (min. 8 znaků)
          <Input type="password" value={f.password} onChange={set('password')} required minLength={8} autoComplete="new-password" />
        </label>
        <label className="block text-sm font-semibold">Heslo znovu
          <Input type="password" value={f.password2} onChange={set('password2')} required autoComplete="new-password" />
        </label>
        <label className="block text-sm font-semibold">Škola (nepovinné, pro školní žebříček)
          <Input value={f.school} onChange={set('school')} maxLength={120} placeholder="Gymnázium Cheb" />
        </label>

        <fieldset className="space-y-1 text-sm">
          <legend className="font-semibold">Věk</legend>
          <label className="flex items-center gap-2"><input type="radio" name="age" checked={ageGroup === 'adult'} onChange={() => setAgeGroup('adult')} /> 18 let a více</label>
          <label className="flex items-center gap-2"><input type="radio" name="age" checked={ageGroup === 'under18'} onChange={() => setAgeGroup('under18')} /> Méně než 18 let</label>
        </fieldset>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            {ageGroup === 'under18'
              ? 'Potvrzuji, že mám souhlas zákonného zástupce s registrací a se '
              : 'Souhlasím se '}
            <Link href="/privacy" className="text-primary underline">zpracováním údajů</Link> (poloha při razítku, fotka místa, přezdívka).
          </span>
        </label>

        <Button type="submit" size="lg" className="w-full" isLoading={loading}>
          Začít hrát <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Už máš účet? <Link href="/login" className="font-semibold text-primary">Přihlas se</Link>
      </p>
    </div>
  );
}
