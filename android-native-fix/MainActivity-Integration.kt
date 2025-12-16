/**
 * MainActivity Integration Code
 * 
 * Add these methods to your existing MainActivity.kt file
 * Location: android/app/src/main/java/com/lns/hopmed/MainActivity.kt
 * 
 * INSTRUCTIONS:
 * 1. Open your MainActivity.kt
 * 2. Add the imports at the top
 * 3. Add the methods inside your MainActivity class
 * 4. Make sure to handle the incoming call intent
 */

// ========== ADD THESE IMPORTS AT TOP OF FILE ==========
import android.content.Intent
import android.os.Bundle
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

// ========== ADD THESE METHODS INSIDE MainActivity CLASS ==========

/**
 * Handle new intent - receives incoming call intent from IncomingCallActivity
 */
override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    
    if (intent?.action == "com.lns.hopmed.INCOMING_CALL") {
        handleIncomingCallIntent(intent)
    }
}

/**
 * Handle incoming call intent and send to React Native
 */
private fun handleIncomingCallIntent(intent: Intent) {
    val showIncomingCallScreen = intent.getBooleanExtra("showIncomingCallScreen", false)
    
    if (!showIncomingCallScreen) {
        return
    }
    
    // Extract call data from intent
    val callId = intent.getStringExtra("callId") ?: ""
    val callerId = intent.getStringExtra("callerId") ?: ""
    val callerName = intent.getStringExtra("callerName") ?: ""
    val callerType = intent.getStringExtra("callerType") ?: "customer"
    val callType = intent.getStringExtra("callType") ?: "video"
    val roomUrl = intent.getStringExtra("roomUrl") ?: ""
    val metadataJson = intent.getStringExtra("metadata") ?: "{}"
    
    // Log for debugging
    android.util.Log.d(
        "MainActivity",
        "📱 Received incoming call intent: $callerName (Type: $callType)"
    )
    
    // Prepare call data for React Native
    val callData = Arguments.createMap().apply {
        putString("callId", callId)
        putString("callerId", callerId)
        putString("callerName", callerName)
        putString("callerType", callerType)
        putString("callType", callType)
        putString("roomUrl", roomUrl)
        putString("metadata", metadataJson)
    }
    
    // Send event to React Native
    sendEventToReactNative("IncomingCallReceived", callData)
}

/**
 * Send event to React Native JavaScript
 */
private fun sendEventToReactNative(eventName: String, params: WritableMap?) {
    try {
        reactInstanceManager?.currentReactContext
            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(eventName, params)
            
        android.util.Log.d(
            "MainActivity",
            "✅ Sent event to React Native: $eventName"
        )
    } catch (e: Exception) {
        android.util.Log.e(
            "MainActivity",
            "❌ Failed to send event to React Native: ${e.message}"
        )
    }
}

/**
 * Override onCreate to handle initial intent
 */
override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    
    // Handle incoming call if launched from notification
    intent?.let { initialIntent ->
        if (initialIntent.action == "com.lns.hopmed.INCOMING_CALL") {
            handleIncomingCallIntent(initialIntent)
        }
    }
}

// ========== END OF INTEGRATION CODE ==========

/**
 * COMPLETE EXAMPLE MainActivity.kt structure:
 * 
 * package com.lns.hopmed
 * 
 * import android.content.Intent
 * import android.os.Bundle
 * import com.facebook.react.ReactActivity
 * import com.facebook.react.ReactActivityDelegate
 * import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
 * import com.facebook.react.defaults.DefaultReactActivityDelegate
 * import com.facebook.react.bridge.Arguments
 * import com.facebook.react.bridge.WritableMap
 * import com.facebook.react.modules.core.DeviceEventManagerModule
 * import expo.modules.ReactActivityDelegateWrapper
 * 
 * class MainActivity : ReactActivity() {
 * 
 *   override fun getMainComponentName(): String = "hopmed"
 * 
 *   override fun createReactActivityDelegate(): ReactActivityDelegate {
 *     return ReactActivityDelegateWrapper(
 *       this,
 *       BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
 *       DefaultReactActivityDelegate(
 *         this,
 *         mainComponentName,
 *         fabricEnabled
 *       )
 *     )
 *   }
 *   
 *   // ADD ALL THE METHODS FROM ABOVE HERE
 *   override fun onCreate(savedInstanceState: Bundle?) { ... }
 *   override fun onNewIntent(intent: Intent?) { ... }
 *   private fun handleIncomingCallIntent(intent: Intent) { ... }
 *   private fun sendEventToReactNative(eventName: String, params: WritableMap?) { ... }
 * }
 */
