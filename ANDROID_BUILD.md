# GeoNova Android Build Guide

## Prerequisites
- Android Studio installed
- Java JDK 17+
- Node.js 18+

## Build Steps

1. Build Next.js static export:
   npm run build

2. Sync Capacitor:
   npx cap sync android

3. Open Android Studio:
   npx cap open android

4. In Android Studio:
   - Wait for Gradle sync to complete
   - Build → Generate Signed Bundle/APK
   - Select APK
   - Create keystore (save password securely)
   - Build Release

5. APK location:
   android/app/build/outputs/apk/release/

## Play Store Submission
1. Go to play.google.com/console
2. Create new app
3. Upload APK
4. Fill in store listing using store-assets/
5. Set pricing: Free
6. Submit for review

## Keystore Backup
IMPORTANT: Save your keystore file and password.
If lost you cannot update the app on Play Store.
Store in a safe location outside the project folder.
