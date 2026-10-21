# The Warrior Gym CRM Production Deployment

## 1. Vercel Frontend Deployment
1. Initialize git and commit your code:
   ```bash
   git add .
   git commit -m "The Warrior Gym CRM Production Ready"
   ```
2. Push to GitHub:
   ```bash
   git push origin main
   ```
3. Go to [Vercel](https://vercel.com) and import your GitHub repository.
4. Set the Root Directory to `frontend`.
5. Ensure the Framework Preset is `Next.js`.
6. Add all Environment Variables from `frontend/.env.local`.
7. Click **Deploy**. Vercel will automatically build and host the site.

## 2. Firebase Backend
The Firebase configurations have already been set. Vercel will communicate with Firebase using the environment variables.
Ensure Firebase Firestore Rules allow authenticated read/writes and Storage rules allow image uploads.

## 3. Gym PC: Hikvision Biometric Agent (DS-K1T320EFWX)
Ye agent gym ke Windows PC par 24x7 chalta hai. Ye Firestore ki `biometric_enrollment` queue se commands uthata hai (face/finger enroll, block/unblock, delete, sync member) aur terminal se punches/photos Firestore me bhejta hai.
1. `warrior-biometric-agent/requirements.txt` install karo: `pip install -r warrior-biometric-agent/requirements.txt`
2. `backend/.env` me terminal ki settings rakho (HIKVISION_HOST, HIKVISION_PORT, HIKVISION_USERNAME, HIKVISION_PASSWORD, FIREBASE_*). Passwords repo me commit mat karo.
3. **Pehle ping test:** `health-check.bat` chalao. Ye `ping_hikvision.py` se terminal ka TCP + ISAPI check karta hai (PASS/FAIL).
4. Agent start: `start-gym-listener.bat` | stop: `stop-gym-listener.bat` | restart: `restart-gym-listener.bat`. Auto-start ke liye `warrior-biometric-agent/install-agent-autostart.bat`.
5. Sirf `warrior-biometric-agent` chalao. Purana `device-service/` (ESSL K90) saath me mat chalao, nahi to wo bhi commands utha lega.
6. Create Member me face/finger skip ho jaye to server `hikvision_sync_member` queue karta hai. Agent chalu ho tab user + photo terminal par apne aap sync hota hai. Fingerprint terminal par hi enroll hoti hai.

**All done! The CRM is now production-ready.**
