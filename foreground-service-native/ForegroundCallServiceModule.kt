package com.lns.hopmed

import android.content.Intent
import android.util.Log
import com.facebook.react.bridge.*

class ForegroundCallServiceModule(private val reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {
    
    companion object {
        private const val TAG = "ForegroundCallServiceModule"
    }
    
    override fun getName() = "ForegroundCallService"
    
    @ReactMethod
    fun startService(callerName: String, callType: String, promise: Promise) {
        try {
            Log.d(TAG, "Starting foreground service from React Native")
            Log.d(TAG, "  Caller: $callerName, Type: $callType")
            
            val intent = Intent(reactContext, ForegroundCallService::class.java).apply {
                action = ForegroundCallService.ACTION_START
                putExtra(ForegroundCallService.EXTRA_CALLER_NAME, callerName)
                putExtra(ForegroundCallService.EXTRA_CALL_TYPE, callType)
            }
            
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
            
            promise.resolve(true)
            Log.d(TAG, "✅ Foreground service start intent sent successfully")
        } catch (e: SecurityException) {
            Log.e(TAG, "❌ Security exception - missing permissions", e)
            promise.reject("PERMISSION_ERROR", "Missing FOREGROUND_SERVICE permission", e)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error starting foreground service", e)
            promise.reject("SERVICE_ERROR", "Failed to start foreground service: ${e.message}", e)
        }
    }
    
    @ReactMethod
    fun stopService(promise: Promise) {
        try {
            Log.d(TAG, "Stopping foreground service from React Native")
            
            val intent = Intent(reactContext, ForegroundCallService::class.java).apply {
                action = ForegroundCallService.ACTION_STOP
            }
            
            reactContext.stopService(intent)
            
            promise.resolve(true)
            Log.d(TAG, "✅ Foreground service stop intent sent successfully")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error stopping foreground service", e)
            promise.reject("SERVICE_ERROR", "Failed to stop foreground service: ${e.message}", e)
        }
    }
    
    @ReactMethod
    fun isServiceRunning(promise: Promise) {
        try {
            val notificationManager = reactContext.getSystemService(android.app.NotificationManager::class.java)
            
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                val activeNotifications = notificationManager?.activeNotifications
                val isRunning = activeNotifications?.any { 
                    it.id == ForegroundCallService.NOTIFICATION_ID 
                } ?: false
                
                Log.d(TAG, "Service running status: $isRunning")
                promise.resolve(isRunning)
            } else {
                promise.resolve(false)
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error checking service status", e)
            promise.reject("SERVICE_ERROR", "Failed to check service status: ${e.message}", e)
        }
    }
}
