import fs from 'fs';
import path from 'path';
import { admin, isFirebaseInitialized } from '../firebase';

export interface SavePhotoResult {
  success: boolean;
  photoUrl: string;
  photoStoragePath: string;
  photoSource: 'HIKVISION';
  photoSyncedAt: string;
  storageType: 'FIREBASE_STORAGE' | 'LOCAL_WARRIOR_STORAGE';
  fileSizeBytes: number;
  error?: string;
}

/**
 * Warrior Storage Manager for Hikvision Face Photos
 * Persists images to stable storage (Firebase Storage Bucket preferred, local persistent media fallback).
 * Never saves massive base64 strings directly into Firestore member records.
 */
export class WarriorStorageService {
  private static localUploadsDir = path.resolve(process.cwd(), 'public', 'uploads');

  /**
   * Initializes local storage directories
   */
  public static ensureDirectory(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Saves member face image to stable path: members/hikvision/{employeeNo}/profile.jpg
   */
  public static async saveMemberPhoto(
    employeeNo: string,
    imageBuffer: Buffer,
    reqHost?: string
  ): Promise<SavePhotoResult> {
    const cleanBioId = String(employeeNo).trim();
    const relativeStoragePath = `members/hikvision/${cleanBioId}/profile.jpg`;
    const nowIso = new Date().toISOString();
    const fileSizeBytes = imageBuffer.length;

    // 1. Try Firebase Storage first if initialized
    if (isFirebaseInitialized && admin) {
      try {
        const bucket = admin.storage().bucket();
        if (bucket && bucket.name) {
          const file = bucket.file(relativeStoragePath);
          await file.save(imageBuffer, {
            metadata: {
              contentType: 'image/jpeg',
              metadata: {
                biometricId: cleanBioId,
                source: 'HIKVISION',
                syncedAt: nowIso
              }
            },
            public: true
          });

          // Build public URL
          const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(relativeStoragePath)}?alt=media`;
          console.log(`✅ [Warrior Storage] Saved Hikvision photo for #${cleanBioId} to Firebase Storage: ${relativeStoragePath}`);

          return {
            success: true,
            photoUrl: publicUrl,
            photoStoragePath: relativeStoragePath,
            photoSource: 'HIKVISION',
            photoSyncedAt: nowIso,
            storageType: 'FIREBASE_STORAGE',
            fileSizeBytes
          };
        }
      } catch (fbErr: any) {
        console.warn(`⚠️ [Warrior Storage] Firebase Storage unavailable (${fbErr.message}), falling back to local persistent storage.`);
      }
    }

    // 2. Fallback to Local Warrior Storage
    try {
      const targetDir = path.join(this.localUploadsDir, 'members', 'hikvision', cleanBioId);
      this.ensureDirectory(targetDir);
      const filePath = path.join(targetDir, 'profile.jpg');

      fs.writeFileSync(filePath, imageBuffer);
      console.log(`✅ [Warrior Storage] Saved Hikvision photo for #${cleanBioId} locally: ${filePath} (${fileSizeBytes} bytes)`);

      // Determine public URL
      const host = reqHost || 'localhost:5000';
      const protocol = host.includes('localhost') ? 'http' : 'https';
      const photoUrl = `${protocol}://${host}/uploads/members/hikvision/${cleanBioId}/profile.jpg`;

      return {
        success: true,
        photoUrl,
        photoStoragePath: relativeStoragePath,
        photoSource: 'HIKVISION',
        photoSyncedAt: nowIso,
        storageType: 'LOCAL_WARRIOR_STORAGE',
        fileSizeBytes
      };
    } catch (localErr: any) {
      console.error(`❌ [Warrior Storage] Failed saving local photo for #${cleanBioId}:`, localErr);
      return {
        success: false,
        photoUrl: '',
        photoStoragePath: relativeStoragePath,
        photoSource: 'HIKVISION',
        photoSyncedAt: nowIso,
        storageType: 'LOCAL_WARRIOR_STORAGE',
        fileSizeBytes: 0,
        error: localErr.message
      };
    }
  }

  /**
   * Retrieves the local file path if stored locally
   */
  public static getLocalPhotoPath(employeeNo: string): string | null {
    const cleanBioId = String(employeeNo).trim();
    const filePath = path.join(this.localUploadsDir, 'members', 'hikvision', cleanBioId, 'profile.jpg');
    return fs.existsSync(filePath) ? filePath : null;
  }
}
