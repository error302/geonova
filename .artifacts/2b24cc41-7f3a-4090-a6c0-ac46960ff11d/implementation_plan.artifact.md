# METARDU Access — Android Mobile App Compilation Plan

This plan outlines the steps to compile the METARDU web platform into a native Android application using Capacitor. The result will be a standalone Android project (`android/` directory) and a buildable APK/App Bundle suitable for testing and Play Store submission.

## User Review Required

> [!IMPORTANT]
> **Android SDK & JDK**: This process requires a valid Android SDK and Java Development Kit (JDK) installed on the system. If these are missing, the native build steps will fail.
> **Environment Variables**: The build script disables Sentry and PWA features specifically for the mobile build to ensure compatibility with Capacitor's static export.

## Proposed Changes

### Mobile Setup & Initialization

#### [NEW] [android/](file:///C:/Users/user/Desktop/METARDU/android)
A new native Android project directory will be created by Capacitor. This contains the Java/Kotlin code, Android manifest, and resource files required to run the web app on a mobile device.

#### [MODIFY] [mobile-setup.mjs](file:///C:/Users/user/Desktop/METARDU/scripts/mobile-setup.mjs)
We will use this existing script to orchestrate the build. It ensures that the Next.js app is built with `output: 'export'` (required for Capacitor) before syncing files to the Android project.

---

## Implementation Steps

1. **Static Web Build**: Execute `next build` with `MOBILE_BUILD=true`. This generates a static version of the app in the `out/` directory.
2. **Capacitor Initialization**: Run `npx cap add android` to generate the native Android scaffolding.
3. **Resource Injection**: Copy app icons and splash screens from `public/icons` into the Android resource directories (`android/app/src/main/res`).
4. **Asset Synchronization**: Run `npx cap sync android` to copy the `out/` directory into the Android project's assets.
5. **Verification Build**: Run `./gradlew assembleDebug` within the `android/` directory to generate a test APK.

## Verification Plan

### Automated Tests
- **Build Verification**: Ensure the `out/index.html` file exists after the web build.
- **Native Sync**: Verify `android/app/src/main/assets/public` contains the web assets.
- **APK Generation**: Confirm `app-debug.apk` is generated in `android/app/build/outputs/apk/debug/`.

### Manual Verification
- **App Launch**: Open the project in Android Studio using `npm run mobile:open`.
- **UI Check**: Verify the app loads the METARDU login/dashboard on an emulator or physical device.
- **Hardware Integration**: (Optional) Test Web Serial/USB connectivity if a device is available.
