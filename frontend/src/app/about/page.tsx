import { getSEO } from '../../lib/seo';
import { aboutSchema } from '../../lib/schema';
import AboutClient from './AboutClient';

export const metadata = getSEO({
  title: 'About The Warrior Gym | Best Gym in Sohana, Mohali',
  description: 'Learn about The Warrior Gym in Sohana, Mohali. Our certified trainers, premium equipment, and personalized fitness programs help members achieve their fitness goals.',
  path: '/about'
});

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }}
      />
      <AboutClient />
    </>
  );
}
