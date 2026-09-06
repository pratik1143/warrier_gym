import { Metadata } from 'next';

const BASE_URL = 'https://thewarriorgym.in';

const DEFAULT_KEYWORDS = [
  'Gym in Mohali',
  'Best Gym in Mohali',
  'Gym Near Landran Road',
  'Gym Near Airport Road',
  'Fitness Center Mohali',
  'CrossFit Mohali',
  'Strength Training Mohali',
  'Weight Loss Gym',
  'Bodybuilding Gym',
  'Personal Trainer Mohali',
  'Premium Gym Mohali',
  'Fitness Club Mohali'
];

interface SEOOptions {
  title: string;
  description: string;
  path: string;
}

export function getSEO({ title, description, path }: SEOOptions): Metadata {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const canonicalUrl = `${BASE_URL}${cleanPath === '/' ? '' : cleanPath}`;

  return {
    title,
    description,
    keywords: DEFAULT_KEYWORDS.join(', '),
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'The Warrior Gym',
      locale: 'en_IN',
      type: 'website',
      images: [
        {
          url: `${BASE_URL}/gym_images/Best Gym in Mohali.jpg`,
          width: 1200,
          height: 630,
          alt: 'The Warrior Gym - Premium Fitness Center in Sohana, Mohali',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${BASE_URL}/gym_images/Best Gym in Mohali.jpg`],
    },
    other: {
      'theme-color': '#08080a',
    },
  };
}

/**
 * Returns JSON-LD structured data for The Warrior Gym (LocalBusiness / ExerciseGym)
 */
export function getGymSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ExerciseGym',
    'name': 'The Warrior Gym',
    'image': `${BASE_URL}/gym_images/Best Gym in Mohali.jpg`,
    '@id': `${BASE_URL}/#gym`,
    'url': BASE_URL,
    'telephone': '+91 97793 33155',
    'email': 'thewarriorgym@gmail.com',
    'address': {
      '@type': 'PostalAddress',
      'streetAddress': '2nd Floor, MNB Group, SCO 16-17, Landran Road, Sohana',
      'addressLocality': 'Sahibzada Ajit Singh Nagar (Mohali)',
      'addressRegion': 'Punjab',
      'postalCode': '140308',
      'addressCountry': 'IN'
    },
    'geo': {
      '@type': 'GeoCoordinates',
      'latitude': '30.6978809',
      'longitude': '76.6833446'
    },
    'openingHoursSpecification': [
      {
        '@type': 'OpeningHoursSpecification',
        'dayOfWeek': [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday'
        ],
        'opens': '05:00',
        'closes': '23:00'
      },
      {
        '@type': 'OpeningHoursSpecification',
        'dayOfWeek': 'Sunday',
        'opens': '06:00',
        'closes': '12:00'
      }
    ],
    'sameAs': [
      'https://www.instagram.com/thewarriorgym',
      'https://www.youtube.com/@TheWarriorGym'
    ]
  };
}
