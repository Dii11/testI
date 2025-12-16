# Foreground Call Service - Native Module

## 🎯 Purpose

Prevents Android from killing the app during active calls (required for Android 12+).

## ✨ Features

- ✅ Persistent "Call Active" notification
- ✅ Keeps app alive in background
- ✅ Shows elapsed call time
- ✅ Android 12+ compliant
- ✅ **Fully automated installation**

## 🚀 Quick Start

### Option 1: Automated (Recommended) ✅

**1. Add plugin to `app.config.js`:**

```javascript
plugins: [
  './plugins/with-foreground-service.js', // Add this line
]
```

**2. Build:**

```bash
eas build --platform android
```

**Done!** Everything is automatic.

👉 See [AUTOMATED_INSTALL.md](./AUTOMATED_INSTALL.md) for details.

### Option 2: Manual

See [../FOREGROUND_SERVICE_IMPLEMENTATION.md](../FOREGROUND_SERVICE_IMPLEMENTATION.md)

## 📁 Files

- **ForegroundCallService.kt** - Main service implementation
- **ForegroundCallServiceModule.kt** - React Native bridge
- **ForegroundCallServicePackage.kt** - Module registration

## 🔌 Usage (TypeScript)

Already integrated! The service starts/stops automatically:

```typescript
// IncomingCallProvider.tsx automatically calls:
await ForegroundCallService.getInstance().startService(callerName, callType);
await ForegroundCallService.getInstance().stopService();
```

## 📊 Status

- [x] Native module created
- [x] TypeScript wrapper created  
- [x] Expo plugin created
- [x] Integrated with IncomingCallProvider
- [ ] **Add plugin to app.config.js** ← YOU ARE HERE
- [ ] Build and test

## 🎉 Benefits

**Without Foreground Service:**
- ❌ Android kills app after ~5 minutes in background
- ❌ Calls drop unexpectedly
- ❌ Poor user experience

**With Foreground Service:**
- ✅ App stays alive indefinitely
- ✅ Calls never drop
- ✅ Professional experience
- ✅ Android 12+ compliant

## 🚀 Next Step

Add one line to `app.config.js` and build! See [AUTOMATED_INSTALL.md](./AUTOMATED_INSTALL.md).
