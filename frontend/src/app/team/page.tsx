import { getSEO } from '../../lib/seo';
import { teamSchema } from '../../lib/schema';
import TeamClient from './TeamClient';

export const metadata = getSEO({
  title: 'Certified Fitness Trainers in Mohali | The Warrior Gym',
  description: 'Meet the experienced fitness trainers at The Warrior Gym. Get expert guidance for weight loss, muscle building, strength training, and overall fitness.',
  path: '/team'
});

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(teamSchema) }}
      />
      <TeamClient />
    </>
  );
}
