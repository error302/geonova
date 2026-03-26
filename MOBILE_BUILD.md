# GeoNova Mobile Build Guide

## Prerequisites

1. **Java JDK 17+** - Required for Android builds
2. **Node.js 18+**
3. **Android Studio** (recommended) or command-line tools

### Install Java (if not present)

**Windows:**
```powershell
# Using Chocolatey
choco install openjdk17

# Or download from https://adoptium.net/
```

**macOS:**
```bash
brew install openjdk@17
```

**Linux (Ubuntu):**
```bash
sudo apt update
sudo apt install openjdk-17-jdk
```

## Quick Build Commands

### Option 1: Using npm scripts

```bash
# Install dependencies
npm install

# Build web assets
npm run build

# Sync with Android
npx cap sync android

# Build debug APK
cd android
./gradlew assembleDebug
```

### Option 2: Using Android Studio

1. Open the project in Android Studio:
   ```bash
   npx cap open android
   ```

2. Wait for Gradle sync to complete

3. Build → Build Bundle(s) / APK(s) → Build APK

## Build Output

The APK will be generated at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

## Release Build (with signing)

1. Create a keystore (one time):
   ```bash
   keytool -genkey -v -keystore geonova.keystore -alias geonova -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Configure signing in `android/app/build.gradle`

3. Build release:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

## Testing the APK

1. Transfer `app-debug.apk` to your Android device
2. Enable "Install from unknown sources" in settings
3. Install and test

## Troubleshooting

### Java not found
- Ensure JAVA_HOME is set correctly
- Restart terminal after installation

### Gradle errors
- Clear gradle cache: `./gradlew clean`
- Ensure Android SDK is installed

### Capacitor sync issues
```bash
npx cap sync android --force
```

## App Features on Mobile

- All 19 survey tools work offline
- Project management
- Field data collection
- Map visualization
- Offline storage with sync
