import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'The Warrior Gym',
    short_name: 'The Warrior Gym',
    description: 'Premium Fitness Center & Strength Destination in Sector 89, Mohali',
    start_url: '/',
    display: 'standalone',
    background_color: '#08080a',
    theme_color: '#08080a',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: '/gymlogo.png',
        sizes: '192x192',
        type: 'image/png',
      },
    ],
  };
}
