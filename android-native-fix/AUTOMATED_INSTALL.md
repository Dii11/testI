# 🤖 Automated Installation (No Manual Steps!)

## ✨ What's Automated

The Expo config plugin `with-incoming-call-native-module.js` **automatically**:

1. ✅ Copies `IncomingCallActivity.kt` to Android project
2. ✅ Copies `NativeIncomingCallModule.kt` to Android project
3. ✅ Copies `NativeIncomingCallPackage.kt` to Android project
4. ✅ Updates `MainActivity.kt` with incoming call handling
5. ✅ Updates `MainApplication.kt` to register native module

**You don't need to manually copy or edit ANY files!** 🎉

---

## 🚀 How to Use

### Just Build!

That's it. Seriously.

```bash
# For EAS Build
eas build --platform android --profile development

# OR for local build
npx expo prebuild --clean
npx expo run:android
```

The plugin runs automatically during the build process and sets up everything.

---

## 📋 What Happens During Build

When you run `eas build` or `npx expo prebuild`, you'll see:

```
🔧 Configuring Incoming Call Native Module...

📱 Copying incoming call native files...
  ✅ Copied IncomingCallActivity.kt
  ✅ Copied NativeIncomingCallModule.kt
  ✅ Copied NativeIncomingCallPackage.kt
✅ Native files copied successfully

📱 Updating MainActivity.kt...
✅ MainActivity.kt updated

📱 Updating MainApplication.kt...
✅ MainApplication.kt updated

✅ Incoming Call Native Module configured!
```

---

## 🔍 How It Works

### The Plugin (`plugins/with-incoming-call-native-module.js`)

**Already added to `app.config.js`**: ✅

```javascript
plugins: [
  // ... other plugins ...
  './plugins/with-incoming-call-native-module.js', // 🚨 Auto-installs native module
]
```

### What the Plugin Does

1. **During Prebuild/Build**:
   - Reads native files from `android-native-fix/` directory
   - Copies them to `android/app/src/main/java/com/lns/hopmed/`
   - Modifies `MainActivity.kt` to add incoming call handlers
   - Modifies `MainApplication.kt` to register the native module

2. **Smart Updates**:
   - Only modifies files if not already modified
   - Preserves existing code
   - Adds code at the right locations

3. **Safe & Idempotent**:
   - Can run multiple times safely
   - Won't duplicate code
   - Won't break existing functionality

---

## 🧪 Verify It Worked

After building, check the logs for:

```
✅ Native files copied successfully
✅ MainActivity.kt updated
✅ MainApplication.kt updated
```

You can also verify the files exist:

```bash
# Check if native files were copied
ls android/app/src/main/java/com/lns/hopmed/

# Should see:
# IncomingCallActivity.kt
# NativeIncomingCallModule.kt
# NativeIncomingCallPackage.kt
# MainActivity.kt (modified)
```

---

## 🎯 Comparison: Manual vs Automated

### Manual Installation (OLD Way)
```bash
# Step 1: Copy files manually
cp android-native-fix/IncomingCallActivity.kt android/app/src/main/java/com/lns/hopmed/
cp android-native-fix/NativeIncomingCallModule.kt android/app/src/main/java/com/lns/hopmed/
cp android-native-fix/NativeIncomingCallPackage.kt android/app/src/main/java/com/lns/hopmed/

# Step 2: Edit MainActivity.kt manually
# (open file, add imports, add methods, save)

# Step 3: Edit MainApplication.kt manually
# (open file, add package registration, save)

# Step 4: Build
eas build --platform android
```

### Automated Installation (NEW Way) ✨
```bash
# Just build!
eas build --platform android
```

**That's it!** The plugin does everything. 🎉

---

## ⚙️ Plugin Configuration

The plugin is already configured in `app.config.js`:

```javascript
plugins: [
  // ... existing plugins ...
  './plugins/with-incoming-call-native-module.js',
]
```

**No configuration needed!** It just works.

---

## 🔄 When to Rebuild

You need to rebuild (run the plugin again) when:

1. **First time setup**: Initial build with the fix
2. **Native file changes**: If you modify any `.kt` files in `android-native-fix/`
3. **Clean build**: After `npx expo prebuild --clean`
4. **Android issues**: If Android project gets corrupted

**Hot reload won't work** - native code changes require full rebuild.

---

## 🛠️ Troubleshooting

### Plugin doesn't run?

**Check `app.config.js`**:
```javascript
plugins: [
  './plugins/with-incoming-call-native-module.js', // Should be here
]
```

**Verify plugin file exists**:
```bash
ls plugins/with-incoming-call-native-module.js
# Should exist ✅
```

### Files not copied?

**Check source directory exists**:
```bash
ls android-native-fix/
# Should show:
# IncomingCallActivity.kt
# NativeIncomingCallModule.kt
# NativeIncomingCallPackage.kt
```

**Run prebuild with verbose**:
```bash
npx expo prebuild --clean --platform android
# Watch for plugin output
```

### MainActivity not updated?

**The plugin looks for**:
```kotlin
class MainActivity : ReactActivity() {
```

If your MainActivity structure is different, you may need to manually add the code.

**Check if already modified**:
```bash
grep "handleIncomingCallIntent" android/app/src/main/java/com/lns/hopmed/MainActivity.kt
# If found, it's already updated ✅
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

## 📊 Before & After

### Before (Manual)
- ❌ Copy 3 files manually
- ❌ Edit MainActivity.kt manually (50+ lines)
- ❌ Edit MainApplication.kt manually
- ❌ Easy to make mistakes
- ❌ Tedious for updates
- ❌ Time: ~10 minutes

### After (Automated)
- ✅ Run build command
- ✅ Plugin does everything
- ✅ No manual steps
- ✅ No mistakes possible
- ✅ Easy to update
- ✅ Time: 0 minutes (automatic)

---

## 🎓 Understanding the Plugin

The plugin uses Expo's config plugin system:

```javascript
// withDangerousMod: Directly modify Android project files
withDangerousMod(config, ['android', async (config) => {
  // Copy files to Android project
}])

// withMainActivity: Modify MainActivity.kt
withMainActivity(config, (config) => {
  // Add imports and methods
})

// withMainApplication: Modify MainApplication.kt
withMainApplication(config, (config) => {
  // Register native module
})
```

It's called "dangerous" because it directly modifies native files, but it's **safe when done correctly** (like our plugin).

---

## ✅ Checklist

After your first build with the plugin:

- [ ] Build completed successfully
- [ ] Saw plugin messages in build logs
- [ ] Files exist in `android/app/src/main/java/com/lns/hopmed/`:
  - [ ] `IncomingCallActivity.kt`
  - [ ] `NativeIncomingCallModule.kt`
  - [ ] `NativeIncomingCallPackage.kt`
- [ ] `MainActivity.kt` contains `handleIncomingCallIntent`
- [ ] `MainApplication.kt` contains `NativeIncomingCallPackage()`
- [ ] App installs on device
- [ ] Incoming call test works ✅

---

## 🚀 Next Steps

1. **Build the app**:
   ```bash
   eas build --platform android --profile development
   ```

2. **Install on Tecno device**

3. **Test incoming call**:
   - Lock device
   - Send call
   - Watch it wake up and show call screen! 🎉

---

## 💡 Pro Tips

**Tip 1**: Keep `android-native-fix/` directory in your repo
- Plugin reads files from there
- Easy to update in the future

**Tip 2**: Use `npx expo prebuild --clean` if things go wrong
- Regenerates entire Android project
- Plugin runs fresh

**Tip 3**: Check build logs
- Look for plugin output
- Verify each step completed

**Tip 4**: Commit the plugin file
- `plugins/with-incoming-call-native-module.js`
- Team members get automatic setup too!

---

## 🎉 Summary

**Old way**: Manual file copying and editing (~10 minutes)

**New way**: Just build (0 manual steps) ✨

**Status**: ✅ Plugin ready and configured

**Action**: Run `eas build --platform android` and you're done!

---

**Created**: 2025-10-06  
**Plugin**: `with-incoming-call-native-module.js`  
**Configuration**: Already added to `app.config.js` ✅  
**Status**: Ready to use! 🚀
