/**
 * PlatformVerification Component
 *
 * Temporary debugging component to verify platform-specific file resolution
 *
 * Usage: Add this to your SimpleStepsDashboard temporarily:
 * import { PlatformVerification } from '../../components/PlatformVerification';
 *
 * Then render: <PlatformVerification />
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useStepCounter } from '../hooks/health/useStepCounter';
import { useHeartRate } from '../hooks/health/useHeartRate';
import { useCalories } from '../hooks/health/useCalories';
import { useActiveTime } from '../hooks/health/useActiveTime';

export const PlatformVerification: React.FC = () => {
  const stepCounter = useStepCounter();
  const heartRate = useHeartRate({ date: new Date(), period: 'today' });
  const calories = useCalories({ date: new Date(), period: 'today' });
  const activeTime = useActiveTime({ date: new Date(), period: 'today' });

  useEffect(() => {
    console.log('='.repeat(60));
    console.log('🔍 PLATFORM FILE VERIFICATION');
    console.log('='.repeat(60));
    console.log('Platform:', Platform.OS);
    console.log('Expected Files on Android:');
    console.log('  - useStepCounter.android.ts');
    console.log('  - useHeartRate.android.ts');
    console.log('  - useCalories.android.ts');
    console.log('  - useActiveTime.android.ts');
    console.log('-'.repeat(60));

    // Check for platform markers
    const stepCounterFile = '__platformFile' in stepCounter
      ? (stepCounter as any).__platformFile
      : 'NOT FOUND';

    console.log('✅ useStepCounter loaded from:', stepCounterFile);

    if (Platform.OS === 'android' && stepCounterFile.includes('.android.')) {
      console.log('✅ CORRECT: Android-specific file loaded');
    } else if (Platform.OS === 'android' && !stepCounterFile.includes('.android.')) {
      console.log('❌ ERROR: Wrong file loaded on Android!');
    }

    console.log('='.repeat(60));
  }, []);

  const stepCounterFile = '__platformFile' in stepCounter
    ? (stepCounter as any).__platformFile
    : 'unknown';

  const isCorrect = Platform.OS === 'android'
    ? stepCounterFile.includes('.android.')
    : stepCounterFile.includes('.ios.');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Platform File Verification</Text>
      <Text style={styles.platform}>Platform: {Platform.OS}</Text>
      <Text style={styles.file}>File: {stepCounterFile}</Text>
      <Text style={[styles.status, isCorrect ? styles.success : styles.error]}>
        {isCorrect ? '✅ Correct file loaded' : '❌ Wrong file loaded'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    margin: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 10,
  },
  platform: {
    fontSize: 14,
    color: 'white',
    marginBottom: 5,
  },
  file: {
    fontSize: 14,
    color: 'white',
    marginBottom: 5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  status: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 10,
  },
  success: {
    color: '#4ADE80',
  },
  error: {
    color: '#F87171',
  },
});
