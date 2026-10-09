import Link from 'next/link';
import { Logo } from '@/components/brand/TrailMark';
import { Guide } from '@/components/guide/Guide';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8">
      <header className="flex h-16 items-center"><Logo /></header>
      <main className="flex flex-1 flex-col justify-center">
        <p className="text-7xl font-extrabold tracking-tight text-trail-red">404</p>
        <h1 className="mt-2 text-2xl font-extrabold">Tady značka končí</h1>
        <Guide who="kukadlo" className="mt-8">Z rozhledny tuhle stránku nevidím. Asi jsi odbočil ze stezky, vrať se na mapu.</Guide>
        <Link href="/map" className="mt-8 flex h-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">Zpátky na mapu</Link>
      </main>
    </div>
  );
}
