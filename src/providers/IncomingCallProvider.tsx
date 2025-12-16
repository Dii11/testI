/**
 * IncomingCallProvider
 * 
 * Inspired by TelegramClone's CallProvider architecture
 * 
 * This provider ensures navigation happens RELIABLY when calls are answered.
 * By placing navigation logic at the provider level (where useNavigation() is guaranteed
 * to work), we eliminate the race condition that was preventing the call UI from appearing.
 * 
 * Key improvements:
 * 1. Navigation is ALWAYS ready (no race condition)
 * 2. Single source of truth for call handling
 * 3. Automatic navigation when call is answered
 * 4. Works in all app states (foreground, background, killed)
 */

import React, { useEffect, useState, PropsWithChildren } from 'react';
import { useNavigation } from '@react-navigation/native';
import IncomingCallManager, { type IncomingCallData } from '../services/IncomingCallManager';
import CallNavigationManager from '../services/CallNavigationManager';
import { VIDEO_CALL_CONFIG } from '../config/videoCallConfig';
import ForegroundCallService from '../services/ForegroundCallService';

export function IncomingCallProvider({ children }: PropsWithChildren) {
  const navigation = useNavigation();
  const [activeCall, setActiveCall] = useState<IncomingCallData | null>(null);

  useEffect(() => {
    const manager = IncomingCallManager.getInstance();
    
    console.log('📞 [IncomingCallProvider] Registering call handlers');

    // 🚨 CRITICAL: Handle call answered
    // Navigation is GUARANTEED to work here because we're in a provider
    // that's wrapped by NavigationContainer
    manager.onCallAnswered((callData) => {
      console.log('📞 [IncomingCallProvider] Call answered:', callData.callerName);
      console.log('   Caller type:', callData.callerType);
      console.log('   Call type:', callData.callType);
      
      setActiveCall(callData);
      
      // 🚨 NEW: Start foreground service when call is answered
      // This is CRITICAL for Android 12+ to prevent app from being killed
      (async () => {
        try {
          await ForegroundCallService.getInstance().startService(
            callData.callerName,
            callData.callType
          );
          console.log('✅ [IncomingCallProvider] Foreground service started');
        } catch (error) {
          console.error('⚠️ [IncomingCallProvider] Failed to start foreground service:', error);
          // Don't block call if service fails - call will continue without it
        }
      })();
      
      // Register call session with navigation manager
      CallNavigationManager.getInstance().startCallSession(
        callData.callType,
        callData.callerType === 'doctor' ? 'DoctorDetails' : 'CustomerDetails',
        callData.metadata || {},
        callData.callerName,
        callData.callerType,
        callData.roomUrl || VIDEO_CALL_CONFIG.DEFAULT_ROOM_URL
      );

      // Navigate to appropriate details screen
      try {
        if (callData.callerType === 'doctor') {
          const doctorData = callData.metadata?.doctor || {
            id: callData.callerId,
            userId: callData.callerId, // Ensure userId is set
            firstName: callData.callerName.split(' ')[0] || 'Unknown',
            lastName: callData.callerName.split(' ').slice(1).join(' ') || 'Doctor',
            email: `doctor_${callData.callerId}@hopmed.com`,
            phoneNumber: '',
            specialization: 'General Practice',
            accountType: 'health_specialist' as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          console.log('✅ [IncomingCallProvider] Navigating to DoctorDetails');
          (navigation as any).navigate('DoctorDetails', {
            doctor: doctorData,
            restoreCall: true,
            incomingCallData: callData,
          });
        } else {
          const customerData = callData.metadata?.customer || {
            id: callData.callerId,
            userId: callData.callerId, // Ensure userId is set
            firstName: callData.callerName.split(' ')[0] || 'Unknown',
            lastName: callData.callerName.split(' ').slice(1).join(' ') || 'Patient',
            email: `patient_${callData.callerId}@hopmed.com`,
            phoneNumber: '',
            accountType: 'customer' as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          console.log('✅ [IncomingCallProvider] Navigating to CustomerDetails');
          (navigation as any).navigate('CustomerDetails', {
            customer: customerData,
            restoreCall: true,
            incomingCallData: callData,
          });
        }

        console.log('✅ [IncomingCallProvider] Navigation completed successfully');
      } catch (error) {
        console.error('❌ [IncomingCallProvider] Navigation failed:', error);
      }
    });

    // Handle call declined
    manager.onCallDeclined((callData) => {
      console.log('❌ [IncomingCallProvider] Call declined:', callData.callerName);
      setActiveCall(null);
      
      // 🚨 NEW: Stop foreground service when call is declined
      (async () => {
        try {
          await ForegroundCallService.getInstance().stopService();
          console.log('✅ [IncomingCallProvider] Foreground service stopped');
        } catch (error) {
          console.error('⚠️ [IncomingCallProvider] Failed to stop foreground service:', error);
        }
      })();
      
      // End call session
      CallNavigationManager.getInstance().endCallSession();
    });

    console.log('✅ [IncomingCallProvider] Handlers registered');

    // Cleanup on unmount
    return () => {
      console.log('🧹 [IncomingCallProvider] Cleaning up');
    };
  }, [navigation]);

  return <>{children}</>;
}

export default IncomingCallProvider;
