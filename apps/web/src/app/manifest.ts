import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CraftMyFunnel AI — Governed Funnel Workflows',
    short_name: 'CraftMyFunnel',
    description: 'Governed B2B buyer signal detection, AI outreach with human approval, and qualified meeting pipeline management.',
    start_url: '/',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#0284c7',
    icons: [
      {
        src: '/favicon-16x16.png',
        sizes: '16x16',
        type: 'image/png',
      },
      {
        src: '/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/craftmyfunnel-logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
