import { mediaUrl, type PlaceDetail } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Fotka místa s povinným uvedením autora a licence (Commons je většinou CC BY-SA). */
export function PlacePhoto({ place, className }: { place: PlaceDetail; className?: string }) {
  const photo = place.extra.photo;
  if (!photo) return null;
  return (
    <figure className={cn('overflow-hidden rounded-2xl bg-muted', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- obrázek z backendu, next/image by potřeboval remotePatterns */}
      <img src={mediaUrl(photo.url)} alt={place.name} loading="lazy" className="aspect-[16/10] w-full object-cover" />
      <figcaption className="truncate px-3 py-1.5 text-[11px] text-muted-foreground">
        Foto: <a href={photo.source} target="_blank" rel="noreferrer" className="underline">{photo.author || 'Wikimedia Commons'}</a>, {photo.license}
      </figcaption>
    </figure>
  );
}

/** Popis místa: přednostně úvod z Wikipedie, jinak text z dat kraje. */
export function PlaceAbout({ place, clamp = false }: { place: PlaceDetail; clamp?: boolean }) {
  const wiki = place.extra.wiki;
  const text = wiki?.extract || place.description;
  if (!text) return null;
  return (
    <div className="max-w-[65ch]">
      <p className={cn('whitespace-pre-line leading-relaxed', clamp && 'line-clamp-4')}>{text}</p>
      {wiki && (
        <a href={wiki.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-muted-foreground underline">
          Z Wikipedie, článek {wiki.title}
        </a>
      )}
    </div>
  );
}
