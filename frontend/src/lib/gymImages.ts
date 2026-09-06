/**
 * The Warrior Gym — Local Image Utility
 * All images served from /gym_images/ in the public folder.
 * Add new images to public/gym_images/ and they'll be available here.
 */

export type GymImageCategory =
  | 'hero'
  | 'about'
  | 'services'
  | 'plans'
  | 'trainers'
  | 'equipment'
  | 'cardio'
  | 'strength'
  | 'functional'
  | 'reception'
  | 'membership'
  | 'mobile_app'
  | 'transformation'
  | 'gallery'
  | 'contact'
  | 'cta'
  | 'background';

// All local gym images with category tags (Set to black placeholder)
const gymImageMap: Record<string, { path: string; alt: string; categories: GymImageCategory[] }> = {
  gymInMohali: {
    path: '/black_placeholder.svg',
    alt: 'The Warrior Gym',
    categories: ['hero', 'about', 'background'],
  },
  gymInSohana: {
    path: '/black_placeholder.svg',
    alt: 'The Warrior Gym',
    categories: ['hero', 'gallery', 'background'],
  },
  gymNearMe: {
    path: '/black_placeholder.svg',
    alt: 'The Warrior Gym',
    categories: ['hero', 'cta', 'plans'],
  },
  gymNearby: {
    path: '/black_placeholder.svg',
    alt: 'The Warrior Gym Facilities',
    categories: ['about', 'gallery', 'equipment'],
  },
  gymNearLandran: {
    path: '/black_placeholder.svg',
    alt: 'The Warrior Gym',
    categories: ['contact', 'reception', 'about'],
  },
  affordableMembership: {
    path: '/black_placeholder.svg',
    alt: 'The Warrior Gym Membership',
    categories: ['membership', 'plans', 'reception'],
  },
  personalTrainingMohali: {
    path: '/black_placeholder.svg',
    alt: 'Personal Training — The Warrior Gym',
    categories: ['trainers', 'services', 'functional'],
  },
  personalTraining: {
    path: '/black_placeholder.svg',
    alt: 'Personal Training — The Warrior Gym',
    categories: ['trainers', 'mobile_app', 'transformation'],
  },
  strengthTraining: {
    path: '/black_placeholder.svg',
    alt: 'Strength Training — The Warrior Gym',
    categories: ['strength', 'equipment', 'services', 'gallery'],
  },
  weightLoss: {
    path: '/black_placeholder.svg',
    alt: 'Weight Loss Training — The Warrior Gym',
    categories: ['cardio', 'transformation', 'services', 'gallery'],
  },
  gymNearAirport: {
    path: '/black_placeholder.svg',
    alt: 'The Warrior Gym Facility',
    categories: ['hero', 'cta', 'gallery', 'background', 'plans'],
  },
};

// Pre-indexed category → image paths
const categoryIndex: Record<GymImageCategory, typeof gymImageMap[string][]> = {
  hero: [],
  about: [],
  services: [],
  plans: [],
  trainers: [],
  equipment: [],
  cardio: [],
  strength: [],
  functional: [],
  reception: [],
  membership: [],
  mobile_app: [],
  transformation: [],
  gallery: [],
  contact: [],
  cta: [],
  background: [],
};

Object.values(gymImageMap).forEach(img => {
  img.categories.forEach(cat => {
    categoryIndex[cat].push(img);
  });
});

/**
 * Get a single gym image for a given category.
 * @param category - The image category
 * @param index - Optional specific index (defaults to first/best match)
 */
export function getGymImage(category: GymImageCategory, index = 0): { src: string; alt: string } {
  const images = categoryIndex[category];
  if (!images || images.length === 0) {
    // fallback to any available image
    const fallback = Object.values(gymImageMap)[0];
    return { src: fallback.path, alt: fallback.alt };
  }
  const img = images[index % images.length];
  return { src: img.path, alt: img.alt };
}

/**
 * Get all gym images for a given category (for galleries, carousels, etc.)
 */
export function getGymImages(category: GymImageCategory): { src: string; alt: string }[] {
  const images = categoryIndex[category];
  if (!images || images.length === 0) return [];
  return images.map(img => ({ src: img.path, alt: img.alt }));
}

/**
 * Get all available gallery images
 */
export function getAllGalleryImages(): { src: string; alt: string }[] {
  return Object.values(gymImageMap).map(img => ({ src: img.path, alt: img.alt }));
}
