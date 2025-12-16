package com.lns.hopmed

import android.app.*
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

class ForegroundCallService : Service() {
    
    companion object {
        const val NOTIFICATION_ID = 2001
        const val CHANNEL_ID = "HopMedCallChannel"
        private const val TAG = "ForegroundCallService"
        
        // Actions
        const val ACTION_START = "com.lns.hopmed.START_CALL_SERVICE"
        const val ACTION_STOP = "com.lns.hopmed.STOP_CALL_SERVICE"
        
        // Extra keys for notification data
        const val EXTRA_CALLER_NAME = "caller_name"
        const val EXTRA_CALL_TYPE = "call_type"
    }
    
    private var callerName: String = "Unknown"
    private var callType: String = "video"
    
    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "ForegroundCallService created")
        createNotificationChannel()
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "onStartCommand: action=${intent?.action}")
        
        when (intent?.action) {
            ACTION_START -> {
                callerName = intent.getStringExtra(EXTRA_CALLER_NAME) ?: "Unknown"
                callType = intent.getStringExtra(EXTRA_CALL_TYPE) ?: "video"
                Log.d(TAG, "Starting foreground service for call with: $callerName ($callType)")
                startForegroundService()
            }
            ACTION_STOP -> {
                Log.d(TAG, "Stopping foreground service")
                stopForegroundService()
            }
            else -> {
                Log.w(TAG, "Unknown action or null intent")
            }
        }
        
        return START_STICKY
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "ForegroundCallService destroyed")
    }
    
    private fun startForegroundService() {
        try {
            val notification = createNotification()
            
            // ✅ FIX: Android 14+ requires foregroundServiceType parameter
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                // Android 14+ (API 34+) - must specify service type
                startForeground(
                    NOTIFICATION_ID, 
                    notification,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or 
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                )
            } else {
                // Android 13 and below - original method
                startForeground(NOTIFICATION_ID, notification)
            }
            
            Log.d(TAG, "✅ Foreground service started successfully")
        } catch (e: SecurityException) {
            Log.e(TAG, "❌ Security exception while starting foreground service", e)
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error starting foreground service", e)
            throw e
        }
    }
    
    private fun stopForegroundService() {
        Log.d(TAG, "Stopping foreground service and notification")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        stopSelf()
    }
    
    private fun createNotification(): Notification {
        val notificationIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        
        val icon = if (callType == "video") "📹" else "📞"
        val callTypeText = if (callType == "video") "Video" else "Audio"
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("$icon HopMed Call Active")
            .setContentText("$callTypeText call with $callerName")
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setShowWhen(true)
            .setUsesChronometer(true)
            .setAutoCancel(false)
            .build()
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "HopMed Call Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Notification shown during active calls"
                setShowBadge(false)
                enableLights(false)
                enableVibration(false)
                setSound(null, null)
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager?.createNotificationChannel(channel)
            Log.d(TAG, "✅ Notification channel created")
        }
    }
}
