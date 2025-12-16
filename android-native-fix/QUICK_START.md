# ⚡ Quick Start - Fix Incoming Call Screen on Android 10

## 🎯 Problem
Tecno Spark 5 Pro gets notification but call screen doesn't show.

## ✅ Solution Summary
Add native Android Activity that wakes device and launches call screen.

---

## 📦 What's Included

```
android-native-fix/
├── IncomingCallActivity.kt              ← Wakes device, shows over lock
├── NativeIncomingCallModule.kt          ← React Native bridge
├── NativeIncomingCallPackage.kt         ← Module registration
├── MainActivity-Integration.kt          ← Code to add to MainActivity
├── INSTALLATION_GUIDE.md                ← Detailed instructions
└── QUICK_START.md                       ← This file
```

---

## 🚀 5-Minute Installation

### 1. Copy Files (2 min)

```bash
# Navigate to Android native directory
cd hopmed-mobile/android/app/src/main/java/com/lns/hopmed/

# Copy the 3 new Kotlin files
cp ../../../../android-native-fix/IncomingCallActivity.kt ./
cp ../../../../android-native-fix/NativeIncomingCallModule.kt ./
cp ../../../../android-native-fix/NativeIncomingCallPackage.kt ./
```

### 2. Update MainActivity.kt (2 min)

Add to `android/app/src/main/java/com/lns/hopmed/MainActivity.kt`:

```kotlin
// At top - add imports
import android.content.Intent
import android.os.Bundle
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

// In MainActivity class - add these methods:
override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    if (intent?.action == "com.lns.hopmed.INCOMING_CALL") {
        handleIncomingCallIntent(intent)
    }
}

override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    intent?.let {
        if (it.action == "com.lns.hopmed.INCOMING_CALL") {
            handleIncomingCallIntent(it)
        }
    }
}

private fun handleIncomingCallIntent(intent: Intent) {
    if (!intent.getBooleanExtra("showIncomingCallScreen", false)) return
    
    val callData = Arguments.createMap().apply {
        putString("callId", intent.getStringExtra("callId") ?: "")
        putString("callerId", intent.getStringExtra("callerId") ?: "")
        putString("callerName", intent.getStringExtra("callerName") ?: "")
        putString("callerType", intent.getStringExtra("callerType") ?: "customer")
        putString("callType", intent.getStringExtra("callType") ?: "video")
        putString("roomUrl", intent.getStringExtra("roomUrl") ?: "")
        putString("metadata", intent.getStringExtra("metadata") ?: "{}")
    }
    
    sendEventToReactNative("IncomingCallReceived", callData)
}

private fun sendEventToReactNative(eventName: String, params: WritableMap?) {
    try {
        reactInstanceManager?.currentReactContext
            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(eventName, params)
    } catch (e: Exception) {
        android.util.Log.e("MainActivity", "Failed to send event: ${e.message}")
    }
}
```

### 3. Update MainApplication.kt (1 min)

Add to `android/app/src/main/java/com/lns/hopmed/MainApplication.kt`:

```kotlin
// In getPackages() method, add:
packages.add(NativeIncomingCallPackage())
```

### 4. Rebuild (Variable time)

```bash
cd hopmed-mobile
eas build --platform android --profile development
```

**Done!** 🎉

---

## 🧪 Test It

1. Install rebuilt app on Tecno device
2. Lock the device
3. Send incoming call push notification
4. **Expected**: Device wakes, call screen appears! ✅

---

## 📱 Expected Logs

When working correctly, you'll see:

```
📱 Launching native IncomingCallActivity
✅ Native IncomingCallActivity launched successfully
📱 Launched with call from: [Name] (Type: video)
📱 Received incoming call intent: [Name]
✅ Sent event to React Native: IncomingCallReceived
📱 Received IncomingCallReceived event from native: [Name]
✅ Navigating to IncomingCall screen from native event
```

---

## ❌ Troubleshooting

**Module not found?**
→ Verify `NativeIncomingCallPackage()` added to MainApplication  
→ Clean rebuild: `cd android && ./gradlew clean`

**Screen doesn't wake?**
→ Check battery optimization settings  
→ Verify permissions in AndroidManifest.xml

**Navigation doesn't happen?**
→ Check logs for `IncomingCallReceived` event  
→ Verify App.tsx has DeviceEventEmitter listener (already updated)

---

## 📖 Need More Details?

See `INSTALLATION_GUIDE.md` for:
- Complete code examples
- Debugging steps
- Performance metrics
- Device compatibility list

---

**Status**: ✅ React Native files already updated  
**Action Required**: Only native Android files (Steps 1-4)  
**Time**: ~5 minutes + build time
