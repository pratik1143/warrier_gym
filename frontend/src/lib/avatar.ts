/**
 * Centralized Avatar Resolver for Warrior Gym OS
 * 
 * Rules:
 * 1. Existing valid uploaded profile image is ALWAYS prioritized.
 * 2. If no photo:
 *    - Gender === 'male' -> Male Default Avatar
 *    - Gender === 'female' -> Female Default Avatar
 *    - Gender missing/unknown -> Generic Fallback Avatar
 */

export const MALE_DEFAULT_AVATAR = 'https://png.pngtree.com/png-clipart/20250116/original/pngtree-smiling-professional-avatar-png-image_20142973.png';
export const FEMALE_DEFAULT_AVATAR = 'https://static.vecteezy.com/system/resources/previews/028/597/534/original/young-cartoon-female-avatar-student-character-wearing-eyeglasses-file-no-background-ai-generated-png.png';
export const GENERIC_DEFAULT_AVATAR = MALE_DEFAULT_AVATAR;

export function resolveAvatarUrl(entity: any): string {
  if (!entity) return GENERIC_DEFAULT_AVATAR;

  // 1. Existing valid uploaded photo
  const photo = 
    entity.profilePhotoUrl ||
    entity.photoURL ||
    entity.photo ||
    entity.avatarUrl ||
    entity.avatar ||
    entity.image ||
    entity.firebasePhotoUrl ||
    entity.legacyPhotoUrl;

  if (
    photo && 
    typeof photo === 'string' && 
    photo.trim().length > 5 && 
    !photo.includes('dicebear.com')
  ) {
    return photo.trim();
  }

  // 2. Gender-based default avatar
  const gender = String(entity.gender || entity.sex || '').trim().toLowerCase();

  if (gender === 'female' || gender === 'f' || gender === 'woman') {
    return FEMALE_DEFAULT_AVATAR;
  }

  if (gender === 'male' || gender === 'm' || gender === 'man') {
    return MALE_DEFAULT_AVATAR;
  }

  // 3. Fallback if gender is unspecified
  return GENERIC_DEFAULT_AVATAR;
}

/**
 * Standard Status Labels & Spellings
 */
export type AccountStatus = 'Active' | 'Inactive' | 'Pending' | 'Expired' | 'Frozen';

export function normalizeStatus(statusRaw: any): AccountStatus {
  if (!statusRaw) return 'Active';
  const s = String(statusRaw).trim().toLowerCase();
  if (s === 'inactive' || s === 'inactiv' || s === 'inactivee' || s === 'deactivated' || s === 'disabled') {
    return 'Inactive';
  }
  if (s === 'expired' || s === 'expire') {
    return 'Expired';
  }
  if (s === 'pending') {
    return 'Pending';
  }
  if (s === 'frozen' || s === 'freeze') {
    return 'Frozen';
  }
  return 'Active';
}
