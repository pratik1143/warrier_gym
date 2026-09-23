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

// All local gym images with category tags
const gymImageMap: Record<string, { path: string; alt: string; categories: GymImageCategory[] }> = {
  gymInMohali: {
    path: '/gym_images/warrior-deadlift-platform.webp',
    alt: 'The Warrior Gym Olympic Deadlift Platform & Bumper Plates',
    categories: ['hero', 'about', 'background', 'strength'],
  },
  gymInSohana: {
    path: '/gym_images/warrior-spin-bikes.webp',
    alt: 'The Warrior Gym Nex-Gen Spin Cycling Studio',
    categories: ['cardio', 'gallery', 'functional'],
  },
  gymNearMe: {
    path: '/gym_images/warrior-cardio-arena.webp',
    alt: 'The Warrior Gym Cardio Arena & Spin Bikes',
    categories: ['hero', 'cta', 'plans', 'cardio'],
  },
  gymNearby: {
    path: '/gym_images/warrior-hack-squat.webp',
    alt: 'The Warrior Gym Hack Squat & Lower Body Station',
    categories: ['about', 'gallery', 'equipment', 'strength'],
  },
  gymNearLandran: {
    path: '/gym_images/warrior-preacher-curl.webp',
    alt: 'The Warrior Gym Preacher Arm Curl Station with EZ Bar',
    categories: ['contact', 'reception', 'about', 'equipment'],
  },
  affordableMembership: {
    path: '/gym_images/warrior-leg-press.webp',
    alt: 'The Warrior Gym 45-Degree Incline Leg Press Machine',
    categories: ['membership', 'plans', 'equipment', 'strength'],
  },
  personalTrainingMohali: {
    path: '/gym_images/warrior-dumbbells-zone.webp',
    alt: 'The Warrior Gym Personal Training & Free Weights Area',
    categories: ['trainers', 'services', 'functional'],
  },
  personalTraining: {
    path: '/gym_images/warrior-deadlift-platform.webp',
    alt: 'Personal Training — The Warrior Gym Olympic Platform',
    categories: ['trainers', 'mobile_app', 'transformation'],
  },
  strengthTraining: {
    path: '/gym_images/warrior-dumbbells-rack.webp',
    alt: 'Strength Training — The Warrior Gym Free Weights Dumbbell Line',
    categories: ['strength', 'equipment', 'services', 'gallery'],
  },
  weightLoss: {
    path: '/gym_images/warrior-cardio-treadmills.webp',
    alt: 'Weight Loss & Cardio — The Warrior Gym Commercial Treadmills',
    categories: ['cardio', 'transformation', 'services', 'gallery'],
  },
  gymNearAirport: {
    path: '/gym_images/warrior-adductor-machines.webp',
    alt: 'The Warrior Gym Adductor & Resistance Training Floor',
    categories: ['hero', 'cta', 'gallery', 'background', 'plans'],
  },
  plateLoadedSquat: {
    path: '/gym_images/warrior-plate-loaded.webp',
    alt: 'The Warrior Gym Plate-Loaded Squat & Heavy Weight Tree',
    categories: ['strength', 'equipment', 'functional', 'gallery'],
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
