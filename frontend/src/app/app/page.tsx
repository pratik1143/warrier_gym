import { getSEO } from '../../lib/seo';
import { appSchema } from '../../lib/schema';
import AppClient from '../app-page/AppClient';

export const metadata = getSEO({
  title: 'The Warrior Gym App | Workout & Membership Tracking',
  description: 'Download the The Warrior Gym App to manage memberships, track workouts, monitor your progress, and stay connected with your fitness journey.',
  path: '/app'
});

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }}
      />
      <AppClient />
    </>
  );
}
