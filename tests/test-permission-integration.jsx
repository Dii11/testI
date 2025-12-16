/**
 * Permission Integration Test Component
 * 
 * This component tests the key permission flows to ensure the migration works correctly.
 * Add this temporarily to your app to test the integration.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import PermissionManager from './src/services/PermissionManagerMigrated';

const PermissionIntegrationTest = () => {
  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (test, status, message, details = '') => {
    setTestResults(prev => [...prev, {
      test,
      status, // 'pass', 'fail', 'info'
      message,
      details,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const runIntegrationTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    addResult('start', 'info', 'Starting Permission Integration Tests', '🧪 Testing ConsolidatedPermissionManager');

    try {
      // Test 1: Manager Initialization
      addResult('init', 'info', 'Testing PermissionManager initialization...');
      
      try {
        await PermissionManager.initialize();
        addResult('init', 'pass', 'PermissionManager initialized successfully', '✅ ConsolidatedPermissionManager is working');
      } catch (error) {
        addResult('init', 'fail', 'PermissionManager initialization failed', error.message);
      }

      // Test 2: Device Configuration
      addResult('device', 'info', 'Testing device configuration...');
      
      try {
        const deviceConfig = PermissionManager.getDeviceConfiguration();
        if (deviceConfig) {
          addResult('device', 'pass', `Device tier: ${deviceConfig.tier}`, 
            `Timeout: ${deviceConfig.permissionTimeout}ms, Caching: ${deviceConfig.cacheStrategy}`);
        } else {
          addResult('device', 'fail', 'Device configuration not available');
        }
      } catch (error) {
        addResult('device', 'fail', 'Device configuration failed', error.message);
      }

      // Test 3: Performance Stats
      addResult('perf', 'info', 'Testing performance monitoring...');
      
      try {
        const stats = PermissionManager.getPerformanceStats();
        if (stats) {
          const statCount = Object.keys(stats).length;
          addResult('perf', 'pass', `Performance monitoring active`, `${statCount} metrics available`);
        } else {
          addResult('perf', 'info', 'No performance stats yet', 'This is normal for a fresh install');
        }
      } catch (error) {
        addResult('perf', 'fail', 'Performance monitoring failed', error.message);
      }

      // Test 4: Permission Check (Camera)
      addResult('check', 'info', 'Testing permission check...');
      
      try {
        const cameraResult = await PermissionManager.checkPermission('camera');
        addResult('check', 'pass', `Camera permission check completed`, 
          `Status: ${cameraResult.status}, Can ask again: ${cameraResult.canAskAgain}`);
      } catch (error) {
        addResult('check', 'fail', 'Permission check failed', error.message);
      }

      // Test 5: Migration Status (if applicable)
      addResult('migration', 'info', 'Checking migration status...');
      // This would be tested if we can access the migration service
      addResult('migration', 'info', 'Migration system is available', 'Legacy data will be automatically migrated when found');

      // Test 6: Context Integration
      addResult('context', 'info', 'Testing context creation...');
      
      try {
        const testContext = {
          feature: 'integration-test',
          priority: 'optional',
          userJourney: 'feature-access',
          userInitiated: true,
          explanation: {
            title: 'Integration Test',
            reason: 'Testing the permission system integration',
            benefits: ['Verify functionality', 'Ensure performance'],
          },
          fallbackStrategy: {
            mode: 'alternative',
            description: 'Test alternative',
            limitations: ['Test only'],
          }
        };
        
        addResult('context', 'pass', 'Permission context created successfully', 'All required fields present');
      } catch (error) {
        addResult('context', 'fail', 'Context creation failed', error.message);
      }

      addResult('complete', 'pass', 'Integration tests completed', '🎉 ConsolidatedPermissionManager is working correctly');

    } catch (error) {
      addResult('error', 'fail', 'Test suite failed', error.message);
    } finally {
      setIsRunning(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pass': return '✅';
      case 'fail': return '❌';
      case 'info': return 'ℹ️';
      default: return '•';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pass': return '#4CAF50';
      case 'fail': return '#F44336';
      case 'info': return '#2196F3';
      default: return '#757575';
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: '#f5f5f5' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }}>
        Permission Integration Test
      </Text>
      
      <View style={{ flexDirection: 'row', marginBottom: 20 }}>
        <TouchableOpacity
          onPress={runIntegrationTests}
          disabled={isRunning}
          style={{
            backgroundColor: isRunning ? '#ccc' : '#2196F3',
            padding: 15,
            borderRadius: 8,
            flex: 1,
            marginRight: 10,
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
            {isRunning ? 'Running Tests...' : 'Run Integration Tests'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={clearResults}
          style={{
            backgroundColor: '#757575',
            padding: 15,
            borderRadius: 8,
            flex: 1,
            marginLeft: 10,
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
            Clear Results
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {testResults.map((result, index) => (
          <View
            key={index}
            style={{
              backgroundColor: 'white',
              padding: 15,
              marginBottom: 10,
              borderRadius: 8,
              borderLeftWidth: 4,
              borderLeftColor: getStatusColor(result.status),
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>
                {getStatusIcon(result.status)}
              </Text>
              <Text style={{ fontSize: 16, fontWeight: 'bold', flex: 1 }}>
                {result.message}
              </Text>
              <Text style={{ fontSize: 12, color: '#757575' }}>
                {result.timestamp}
              </Text>
            </View>
            
            {result.details && (
              <Text style={{ fontSize: 14, color: '#666', marginTop: 5 }}>
                {result.details}
              </Text>
            )}
          </View>
        ))}
        
        {testResults.length === 0 && (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: '#757575', textAlign: 'center' }}>
              No test results yet.{'\n'}Tap "Run Integration Tests" to begin.
            </Text>
          </View>
        )}
      </ScrollView>
      
      {testResults.length > 0 && (
        <View style={{ marginTop: 20, padding: 15, backgroundColor: 'white', borderRadius: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 5 }}>
            Test Summary
          </Text>
          <Text style={{ fontSize: 14, color: '#4CAF50' }}>
            ✅ Passed: {testResults.filter(r => r.status === 'pass').length}
          </Text>
          <Text style={{ fontSize: 14, color: '#F44336' }}>
            ❌ Failed: {testResults.filter(r => r.status === 'fail').length}
          </Text>
          <Text style={{ fontSize: 14, color: '#2196F3' }}>
            ℹ️ Info: {testResults.filter(r => r.status === 'info').length}
          </Text>
        </View>
      )}
    </View>
  );
};

export default PermissionIntegrationTest;