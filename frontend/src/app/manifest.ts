import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ZÁPAD GO – hra nad daty Karlovarského a Plzeňského kraje',
    short_name: 'ZÁPAD GO',
    description: 'Sbírej razítka a PETy na místech Karlovarského a Plzeňského kraje.',
    lang: 'cs',
    start_url: '/map',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#6366f1',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
