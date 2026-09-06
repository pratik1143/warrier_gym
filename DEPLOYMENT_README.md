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

## 3. Windows Device Service (Biometrics)
This service runs on the local Windows PC in the gym (24x7) to connect with the ESSL K90 Pro device and sync attendances/members to Firebase.
1. Open Command Prompt as Administrator and navigate to the `device-service` folder.
2. Install requirements if not already installed:
   ```bash
   pip install -r requirements.txt
   ```
3. To start the services seamlessly in the background on startup, create a shortcut to `start_services.vbs` (located in the `device-service` folder) and place it in the Windows Startup folder:
   - Press `Win + R`, type `shell:startup`, and press Enter.
   - Right-click and choose "Paste Shortcut" of the `start_services.vbs` file.
   - To manually start it now, just double-click `start_services.vbs`. It will run the python service silently without keeping a command window open.
4. Logs can be found at `warrior_gym_device_service.log`.

**All done! The CRM is now production-ready.**
