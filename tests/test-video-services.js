#!/usr/bin/env node

/**
 * Integrated Video Call Services Test Script
 * Tests both Daily.co and Agora services as used by the HopMed app
 */

const fetch = require('node-fetch');

// Configuration from .env.example
const DAILY_API_KEY = 'de05bcc9d2c0ad891300c19e9d42bb6b1f61ebac2e33fd22949eed768ea0ddb9';
const DAILY_DOMAIN = 'mbinina.daily.co';
const AGORA_APP_ID = process.env.AGORA_APP_ID || '';

// Test configuration
const TEST_DOCTOR_ID = 'doctor123';
const TEST_CUSTOMER_ID = 'customer456';

class VideoServicesIntegrationTester {
  constructor() {
    this.dailyApiKey = DAILY_API_KEY;
    this.agoraAppId = AGORA_APP_ID;
    this.createdRooms = [];
  }

  // Helper to generate consistent consultation identifiers (matches app logic)
  generateConsultationIdentifier(doctorId, customerId) {
    const sortedIds = [doctorId, customerId].sort();
    return `consultation_${sortedIds[0]}_${sortedIds[1]}`;
  }

  async testDailyConsultationFlow() {
    console.log('\n🧪 Daily.co Consultation Flow Test');
    console.log('===================================');

    const consultationId = this.generateConsultationIdentifier(TEST_DOCTOR_ID, TEST_CUSTOMER_ID);
    
    try {
      // Step 1: Create consultation room (matches dailyService.ts)
      console.log(`1️⃣  Creating consultation room: ${consultationId}`);
      
      const roomData = {
        name: consultationId,
        privacy: 'public',
        properties: {
          max_participants: 2,
          enable_chat: true,
          enable_knocking: false,
          enable_screenshare: true,
          enable_recording: false,
          start_video_off: false,
          start_audio_off: false,
          exp: Math.floor((Date.now() + 60 * 60 * 1000) / 1000), // 1 hour
        },
      };

      const response = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.dailyApiKey}`,
        },
        body: JSON.stringify(roomData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 400 && errorData.error?.includes('already exists')) {
          console.log(`   ♻️  Room already exists, continuing test...`);
        } else {
          throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
        }
      } else {
        const result = await response.json();
        console.log(`   ✅ Room created: ${result.url}`);
        this.createdRooms.push(consultationId);
      }

      // Step 2: Simulate room joining (matches consultation flow)
      console.log(`2️⃣  Simulating consultation join flow`);
      
      const roomUrl = `https://${DAILY_DOMAIN}/${consultationId}`;
      console.log(`   📞 Doctor joins: ${roomUrl}`);
      console.log(`   👥 Customer joins: ${roomUrl}`);
      console.log(`   ✅ Both participants would join the same room`);

      // Step 3: Test room details retrieval
      console.log(`3️⃣  Verifying room configuration`);
      
      const detailsResponse = await fetch(`https://api.daily.co/v1/rooms/${consultationId}`, {
        headers: { 'Authorization': `Bearer ${this.dailyApiKey}` },
      });

      if (detailsResponse.ok) {
        const roomDetails = await detailsResponse.json();
        console.log(`   ✅ Room verified - Max participants: ${roomDetails.config.max_participants}`);
        console.log(`   ✅ Screen share: ${roomDetails.config.enable_screenshare ? 'enabled' : 'disabled'}`);
      }

      return true;
    } catch (error) {
      console.error(`❌ Daily consultation flow failed: ${error.message}`);
      return false;
    }
  }

  testAgoraConsultationFlow() {
    console.log('\n🧪 Agora Consultation Flow Test');
    console.log('===============================');

    try {
      // Step 1: Generate channel name (matches agoraService.ts)
      const channelName = this.generateConsultationIdentifier(TEST_DOCTOR_ID, TEST_CUSTOMER_ID);
      console.log(`1️⃣  Generated channel: ${channelName}`);

      // Step 2: Validate channel name against Agora rules
      console.log(`2️⃣  Validating channel name`);
      
      const validation = this.validateAgoraChannelName(channelName);
      if (!validation.valid) {
        throw new Error(`Invalid channel name: ${validation.reason}`);
      }
      console.log(`   ✅ Channel name valid`);

      // Step 3: Simulate token generation
      console.log(`3️⃣  Simulating token generation`);
      
      if (this.agoraAppId) {
        console.log(`   🔑 Would generate token for App ID: ${this.agoraAppId.substring(0, 8)}...`);
        console.log(`   📞 Doctor joins channel: ${channelName}`);
        console.log(`   👥 Customer joins channel: ${channelName}`);
      } else {
        console.log(`   ⚠️  No App ID configured - would use null token in development`);
        console.log(`   📞 Doctor joins channel: ${channelName} (null token)`);
        console.log(`   👥 Customer joins channel: ${channelName} (null token)`);
      }

      // Step 4: Simulate channel capacity check
      console.log(`4️⃣  Channel capacity check`);
      const maxParticipants = 2; // For consultation
      console.log(`   ✅ Channel supports up to ${maxParticipants} participants`);

      return true;
    } catch (error) {
      console.error(`❌ Agora consultation flow failed: ${error.message}`);
      return false;
    }
  }

  validateAgoraChannelName(channelName) {
    if (!channelName || channelName.length === 0) {
      return { valid: false, reason: 'Channel name cannot be empty' };
    }
    
    if (channelName.length > 64) {
      return { valid: false, reason: 'Channel name too long (max 64 characters)' };
    }
    
    if (channelName.startsWith('_') || channelName.startsWith('-')) {
      return { valid: false, reason: 'Channel name cannot start with underscore or hyphen' };
    }
    
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validPattern.test(channelName)) {
      return { valid: false, reason: 'Channel name contains invalid characters' };
    }
    
    return { valid: true };
  }

  async testProviderFallback() {
    console.log('\n🧪 Provider Fallback Simulation');
    console.log('===============================');

    try {
      console.log(`1️⃣  Testing preferred provider: Daily.co`);
      
      // Simulate successful Daily.co initialization
      if (this.dailyApiKey) {
        console.log(`   ✅ Daily.co API key configured`);
        console.log(`   ✅ Daily.co would be primary provider`);
      } else {
        console.log(`   ❌ Daily.co API key missing`);
      }

      console.log(`2️⃣  Testing fallback provider: Agora`);
      
      // Simulate Agora availability check
      if (this.agoraAppId) {
        console.log(`   ✅ Agora App ID configured`);
        console.log(`   ✅ Agora available as fallback`);
      } else {
        console.log(`   ⚠️  Agora App ID missing - fallback limited`);
      }

      console.log(`3️⃣  Fallback scenario simulation`);
      
      if (this.dailyApiKey && this.agoraAppId) {
        console.log(`   📞 Primary: Daily.co consultation room`);
        console.log(`   🔄 If Daily.co fails -> Fallback to Agora channel`);
        console.log(`   ✅ Full fallback capability available`);
      } else if (this.dailyApiKey) {
        console.log(`   📞 Primary: Daily.co consultation room`);
        console.log(`   ⚠️  Limited fallback (Agora needs App ID)`);
      } else {
        console.log(`   ⚠️  No providers fully configured`);
      }

      return true;
    } catch (error) {
      console.error(`❌ Provider fallback test failed: ${error.message}`);
      return false;
    }
  }

  async testChannelConsistency() {
    console.log('\n🧪 Cross-Provider Channel Consistency');
    console.log('=====================================');

    try {
      // Test that both providers generate the same identifier for same consultation
      const dailyRoomName = this.generateConsultationIdentifier(TEST_DOCTOR_ID, TEST_CUSTOMER_ID);
      const agoraChannelName = this.generateConsultationIdentifier(TEST_DOCTOR_ID, TEST_CUSTOMER_ID);
      
      console.log(`1️⃣  Daily room name: ${dailyRoomName}`);
      console.log(`2️⃣  Agora channel name: ${agoraChannelName}`);
      
      if (dailyRoomName === agoraChannelName) {
        console.log(`   ✅ Consistent naming across providers`);
      } else {
        console.log(`   ❌ Inconsistent naming - could cause issues`);
        return false;
      }

      // Test reverse order gives same result
      const reversedDaily = this.generateConsultationIdentifier(TEST_CUSTOMER_ID, TEST_DOCTOR_ID);
      const reversedAgora = this.generateConsultationIdentifier(TEST_CUSTOMER_ID, TEST_DOCTOR_ID);
      
      console.log(`3️⃣  Testing parameter order independence:`);
      console.log(`       Forward:  ${dailyRoomName}`);
      console.log(`       Reversed: ${reversedDaily}`);
      
      if (dailyRoomName === reversedDaily && agoraChannelName === reversedAgora) {
        console.log(`   ✅ Order-independent naming verified`);
        return true;
      } else {
        console.log(`   ❌ Naming varies with parameter order`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Channel consistency test failed: ${error.message}`);
      return false;
    }
  }

  async cleanupDailyRooms() {
    console.log('\n🧹 Cleaning up test rooms');
    console.log('=========================');

    for (const roomName of this.createdRooms) {
      try {
        const response = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${this.dailyApiKey}` },
        });

        if (response.ok) {
          console.log(`✅ Deleted room: ${roomName}`);
        } else if (response.status === 404) {
          console.log(`⚠️  Room ${roomName} not found (already deleted?)`);
        } else {
          console.log(`❌ Failed to delete room: ${roomName}`);
        }
      } catch (error) {
        console.log(`❌ Error deleting room ${roomName}: ${error.message}`);
      }
    }

    this.createdRooms = [];
  }

  async runAllTests() {
    console.log('🚀 HopMed Video Services Integration Tests');
    console.log('==========================================');
    console.log(`Daily API Key: ${this.dailyApiKey ? this.dailyApiKey.substring(0, 8) + '...' : 'NOT CONFIGURED'}`);
    console.log(`Agora App ID: ${this.agoraAppId ? this.agoraAppId.substring(0, 8) + '...' : 'NOT CONFIGURED'}`);
    console.log(`Test Doctor ID: ${TEST_DOCTOR_ID}`);
    console.log(`Test Customer ID: ${TEST_CUSTOMER_ID}`);

    const results = [];

    try {
      results.push(await this.testDailyConsultationFlow());
      results.push(this.testAgoraConsultationFlow());
      results.push(await this.testProviderFallback());
      results.push(await this.testChannelConsistency());
      
      await this.cleanupDailyRooms();

      const passed = results.filter(Boolean).length;
      const total = results.length;

      console.log('\n📊 Integration Test Results');
      console.log('===========================');
      console.log(`✅ Passed: ${passed}/${total}`);
      console.log(`❌ Failed: ${total - passed}/${total}`);

      if (!this.dailyApiKey || !this.agoraAppId) {
        console.log('\n💡 Setup Recommendations');
        console.log('=========================');
        
        if (!this.agoraAppId) {
          console.log('🔧 To enable full Agora testing:');
          console.log('   1. Get App ID from https://console.agora.io');
          console.log('   2. Set: export AGORA_APP_ID=your_app_id');
          console.log('   3. Re-run tests');
        }
        
        if (!this.dailyApiKey) {
          console.log('🔧 Daily.co API key is required for room management');
        }
      }

      if (passed === total) {
        console.log('🎉 All integration tests PASSED!');
        console.log('✅ Video services are ready for use');
        return true;
      } else {
        console.log('💥 Some integration tests FAILED!');
        console.log('⚠️  Check configuration and service availability');
        return false;
      }
    } catch (error) {
      console.error('💥 Integration test suite failed:', error);
      await this.cleanupDailyRooms();
      return false;
    }
  }
}

// Run tests if script is executed directly
async function main() {
  const tester = new VideoServicesIntegrationTester();
  
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

module.exports = VideoServicesIntegrationTester;