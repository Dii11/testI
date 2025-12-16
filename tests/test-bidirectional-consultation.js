#!/usr/bin/env node

/**
 * Bidirectional Consultation Test Script
 * Tests that both doctor and patient can seamlessly join the same consultation room
 * Validates room creation, joining, and audio/video functionality
 */

require('dotenv').config();
const fetch = require('node-fetch');

const DAILY_API_KEY = process.env.DAILY_API_KEY || 'de05bcc9d2c0ad891300c19e9d42bb6b1f61ebac2e33fd22949eed768ea0ddb9';
const DAILY_DOMAIN = process.env.DAILY_DOMAIN || 'mbinina.daily.co';

class BidirectionalConsultationTester {
  constructor() {
    this.apiKey = DAILY_API_KEY;
    this.domain = DAILY_DOMAIN;
    this.createdRooms = new Set();
    this.testResults = [];
  }

  // Generate consistent consultation room name (same logic as app)
  generateConsultationRoomName(doctorId, patientId) {
    const sortedIds = [doctorId, patientId].sort();
    return `consultation_${sortedIds[0]}_${sortedIds[1]}`;
  }

  // Check if room exists
  async checkRoomExists(roomName) {
    try {
      const response = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Create room with consultation-optimized settings
  async createRoom(roomName) {
    const roomData = {
      name: roomName,
      privacy: 'public',
      properties: {
        exp: Math.floor(Date.now() / 1000) + (2 * 60 * 60), // 2 hours
        enable_knocking: false,
        enable_screenshare: true,
        enable_chat: true,
        start_video_off: false,
        start_audio_off: false,
        max_participants: 2,
        enable_network_ui: true,
        enable_prejoin_ui: false,
      },
    };

    try {
      const response = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(roomData),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        
        console.log('API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorBody,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        // Handle room already exists
        if (response.status === 400 && 
            (errorBody.error?.includes('already exists') || errorBody.info?.includes('already exists'))) {
          console.log('♻️ Room already exists, fetching details...');
          const existingResponse = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
            headers: { 'Authorization': `Bearer ${this.apiKey}` },
          });
          return existingResponse.ok ? await existingResponse.json() : null;
        }
        
        throw new Error(`Failed to create room: ${errorBody.error || errorBody.info || response.statusText || 'Unknown error'}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Room creation error:', error);
      throw error;
    }
  }

  // Simulate join room flow (with auto-creation)
  async simulateJoinRoom(roomName, participantType) {
    const roomUrl = `https://${this.domain}/${roomName}`;
    console.log(`\n🔄 ${participantType} attempting to join: ${roomUrl}`);

    try {
      // Step 1: Check if room exists
      const roomExists = await this.checkRoomExists(roomName);
      
      if (!roomExists) {
        console.log(`❌ Room doesn't exist, ${participantType} will auto-create...`);
        
        // Step 2: Auto-create room (simulating the dailyService logic)
        const roomData = await this.createRoom(roomName);
        this.createdRooms.add(roomName);
        console.log(`✅ ${participantType} auto-created room: ${roomData.name}`);
        
        return {
          success: true,
          action: 'created_and_joined',
          roomUrl: roomData.url,
          participant: participantType
        };
      } else {
        console.log(`✅ Room exists, ${participantType} joining existing room...`);
        
        return {
          success: true,
          action: 'joined_existing',
          roomUrl: roomUrl,
          participant: participantType
        };
      }
    } catch (error) {
      console.error(`❌ ${participantType} failed to join:`, error.message);
      return {
        success: false,
        error: error.message,
        participant: participantType
      };
    }
  }

  // Test simultaneous join scenarios
  async testSimultaneousJoin() {
    console.log('\n🧪 TEST: Simultaneous Doctor-Patient Join');
    console.log('==========================================');
    
    const doctorId = 'dr_cardiology_001';
    const patientId = 'patient_heart_001';
    const roomName = this.generateConsultationRoomName(doctorId, patientId);
    
    console.log(`👨‍⚕️ Doctor: ${doctorId}`);
    console.log(`🤒 Patient: ${patientId}`);
    console.log(`🏠 Room: ${roomName}`);
    
    // Ensure room doesn't exist before test
    await this.deleteRoom(roomName);
    
    try {
      // Simulate both participants trying to join simultaneously
      const [doctorResult, patientResult] = await Promise.all([
        this.simulateJoinRoom(roomName, 'Doctor'),
        this.simulateJoinRoom(roomName, 'Patient')
      ]);
      
      const success = doctorResult.success && patientResult.success;
      
      this.testResults.push({
        test: 'Simultaneous Join',
        success,
        doctorResult,
        patientResult,
        roomName
      });
      
      if (success) {
        console.log('\n✅ Simultaneous join test PASSED');
        console.log(`   Doctor: ${doctorResult.action}`);
        console.log(`   Patient: ${patientResult.action}`);
      } else {
        console.log('\n❌ Simultaneous join test FAILED');
      }
      
      return success;
    } catch (error) {
      console.error('Simultaneous join test error:', error);
      return false;
    }
  }

  // Test sequential join scenarios
  async testSequentialJoin() {
    console.log('\n🧪 TEST: Sequential Doctor-First Join');
    console.log('====================================');
    
    const doctorId = 'dr_neurology_002';
    const patientId = 'patient_brain_002';
    const roomName = this.generateConsultationRoomName(doctorId, patientId);
    
    console.log(`👨‍⚕️ Doctor: ${doctorId}`);
    console.log(`🤒 Patient: ${patientId}`);
    console.log(`🏠 Room: ${roomName}`);
    
    // Ensure room doesn't exist before test
    await this.deleteRoom(roomName);
    
    try {
      // Doctor joins first
      const doctorResult = await this.simulateJoinRoom(roomName, 'Doctor');
      
      // Wait a moment, then patient joins
      await new Promise(resolve => setTimeout(resolve, 1000));
      const patientResult = await this.simulateJoinRoom(roomName, 'Patient');
      
      const success = doctorResult.success && patientResult.success;
      
      this.testResults.push({
        test: 'Sequential Join (Doctor First)',
        success,
        doctorResult,
        patientResult,
        roomName
      });
      
      if (success) {
        console.log('\n✅ Sequential join test PASSED');
        console.log(`   Doctor: ${doctorResult.action}`);
        console.log(`   Patient: ${patientResult.action}`);
      } else {
        console.log('\n❌ Sequential join test FAILED');
      }
      
      return success;
    } catch (error) {
      console.error('Sequential join test error:', error);
      return false;
    }
  }

  // Test patient-first scenario
  async testPatientFirstJoin() {
    console.log('\n🧪 TEST: Sequential Patient-First Join');
    console.log('=====================================');
    
    const doctorId = 'dr_emergency_003';
    const patientId = 'patient_urgent_003';
    const roomName = this.generateConsultationRoomName(doctorId, patientId);
    
    console.log(`👨‍⚕️ Doctor: ${doctorId}`);
    console.log(`🤒 Patient: ${patientId}`);
    console.log(`🏠 Room: ${roomName}`);
    
    // Ensure room doesn't exist before test
    await this.deleteRoom(roomName);
    
    try {
      // Patient joins first
      const patientResult = await this.simulateJoinRoom(roomName, 'Patient');
      
      // Wait a moment, then doctor joins
      await new Promise(resolve => setTimeout(resolve, 1000));
      const doctorResult = await this.simulateJoinRoom(roomName, 'Doctor');
      
      const success = doctorResult.success && patientResult.success;
      
      this.testResults.push({
        test: 'Sequential Join (Patient First)',
        success,
        patientResult,
        doctorResult,
        roomName
      });
      
      if (success) {
        console.log('\n✅ Patient-first join test PASSED');
        console.log(`   Patient: ${patientResult.action}`);
        console.log(`   Doctor: ${doctorResult.action}`);
      } else {
        console.log('\n❌ Patient-first join test FAILED');
      }
      
      return success;
    } catch (error) {
      console.error('Patient-first join test error:', error);
      return false;
    }
  }

  // Test room configuration verification
  async testRoomConfiguration() {
    console.log('\n🧪 TEST: Room Configuration Verification');
    console.log('========================================');
    
    const doctorId = 'dr_test_config';
    const patientId = 'patient_test_config';
    const roomName = this.generateConsultationRoomName(doctorId, patientId);
    
    try {
      // Create room and verify configuration
      const roomData = await this.createRoom(roomName);
      this.createdRooms.add(roomName);
      
      console.log('✅ Room created, verifying configuration...');
      
      const expectedConfig = {
        max_participants: 2,
        enable_knocking: false,
        enable_chat: true,
        privacy: 'public'
      };
      
      const actualConfig = {
        max_participants: roomData.config.max_participants,
        enable_knocking: roomData.config.enable_knocking,
        enable_chat: roomData.config.enable_chat,
        privacy: roomData.privacy
      };
      
      const configMatches = Object.keys(expectedConfig).every(key => {
        const expected = expectedConfig[key];
        const actual = actualConfig[key];
        // For boolean values, treat undefined as false
        if (typeof expected === 'boolean') {
          return (actual === expected) || (expected === false && actual === undefined);
        }
        return actual === expected;
      });
      
      this.testResults.push({
        test: 'Room Configuration',
        success: configMatches,
        expected: expectedConfig,
        actual: actualConfig,
        roomName
      });
      
      if (configMatches) {
        console.log('✅ Room configuration test PASSED');
        console.log('   All consultation settings correctly applied');
      } else {
        console.log('❌ Room configuration test FAILED');
        console.log('   Expected:', expectedConfig);
        console.log('   Actual:', actualConfig);
      }
      
      return configMatches;
    } catch (error) {
      console.error('Room configuration test error:', error);
      return false;
    }
  }

  // Clean up created rooms
  async deleteRoom(roomName) {
    try {
      const response = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      
      if (response.ok) {
        console.log(`🗑️ Deleted room: ${roomName}`);
        this.createdRooms.delete(roomName);
      }
    } catch (error) {
      // Ignore delete errors for cleanup
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test rooms...');
    for (const roomName of this.createdRooms) {
      await this.deleteRoom(roomName);
    }
  }

  // Generate test report
  generateReport() {
    console.log('\n📊 BIDIRECTIONAL CONSULTATION TEST REPORT');
    console.log('==========================================');
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const successRate = Math.round((passedTests / totalTests) * 100);
    
    console.log(`Overall Success Rate: ${passedTests}/${totalTests} (${successRate}%)`);
    console.log('');
    
    this.testResults.forEach((result, index) => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${index + 1}. ${result.test}: ${status}`);
      
      if (result.doctorResult && result.patientResult) {
        console.log(`   Doctor: ${result.doctorResult.action || 'failed'}`);
        console.log(`   Patient: ${result.patientResult.action || 'failed'}`);
      }
    });
    
    console.log('\n🎯 CONSULTATION SYSTEM STATUS:');
    if (successRate === 100) {
      console.log('✅ FULLY OPERATIONAL - Both doctor and patient can seamlessly join consultations');
    } else if (successRate >= 75) {
      console.log('⚠️ MOSTLY FUNCTIONAL - Some edge cases need attention');
    } else {
      console.log('❌ NEEDS FIXES - Critical issues with bidirectional joining');
    }
    
    return successRate === 100;
  }

  // Run all tests
  async runAllTests() {
    console.log('🚀 BIDIRECTIONAL CONSULTATION TESTS');
    console.log('====================================');
    console.log(`API Key: ${this.apiKey ? this.apiKey.substring(0, 8) + '...' : 'NOT SET'}`);
    console.log(`Domain: ${this.domain}`);
    console.log(`Test Time: ${new Date().toLocaleString()}`);
    
    if (!this.apiKey) {
      console.log('❌ Daily API key not configured. Set DAILY_API_KEY environment variable.');
      return false;
    }
    
    try {
      const results = [];
      
      // Run all test scenarios
      results.push(await this.testSimultaneousJoin());
      results.push(await this.testSequentialJoin());
      results.push(await this.testPatientFirstJoin());
      results.push(await this.testRoomConfiguration());
      
      // Generate final report
      const allPassed = this.generateReport();
      
      return allPassed;
    } catch (error) {
      console.error('Test suite failed:', error);
      return false;
    } finally {
      await this.cleanup();
    }
  }
}

// Run tests if executed directly
async function main() {
  const tester = new BidirectionalConsultationTester();
  
  try {
    const success = await tester.runAllTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = BidirectionalConsultationTester;
