import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TaskPulse',
    short_name: 'TaskPulse',
    description: 'AI-assisted project planning, schedule tracking, and dependency management.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafb',
    theme_color: '#4f46e5',
    icons: [
      {
        src: '/icons/web/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-maskable.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
