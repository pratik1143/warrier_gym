'use client';

import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { getInitials, getRandomColor } from '@/lib/utils';
import { resolveAvatarUrl, MALE_DEFAULT_AVATAR, FEMALE_DEFAULT_AVATAR, GENERIC_DEFAULT_AVATAR } from '@/lib/avatar';

export interface MemberAvatarProps {
  member?: any;
  src?: string;
  name?: string;
  gender?: string;
  className?: string;
  size?: number;
  showFallbackBadge?: boolean;
}

export function getMemberPhotoUrl(member: any): string {
  if (!member) return GENERIC_DEFAULT_AVATAR;
  return resolveAvatarUrl(member);
}

export default function MemberAvatar({
  member,
  src,
  name,
  gender,
  className = 'w-10 h-10 rounded-full object-cover',
  size = 40,
  showFallbackBadge = true,
}: MemberAvatarProps) {
  const resolvedName = name || member?.name || 'Member';
  const resolvedGender = gender || member?.gender || member?.sex;
  
  // 1. Determine best image source: explicit src > entity photo > gender default avatar
  const initialPhotoUrl = src || (member ? resolveAvatarUrl({ ...member, gender: resolvedGender }) : resolveAvatarUrl({ gender: resolvedGender }));

  const [currentSrc, setCurrentSrc] = useState<string>(initialPhotoUrl);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    const newSrc = src || (member ? resolveAvatarUrl({ ...member, gender: resolvedGender }) : resolveAvatarUrl({ gender: resolvedGender }));
    setCurrentSrc(newSrc);
    setHasError(false);
  }, [member, src, resolvedGender]);

  const handleError = () => {
    // If the image failed and it wasn't already the default avatar, fallback to gender avatar
    if (currentSrc !== MALE_DEFAULT_AVATAR && currentSrc !== FEMALE_DEFAULT_AVATAR) {
      const g = String(resolvedGender || '').trim().toLowerCase();
      if (g === 'female' || g === 'f') {
        setCurrentSrc(FEMALE_DEFAULT_AVATAR);
      } else {
        setCurrentSrc(MALE_DEFAULT_AVATAR);
      }
    } else {
      setHasError(true);
    }
  };

  if (!hasError && currentSrc) {
    return (
      <img
        src={currentSrc}
        alt={resolvedName}
        className={`${className} bg-slate-100 object-cover`}
        onError={handleError}
        loading="lazy"
      />
    );
  }

  // Fallback: Initials box
  const initials = getInitials(resolvedName);
  const color = getRandomColor(resolvedName);

  return (
    <div
      className={`flex items-center justify-center font-bold text-white shadow-xs rounded-full shrink-0 select-none ${className}`}
      style={{
        backgroundColor: color,
        fontSize: size ? Math.max(10, Math.floor(size * 0.4)) : undefined,
      }}
      title={resolvedName}
    >
      {initials || <User size={Math.floor(size * 0.5)} />}
    </div>
  );
}
