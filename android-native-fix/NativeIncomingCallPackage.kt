package com.lns.hopmed

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * NativeIncomingCallPackage
 * 
 * React Native package to register the NativeIncomingCallModule
 * 
 * INSTRUCTIONS:
 * Add this package to your MainApplication.kt:
 * 
 * In getPackages() method, add:
 *   packages.add(NativeIncomingCallPackage())
 */
class NativeIncomingCallPackage : ReactPackage {
    
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(NativeIncomingCallModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
