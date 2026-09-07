import { getSEO } from '../../lib/seo';
import { contactSchema } from '../../lib/schema';
import ContactClient from './ContactClient';

export const metadata = getSEO({
  title: 'Contact The Warrior Gym | Best Gym in Sector 89, Mohali',
  description: 'Visit The Warrior Gym at SCO 30, 31, Sector 89, Mohali. Call +91 98170 23336 to book your gym visit today.',
  path: '/contact'
});

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactSchema) }}
      />
      <ContactClient />
    </>
  );
}
