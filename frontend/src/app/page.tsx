import { getSEO } from '../lib/seo';
import { homeSchemas } from '../lib/schema';
import HomeClient from './HomeClient';

export const metadata = getSEO({
  title: 'Best Gym in Mohali | The Warrior Gym - Sohana, Landran Road',
  description: 'Looking for the best gym in Mohali? The Warrior Gym near Landran Road offers personal training, weight loss, strength training, CrossFit, cardio, and premium fitness facilities near Airport Road.',
  path: '/'
});

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeSchemas) }}
      />
      <HomeClient />
    </>
  );
}
