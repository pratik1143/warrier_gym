'use client';

import React, { useState, useEffect } from 'react';

interface MemberAvatarProps {
  /** Actual photo URL from member profile (photo / avatarUrl / avatar field) */
  photoUrl?: string | null;
  /** Member gender: 'Male' | 'Female' | 'Other' | 'Not specified' or empty */
  gender?: string | null;
  /** Alt text (member name) */
  name?: string;
  /** Diameter in px — default 48 */
  size?: number;
  /** Extra CSS class */
  className?: string;
}

/**
 * Returns the appropriate fallback avatar asset path based on gender.
 */
function getFallbackAvatar(gender?: string | null): string {
  const g = (gender || '').toLowerCase().trim();
  if (g === 'female' || g === 'f' || g === 'woman') return '/avatar-female.jpg';
  if (g === 'male' || g === 'm' || g === 'man') return '/avatar-male.jpg';
  return '/avatar-male.jpg';
}

export default function MemberAvatar({
  photoUrl,
  gender,
  name = 'Member',
  size = 48,
  className = '',
}: MemberAvatarProps) {
  const fallback = getFallbackAvatar(gender);
  const isValidPhoto = photoUrl && typeof photoUrl === 'string' && photoUrl.trim() !== '' && !photoUrl.includes('dicebear.com');
  const initialSrc = isValidPhoto ? photoUrl.trim() : fallback;

  const [src, setSrc] = useState<string>(initialSrc);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    const newFallback = getFallbackAvatar(gender);
    const valid = photoUrl && typeof photoUrl === 'string' && photoUrl.trim() !== '' && !photoUrl.includes('dicebear.com');
    const newSrc = valid ? photoUrl.trim() : newFallback;
    setSrc(newSrc);
    setHasFailed(false);
  }, [photoUrl, gender]);

  const handleError = () => {
    if (!hasFailed) {
      setHasFailed(true);
      setSrc(fallback);
    } else {
      setSrc('/avatar-neutral.jpg');
    }
  };

  return (
    <div
      className={`shrink-0 rounded-full overflow-hidden border-2 border-white shadow-sm ring-1 ring-slate-200/80 bg-slate-100 ${className}`}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
      title={name}
    >
      <img
        src={src}
        alt={name}
        onError={handleError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
        loading="lazy"
      />
    </div>
  );
}
