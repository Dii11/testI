package com.lns.hopmed

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * IncomingCallActivity
 * 
 * Native Android Activity that shows over lock screen for incoming calls
 * on Android 10+ devices (especially budget devices like Tecno Spark 5 Pro)
 * 
 * This Activity:
 * - Shows over lock screen (android:showWhenLocked)
 * - Wakes device and turns screen on (android:turnScreenOn)
 * - Receives fullScreenIntent from notifications
 * - Immediately launches React Native and navigates to IncomingCallScreen
 * - Passes call data via intent extras
 * 
 * CRITICAL: This solves the "notification received but no screen shown" issue
 */
class IncomingCallActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 🚨 CRITICAL: Show over lock screen and wake device
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOnTop()
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
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
            "IncomingCallActivity",
            "📱 Launched with call from: $callerName (Type: $callType)"
        )

        // Launch MainActivity with incoming call intent
        val mainIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            action = "com.lns.hopmed.INCOMING_CALL"
            
            // Pass all call data
            putExtra("callId", callId)
            putExtra("callerId", callerId)
            putExtra("callerName", callerName)
            putExtra("callerType", callerType)
            putExtra("callType", callType)
            putExtra("roomUrl", roomUrl)
            putExtra("metadata", metadataJson)
            putExtra("showIncomingCallScreen", true) // Flag for MainActivity
        }

        startActivity(mainIntent)
        
        // Finish this activity immediately - MainActivity will take over
        finish()
    }

    @Suppress("DEPRECATION")
    private fun setTurnScreenOnTop() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            setTurnScreenOn(true)
        }
    }
}
