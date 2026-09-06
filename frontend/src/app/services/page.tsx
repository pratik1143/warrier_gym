import { getSEO } from '../../lib/seo';
import { servicesSchema } from '../../lib/schema';
import ServicesClient from './ServicesClient';

export const metadata = getSEO({
  title: 'Gym Services in Mohali | Personal Training & Fitness',
  description: 'Explore personal training, weight loss, strength training, cardio, CrossFit, bodybuilding, and functional fitness services at The Warrior Gym in Mohali.',
  path: '/services'
});

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(servicesSchema) }}
      />
      <ServicesClient />
    </>
  );
}
