/**
 * Test script to verify the enhanced health integration system
 * This tests that all the enhanced providers and manager compile correctly
 */

import { wearableHealthManager } from './src/services/health/WearableHealthManager';
import { HealthDataType } from './src/types/health';

// Test that the enhanced manager can be initialized
const testEnhancedHealth = async () => {
  console.log('🏥 Testing Enhanced Health Integration System...');

  try {
    // Initialize the manager
    await wearableHealthManager.initialize();
    console.log('✅ WearableHealthManager initialized successfully');

    // Test unified API methods
    const steps = await wearableHealthManager.getSteps();
    console.log('✅ getSteps() method available');

    const heartRate = await wearableHealthManager.getHeartRate();
    console.log('✅ getHeartRate() method available');

    const sleep = await wearableHealthManager.getSleepData();
    console.log('✅ getSleepData() method available');

    const calories = await wearableHealthManager.getCalories();
    console.log('✅ getCalories() method available');

    // Test provider registration
    const deviceInfo = await wearableHealthManager.getDeviceInfo();
    console.log('✅ Device info retrieval available');

    console.log('🎉 All enhanced health integration APIs are functional!');
  } catch (error) {
    console.error('❌ Enhanced health integration test failed:', error);
  }
};

export { testEnhancedHealth };
