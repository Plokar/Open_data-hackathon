'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/brand/TrailMark';
import { Guide } from '@/components/guide/Guide';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, user } = useAuth();

  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const redirectUrl = searchParams.get('redirect') || '/map';

  React.useEffect(() => {
    if (user) router.push(redirectUrl);
  }, [user, router, redirectUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return setError('Vyplň přezdívku i heslo.');
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
      router.push(redirectUrl);
    } catch {
      setError('Přezdívka nebo heslo nesedí.');
    } finally {
      setLoading(false);
    }
  };

  const fill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError('');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8">
      <header className="flex h-16 items-center"><Logo /></header>

      <main className="flex flex-1 flex-col justify-center">
        <Guide who="boza">Vítej zpátky. Ukaž Pas a pustím tě dál.</Guide>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <h1 className="text-2xl font-extrabold">Přihlášení</h1>
          <label className="block text-sm font-semibold">
            Přezdívka
            <Input className="mt-1.5" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
          </label>
          <label className="block text-sm font-semibold">
            Heslo
            <Input className="mt-1.5" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password" required
              rightIcon={
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="grid h-10 w-10 cursor-pointer place-items-center hover:text-foreground"
                  aria-label={showPassword ? 'Skrýt heslo' : 'Zobrazit heslo'}>
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              } />
          </label>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <Button type="submit" size="lg" className="h-14 w-full text-lg" isLoading={loading}>Přihlásit se</Button>
          <Link href="/forgot-password" className="block text-center text-sm text-muted-foreground underline">Zapomněl jsem heslo</Link>
        </form>

        <div className="mt-8 rounded-2xl border border-dashed border-input p-4">
          <p className="text-sm font-semibold">Ukázkový účet pro porotu</p>
          <p className="mt-1 text-sm text-muted-foreground">Organizátor smí razítkovat i bez kontroly vzdálenosti.</p>
          <Button type="button" variant="outline" size="sm" className="mt-3 w-full" onClick={() => fill('admin', 'admin123456')}>Vyplnit účet organizátora</Button>
        </div>
      </main>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Nemáš Pas? <Link href="/start" className="font-semibold text-primary underline">Založ si ho jen se jménem</Link>
      </p>
    </div>
  );
}
