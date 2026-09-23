type BiometricMember = {
  biometricId?: unknown;
  biometricUserId?: unknown;
  deviceUserId?: unknown;
  hikvisionUserId?: unknown;
  biometricStatus?: unknown;
  faceEnrollmentStatus?: unknown;
  fingerprintEnrollmentStatus?: unknown;
  biometric?: {
    face?: { status?: unknown };
    fingerprint?: { status?: unknown };
  };
};

const normalizeStatus = (value: unknown) => String(value || '').trim().toUpperCase();

export function getBiometricReadiness(member: BiometricMember) {
  const face = normalizeStatus(member.faceEnrollmentStatus || member.biometric?.face?.status);
  const fingerprint = normalizeStatus(member.fingerprintEnrollmentStatus || member.biometric?.fingerprint?.status);
  const biometricId = String(member.biometricId || member.biometricUserId || member.deviceUserId || member.hikvisionUserId || '').trim();
  const skipped = normalizeStatus(member.biometricStatus) === 'SKIPPED';

  return {
    faceEnrolled: face === 'ENROLLED',
    fingerprintEnrolled: fingerprint === 'ENROLLED',
    hasBiometricId: Boolean(biometricId),
    skipped,
    needsMapping: skipped || !biometricId || face !== 'ENROLLED' || fingerprint !== 'ENROLLED',
  };
}
