import { getSEO } from '../../lib/seo';
import { privacySchema } from '../../lib/schema';
import PrivacyClient from './PrivacyClient';

export const metadata = getSEO({
  title: 'Privacy Policy | The Warrior Gym Mohali',
  description: 'Read the privacy policy of The Warrior Gym. Learn how we collect, use, and protect your membership and fitness tracking data.',
  path: '/privacy-policy'
});

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(privacySchema) }}
      />
      <PrivacyClient />
    </>
  );
}
