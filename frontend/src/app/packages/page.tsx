import { getSEO } from '../../lib/seo';
import { packagesSchema } from '../../lib/schema';
import PlansClient from '../plans/PlansClient';

export const metadata = getSEO({
  title: 'Affordable Gym Membership Plans in Mohali | The Warrior Gym',
  description: 'Choose affordable gym membership plans at The Warrior Gym near Landran Road. Monthly, quarterly, half-yearly, and yearly fitness packages available.',
  path: '/packages'
});

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(packagesSchema) }}
      />
      <PlansClient />
    </>
  );
}
