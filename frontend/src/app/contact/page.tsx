import { getSEO } from '../../lib/seo';
import { contactSchema } from '../../lib/schema';
import ContactClient from './ContactClient';

export const metadata = getSEO({
  title: 'Contact The Warrior Gym | Best Gym Near Landran Road',
  description: 'Visit The Warrior Gym at 2nd Floor, MNB Group, SCO 16-17, Landran Road, Sohana, Mohali. Call +91 97793 33155 to book your gym visit today.',
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
