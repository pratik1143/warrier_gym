import { getSEO } from '../../lib/seo';
import PlansClient from './PlansClient';

export const metadata = getSEO({
  title: 'Affordable Gym Membership Plans in Mohali | The Warrior Gym',
  description: 'Choose affordable gym membership plans at The Warrior Gym in Sector 89, Mohali. Monthly, quarterly, half-yearly, and yearly fitness packages available.',
  path: '/packages' // Canonical points to /packages as requested
});

export default function Page() {
  return <PlansClient />;
}
