'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** QR kód generovaný v prohlížeči. Vždy tmavé moduly na bílé, ať se dá naskenovat i v tmavém režimu. */
export function QrCode({ value, size = 200, label }: { value: string; size?: number; label: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1c2b22', light: '#ffffff' } })
      .then((u) => alive && setSrc(u));
    return () => { alive = false; };
  }, [value, size]);
  return (
    <div className="inline-block rounded-2xl bg-white p-3 shadow-[0_8px_24px_-12px_rgb(28_43_34/0.4)]" style={{ width: size + 24, height: size + 24 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL z generátoru */}
      {src ? <img src={src} width={size} height={size} alt={label} /> : <div className="h-full w-full animate-pulse rounded-lg bg-black/5" />}
    </div>
  );
}

/** Odkaz k nasdílení: QR pro kamaráda vedle tebe, kopírování a nativní sdílení. */
export function ShareQr({ url, title, hint, className }: { url: string; title: string; hint: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- navigator až po hydrataci
  useEffect(() => setCanShare(typeof navigator.share === 'function'), []);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('flex flex-col items-center text-center', className)}>
      <QrCode value={url} label={`QR kód: ${title}`} />
      <p className="mt-3 max-w-xs text-sm text-muted-foreground">{hint}</p>
      <div className="mt-3 flex w-full max-w-xs gap-2">
        <button onClick={copy} className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold">
          {copied ? <><Check className="h-4 w-4 text-primary" aria-hidden /> Zkopírováno</> : <><Copy className="h-4 w-4" aria-hidden /> Kopírovat odkaz</>}
        </button>
        {canShare && (
          <button onClick={() => navigator.share({ title, url }).catch(() => {})}
            className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
            <Share2 className="h-4 w-4" aria-hidden /> Sdílet
          </button>
        )}
      </div>
    </div>
  );
}
