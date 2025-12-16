# 🤖 Automated Foreground Service Installation

## ✨ What's Automated

The Expo config plugin `with-foreground-service.js` **automatically**:

1. ✅ Copies `ForegroundCallService.kt` to Android project
2. ✅ Copies `ForegroundCallServiceModule.kt` to Android project
3. ✅ Copies `ForegroundCallServicePackage.kt` to Android project
4. ✅ Updates `MainApplication.kt` to register native module
5. ✅ Updates `AndroidManifest.xml` with:
   - Service declaration
   - FOREGROUND_SERVICE permission
   - FOREGROUND_SERVICE_MICROPHONE permission
   - FOREGROUND_SERVICE_CAMERA permission

**You don't need to manually copy or edit ANY files!** 🎉

---

## 🚀 Quick Start (3 Steps)

### Step 1: Add Plugin to app.config.js

```javascript
// app.config.js
export default {
  // ... existing config ...
  plugins: [
    // ... existing plugins ...
    './plugins/with-foreground-service.js', // 🚨 ADD THIS LINE
  ],
};
```

### Step 2: Build

```bash
# For EAS Build
eas build --platform android --profile development

# OR for local build
npx expo prebuild --clean
npx expo run:android
```

### Step 3: Done! ✅

That's it! The plugin does everything automatically during the build.

---

## 📋 What Happens During Build

When you run `eas build` or `npx expo prebuild`, you'll see:

```
🔧 Configuring Foreground Call Service...

📱 Copying foreground service native files...
  ✅ Copied ForegroundCallService.kt
  ✅ Copied ForegroundCallServiceModule.kt
  ✅ Copied ForegroundCallServicePackage.kt
✅ Foreground service native files copied successfully

📱 Updating MainApplication.kt for ForegroundCallService...
✅ MainApplication.kt updated for ForegroundCallService

📱 Updating AndroidManifest.xml for Foreground Service...
  ✅ Added permission: android.permission.FOREGROUND_SERVICE
  ✅ Added permission: android.permission.FOREGROUND_SERVICE_MICROPHONE
  ✅ Added permission: android.permission.FOREGROUND_SERVICE_CAMERA
  ✅ Added ForegroundCallService to AndroidManifest.xml
✅ AndroidManifest.xml updated for Foreground Service

✅ Foreground Call Service configured!
```

---

## 🔍 How It Works

### The Plugin (`plugins/with-foreground-service.js`)

The plugin uses Expo's config plugin system to:

1. **Copy Files** (`withDangerousMod`):
   - Reads `.kt` files from `foreground-service-native/`
   - Copies them to `android/app/src/main/java/com/lns/hopmed/`

2. **Update MainApplication.kt** (`withMainApplication`):
   - Finds the packages list
   - Adds `ForegroundCallServicePackage()`

3. **Update AndroidManifest.xml** (`withAndroidManifest`):
   - Adds required permissions
   - Declares the foreground service

### Smart & Safe

- ✅ Only modifies if not already modified
- ✅ Won't duplicate code
- ✅ Idempotent (can run multiple times safely)
- ✅ Preserves existing code

---

## 🧪 Verify It Worked

### Check Build Logs

Look for these success messages:

```
✅ Foreground service native files copied successfully
✅ MainApplication.kt updated for ForegroundCallService
✅ AndroidManifest.xml updated for Foreground Service
✅ Foreground Call Service configured!
```

### Verify Files Exist

```bash
# Check if native files were copied
ls android/app/src/main/java/com/lns/hopmed/

# Should see:
# ForegroundCallService.kt
# ForegroundCallServiceModule.kt
# ForegroundCallServicePackage.kt
```

### Check MainApplication.kt

```bash
grep "ForegroundCallServicePackage" android/app/src/main/java/com/lns/hopmed/MainApplication.kt

# Should output:
# packages.add(ForegroundCallServicePackage())
```

### Check AndroidManifest.xml

```bash
grep "ForegroundCallService" android/app/src/main/AndroidManifest.xml

# Should find the service declaration
```

---

## 🎯 Comparison: Manual vs Automated

### Manual Installation (OLD Way) ❌

```bash
# Step 1: Copy 3 files manually
cp foreground-service-native/ForegroundCallService.kt android/app/src/main/java/com/lns/hopmed/
cp foreground-service-native/ForegroundCallServiceModule.kt android/app/src/main/java/com/lns/hopmed/
cp foreground-service-native/ForegroundCallServicePackage.kt android/app/src/main/java/com/lns/hopmed/

# Step 2: Edit MainApplication.kt manually
# (open file, add package registration, save)

# Step 3: Edit AndroidManifest.xml manually
# (add 3 permissions, add service declaration)

# Step 4: Build
eas build --platform android
```

**Time**: ~15 minutes  
**Error prone**: ✅ Yes  
**Manual steps**: 6+

### Automated Installation (NEW Way) ✅

```bash
# Step 1: Add one line to app.config.js
# Step 2: Build
eas build --platform android
```

**Time**: 0 minutes (automatic)  
**Error prone**: ❌ No  
**Manual steps**: 1

---

## 📊 What Gets Modified

### Files Copied (3 files)

1. `ForegroundCallService.kt`
   - Main service implementation
   - Handles start/stop service
   - Creates persistent notification

2. `ForegroundCallServiceModule.kt`
   - React Native bridge
   - Exports `startService()`, `stopService()`, `isServiceRunning()`

3. `ForegroundCallServicePackage.kt`
   - Registers the module with React Native

### Files Modified (2 files)

1. `MainApplication.kt`
   ```kotlin
   // Added automatically:
   packages.add(ForegroundCallServicePackage())
   ```

2. `AndroidManifest.xml`
   ```xml
   <!-- Added automatically: -->
   <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
   <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
   <uses-permission android:name="android.permission.FOREGROUND_SERVICE_CAMERA" />
   
   <service
       android:name=".ForegroundCallService"
       android:enabled="true"
       android:exported="false"
       android:foregroundServiceType="microphone|camera"
       android:stopWithTask="false" />
   ```

---

## 🛠️ Troubleshooting

### Plugin doesn't run?

**Check app.config.js**:
```javascript
plugins: [
  './plugins/with-foreground-service.js', // Should be here
]
```

**Verify plugin file exists**:
```bash
ls plugins/with-foreground-service.js
# Should exist ✅
```

### Files not copied?

**Check source directory exists**:
```bash
ls foreground-service-native/
# Should show:
# ForegroundCallService.kt
# ForegroundCallServiceModule.kt
# ForegroundCallServicePackage.kt
```

**Run prebuild with verbose logging**:
```bash
npx expo prebuild --clean --platform android
# Watch for plugin output
```

### Build fails?

**Clean everything**:
```bash
# Clean Expo cache
npx expo prebuild --clean

# Clean Android
cd android
./gradlew clean
cd ..

# Rebuild
eas build --platform android --profile development
```

---

## ✅ Testing the Foreground Service

### Test 1: Service Starts

```bash
1. Build and install app
2. Start a call
3. Expected:
   - ✅ Persistent notification appears
   - ✅ "HopMed Call Active" with caller name
   - ✅ Can't be swiped away
```

### Test 2: Service Keeps App Alive

```bash
1. Start a call
2. Press home button (app goes to background)
3. Wait 10-30 minutes
4. Return to app
5. Expected:
   - ✅ Call still active
   - ✅ App not killed by Android
   - ✅ Notification still showing
```

### Test 3: Service Stops

```bash
1. During active call
2. End the call
3. Expected:
   - ✅ Notification disappears
   - ✅ Service stops
   - ✅ Console shows: "Foreground service stopped successfully"
```

### Test 4: Works on Android 12+

```bash
1. Test on Android 12 or 13 device
2. Start call, put in background
3. Expected:
   - ✅ No "App is using battery" warnings
   - ✅ App stays alive indefinitely
   - ✅ Compliant with Android requirements
```

---

## 🎯 Integration Status

Your TypeScript code is **already integrated**! ✅

The foreground service automatically starts/stops via:

### IncomingCallProvider.tsx

```typescript
// When call is answered
await ForegroundCallService.getInstance().startService(
  callData.callerName,
  callData.callType
);

// When call ends
await ForegroundCallService.getInstance().stopService();
```

**No additional code needed!** The native module is exposed automatically.

---

## 🚀 Expected Console Logs

### When Service Starts:

**TypeScript**:
```
🚀 Starting foreground service: Dr. John Smith (video)
✅ Foreground call service started successfully
✅ [IncomingCallProvider] Foreground service started
```

**Native (Logcat)**:
```
[ForegroundCallServiceModule] Starting foreground service from React Native
[ForegroundCallServiceModule]   Caller: Dr. John Smith, Type: video
[ForegroundCallServiceModule] ✅ Foreground service start intent sent successfully
[ForegroundCallService] Starting foreground service for call with: Dr. John Smith (video)
[ForegroundCallService] ✅ Foreground service started successfully
```

### When Service Stops:

**TypeScript**:
```
🛑 Stopping foreground service
✅ Foreground call service stopped successfully
✅ [IncomingCallProvider] Foreground service stopped
```

**Native (Logcat)**:
```
[ForegroundCallServiceModule] Stopping foreground service from React Native
[ForegroundCallServiceModule] ✅ Foreground service stop intent sent successfully
[ForegroundCallService] Stopping foreground service and notification
[ForegroundCallService] ForegroundCallService destroyed
```

---

## 📦 Files in This Directory

```
foreground-service-native/
├── AUTOMATED_INSTALL.md           # This file
├── ForegroundCallService.kt       # Main service (auto-copied)
├── ForegroundCallServiceModule.kt # React Native bridge (auto-copied)
└── ForegroundCallServicePackage.kt # Module registration (auto-copied)
```

**Plugin Location**:
```
plugins/
└── with-foreground-service.js     # Expo config plugin
```

---

## 💡 Pro Tips

**Tip 1**: Keep `foreground-service-native/` in your repo
- Plugin reads files from there during build
- Easy to update or modify later

**Tip 2**: Commit the plugin
- `plugins/with-foreground-service.js`
- Team members get automatic setup too!

**Tip 3**: Test on real device
- Emulator may not enforce Android 12+ restrictions
- Real device shows true behavior

**Tip 4**: Monitor notification
- Should show elapsed call time
- Should be non-dismissible
- Should be LOW priority (quiet)

---

## 🎉 Summary

### Before Automation:
- ❌ Copy 3 Kotlin files manually
- ❌ Edit MainApplication.kt manually
- ❌ Edit AndroidManifest.xml manually (5 additions)
- ❌ Easy to miss steps
- ❌ Time: ~15 minutes
- ❌ Error-prone

### After Automation:
- ✅ Add one line to app.config.js
- ✅ Run build
- ✅ Everything happens automatically
- ✅ No manual steps
- ✅ Time: 0 minutes
- ✅ Foolproof

---

## 🚀 Next Steps

1. **Add plugin to app.config.js** (see Step 1 above)

2. **Build the app**:
   ```bash
   eas build --platform android --profile development
   ```

3. **Verify logs** show plugin ran successfully

4. **Test** on a real Android device

5. **Enjoy** app staying alive during calls! 🎉

---

**Status**: ✅ Ready to use  
**Setup time**: 2 minutes  
**Manual steps required**: 1 (add plugin to config)  
**Android 12+ compliant**: ✅ Yes  
**Production ready**: ✅ Yes
