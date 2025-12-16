#!/usr/bin/env node

/**
 * Daily.co Room Creation Test Script
 * Tests room creation, retrieval, and deletion using Daily.co REST API
 */

const fetch = require('node-fetch');

// Configuration from .env.example
const DAILY_API_KEY = 'de05bcc9d2c0ad891300c19e9d42bb6b1f61ebac2e33fd22949eed768ea0ddb9';
const DAILY_DOMAIN = 'mbinina.daily.co';

// Test configuration
const TEST_ROOM_PREFIX = 'hopmed_test_';
const TEST_DOCTOR_ID = 'doctor123';
const TEST_CUSTOMER_ID = 'customer456';

class DailyRoomTester {
  constructor() {
    this.apiKey = DAILY_API_KEY;
    this.domain = DAILY_DOMAIN;
    this.createdRooms = [];
  }

  async createRoom(roomName, options = {}) {
    const roomData = {
      name: roomName,
      privacy: options.privacy || 'public',
      properties: {
        max_participants: options.maxParticipants || 10,
        enable_chat: options.enableChat !== false,
        enable_knocking: options.enableKnocking || false,
        enable_screenshare: options.enableScreenshare !== false,
        enable_recording: options.enableRecording || false,
        start_video_off: options.startVideoOff || false,
        start_audio_off: options.startAudioOff || false,
        enable_network_ui: true,
        exp: options.expiry || Math.floor((Date.now() + 60 * 60 * 1000) / 1000), // 1 hour
      },
    };

    try {
      console.log(`🏗️  Creating Daily.co room: ${roomName}`);
      
      const response = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(roomData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle existing room gracefully
        if (response.status === 400 && errorData.error?.includes('already exists')) {
          console.log(`♻️  Room ${roomName} already exists, fetching details...`);
          return await this.getRoomDetails(roomName);
        }
        
        throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      this.createdRooms.push(roomName);
      
      console.log(`✅ Room created successfully:`);
      console.log(`   - Name: ${result.name}`);
      console.log(`   - URL: ${result.url}`);
      console.log(`   - ID: ${result.id}`);
      
      return result;
    } catch (error) {
      console.error(`❌ Failed to create room ${roomName}:`, error.message);
      throw error;
    }
  }

  async getRoomDetails(roomName) {
    try {
      console.log(`🔍 Fetching room details: ${roomName}`);
      
      const response = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`❌ Room ${roomName} not found`);
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const expiresAt = result.config?.exp ? new Date(result.config.exp * 1000) : null;
      
      console.log(`✅ Room details retrieved:`);
      console.log(`   - Name: ${result.name}`);
      console.log(`   - URL: ${result.url}`);
      console.log(`   - Created: ${new Date(result.created_at).toLocaleString()}`);
      console.log(`   - Expires: ${expiresAt ? expiresAt.toLocaleString() : 'Never'}`);
      console.log(`   - Privacy: ${result.privacy}`);
      
      return result;
    } catch (error) {
      console.error(`❌ Failed to get room details for ${roomName}:`, error.message);
      throw error;
    }
  }

  async deleteRoom(roomName) {
    try {
      console.log(`🗑️  Deleting room: ${roomName}`);
      
      const response = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`⚠️  Room ${roomName} not found (already deleted?)`);
          return true;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`✅ Room ${roomName} deleted successfully`);
      this.createdRooms = this.createdRooms.filter(name => name !== roomName);
      return true;
    } catch (error) {
      console.error(`❌ Failed to delete room ${roomName}:`, error.message);
      return false;
    }
  }

  generateConsultationRoomName(doctorId, customerId) {
    // Ensure consistent room naming by sorting IDs
    const sortedIds = [doctorId, customerId].sort();
    return `consultation_${sortedIds[0]}_${sortedIds[1]}`;
  }

  async testBasicRoomCreation() {
    console.log('\n🧪 Test 1: Basic Room Creation');
    console.log('================================');
    
    const roomName = `${TEST_ROOM_PREFIX}basic_${Date.now()}`;
    
    try {
      const room = await this.createRoom(roomName);
      
      // Verify we can fetch the room
      const fetchedRoom = await this.getRoomDetails(roomName);
      
      if (fetchedRoom && fetchedRoom.name === room.name) {
        console.log('✅ Basic room creation test PASSED');
        return true;
      } else {
        console.log('❌ Room creation/fetch mismatch');
        return false;
      }
    } catch (error) {
      console.log('❌ Basic room creation test FAILED:', error.message);
      return false;
    }
  }

  async testConsultationRoom() {
    console.log('\n🧪 Test 2: Consultation Room Creation');
    console.log('=====================================');
    
    const roomName = this.generateConsultationRoomName(TEST_DOCTOR_ID, TEST_CUSTOMER_ID);
    
    try {
      const room = await this.createRoom(roomName, {
        privacy: 'private',
        enableKnocking: true,
        maxParticipants: 2,
        expiry: Math.floor((Date.now() + 30 * 60 * 1000) / 1000) // 30 minutes
      });
      
      console.log('✅ Consultation room creation test PASSED');
      return true;
    } catch (error) {
      console.log('❌ Consultation room creation test FAILED:', error.message);
      return false;
    }
  }

  async testDoctorRoom() {
    console.log('\n🧪 Test 3: Doctor Room Creation');
    console.log('===============================');
    
    const roomName = `dr_${TEST_DOCTOR_ID}`;
    
    try {
      const room = await this.createRoom(roomName, {
        maxParticipants: 10,
        enableScreenshare: true,
        enableRecording: true,
      });
      
      console.log('✅ Doctor room creation test PASSED');
      return true;
    } catch (error) {
      console.log('❌ Doctor room creation test FAILED:', error.message);
      return false;
    }
  }

  async testRoomDeletion() {
    console.log('\n🧪 Test 4: Room Cleanup');
    console.log('=======================');
    
    let allDeleted = true;
    
    for (const roomName of [...this.createdRooms]) {
      const deleted = await this.deleteRoom(roomName);
      if (!deleted) {
        allDeleted = false;
      }
    }
    
    if (allDeleted && this.createdRooms.length === 0) {
      console.log('✅ Room cleanup test PASSED');
      return true;
    } else {
      console.log('❌ Room cleanup test FAILED');
      return false;
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Daily.co Room Tests');
    console.log('================================');
    console.log(`API Key: ${this.apiKey.substring(0, 8)}...`);
    console.log(`Domain: ${this.domain}`);
    
    const results = [];
    
    try {
      results.push(await this.testBasicRoomCreation());
      results.push(await this.testConsultationRoom());
      results.push(await this.testDoctorRoom());
      results.push(await this.testRoomDeletion());
      
      const passed = results.filter(Boolean).length;
      const total = results.length;
      
      console.log('\n📊 Test Results Summary');
      console.log('=======================');
      console.log(`✅ Passed: ${passed}/${total}`);
      console.log(`❌ Failed: ${total - passed}/${total}`);
      
      if (passed === total) {
        console.log('🎉 All tests PASSED!');
        return true;
      } else {
        console.log('💥 Some tests FAILED!');
        return false;
      }
    } catch (error) {
      console.error('💥 Test suite failed:', error);
      return false;
    }
  }

  async cleanup() {
    if (this.createdRooms.length > 0) {
      console.log('\n🧹 Emergency cleanup...');
      await this.testRoomDeletion();
    }
  }
}

// Run tests if script is executed directly
async function main() {
  const tester = new DailyRoomTester();
  
  try {
    const success = await tester.runAllTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('💥 Test runner failed:', error);
    await tester.cleanup();
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = DailyRoomTester;