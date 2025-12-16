package com.lns.hopmed

import android.content.Intent
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

/**
 * NativeIncomingCallModule
 * 
 * React Native native module to launch IncomingCallActivity
 * from TypeScript/JavaScript code
 * 
 * This provides a bridge between React Native and the native Activity
 */
class NativeIncomingCallModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "NativeIncomingCallModule"
    }

    /**
     * Launch IncomingCallActivity with call data
     * Called from IncomingCallActivityLauncher.ts
     */
    @ReactMethod
    fun launchIncomingCallActivity(callData: ReadableMap) {
        val context = reactApplicationContext
        
        try {
            val intent = Intent(context, IncomingCallActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or 
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                
                // Extract call data from ReadableMap
                putExtra("callId", callData.getString("callId") ?: "")
                putExtra("callerId", callData.getString("callerId") ?: "")
                putExtra("callerName", callData.getString("callerName") ?: "")
                putExtra("callerType", callData.getString("callerType") ?: "customer")
                putExtra("callType", callData.getString("callType") ?: "video")
                putExtra("roomUrl", callData.getString("roomUrl") ?: "")
                
                // Metadata as JSON string
                val metadata = callData.getMap("metadata")
                putExtra("metadata", metadata?.toString() ?: "{}")
            }
            
            context.startActivity(intent)
            
            Log.d(
                "NativeIncomingCallModule",
                "✅ Launched IncomingCallActivity for: ${callData.getString("callerName")}"
            )
        } catch (e: Exception) {
            Log.e(
                "NativeIncomingCallModule",
                "❌ Failed to launch IncomingCallActivity: ${e.message}"
            )
        }
    }
}
