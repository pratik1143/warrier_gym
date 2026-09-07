import { getSEO } from '../../lib/seo';
import { termsSchema } from '../../lib/schema';
import TermsClient from './TermsClient';

export const metadata = getSEO({
  title: 'Terms and Conditions | The Warrior Gym Mohali',
  description: 'Review the membership agreements, payment terms, and facility rules for training at The Warrior Gym in Sector 89, Mohali.',
  path: '/terms'
});

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(termsSchema) }}
      />
      <TermsClient />
    </>
  );
}
