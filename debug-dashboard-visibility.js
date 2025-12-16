#!/usr/bin/env node

/**
 * Debug Daily.co Dashboard Visibility
 * Investigates why rooms might not appear in the web dashboard
 */

require('dotenv').config();
const fetch = require('node-fetch');

const DAILY_API_KEY = process.env.DAILY_API_KEY;

class DashboardVisibilityDebugger {
  constructor() {
    this.dailyApiKey = DAILY_API_KEY;
    this.createdRooms = [];
  }

  async listAllRooms() {
    console.log('🔍 LISTING ALL ROOMS IN ACCOUNT');
    console.log('================================');
    
    try {
      const response = await fetch('https://api.daily.co/v1/rooms', {
        headers: { 'Authorization': `Bearer ${this.dailyApiKey}` }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
      }
      
      const data = await response.json();
      const rooms = data.data || [];
      
      console.log(`📊 Total rooms found: ${rooms.length}`);
      
      if (rooms.length === 0) {
        console.log('❌ No rooms found in account!');
        console.log('This could mean:');
        console.log('   1. Wrong API key');
        console.log('   2. Wrong Daily.co domain');
        console.log('   3. All rooms have been deleted');
        return [];
      }
      
      console.log('\n📋 Room Details:');
      rooms.forEach((room, index) => {
        const created = new Date(room.created_at).toLocaleString();
        const expires = room.config?.exp ? new Date(room.config.exp * 1000).toLocaleString() : 'Never';
        const isExpired = room.config?.exp ? new Date(room.config.exp * 1000) <= new Date() : false;
        
        console.log(`\n   ${index + 1}. ${room.name}`);
        console.log(`      ID: ${room.id}`);
        console.log(`      URL: ${room.url}`);
        console.log(`      Created: ${created}`);
        console.log(`      Expires: ${expires} ${isExpired ? '(EXPIRED)' : '(ACTIVE)'}`);
        console.log(`      Privacy: ${room.privacy}`);
        console.log(`      Max Participants: ${room.config?.max_participants || 'Unknown'}`);
      });
      
      return rooms;
    } catch (error) {
      console.error(`❌ Failed to list rooms: ${error.message}`);
      return [];
    }
  }

  async checkAccountInfo() {
    console.log('\n🏢 CHECKING ACCOUNT INFORMATION');
    console.log('===============================');
    
    try {
      // Try to get account/domain info
      const response = await fetch('https://api.daily.co/v1/', {
        headers: { 'Authorization': `Bearer ${this.dailyApiKey}` }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const accountData = await response.json();
      console.log('✅ API key is valid and working');
      console.log('Account data:', JSON.stringify(accountData, null, 2));
      
    } catch (error) {
      console.error(`❌ Account check failed: ${error.message}`);
      
      if (error.message.includes('401')) {
        console.log('🚨 ISSUE: API key is invalid or expired');
        console.log('   - Check your Daily.co dashboard for the correct API key');
        console.log('   - API key might have been regenerated');
      }
      
      if (error.message.includes('403')) {
        console.log('🚨 ISSUE: API key lacks permissions');
        console.log('   - API key might not have room management permissions');
      }
    }
  }

  async createTestRoomAndVerifyVisibility() {
    console.log('\n🧪 CREATING TEST ROOM FOR VISIBILITY CHECK');
    console.log('===========================================');
    
    const roomName = `dashboard_visibility_test_${Date.now()}`;
    
    try {
      // Create room
      console.log(`1️⃣  Creating test room: ${roomName}`);
      const createResponse = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.dailyApiKey}`,
        },
        body: JSON.stringify({
          name: roomName,
          privacy: 'public',
          properties: {
            max_participants: 10,
            enable_chat: true,
            exp: Math.floor((Date.now() + 2 * 60 * 60 * 1000) / 1000), // 2 hours
          },
        }),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json().catch(() => ({}));
        throw new Error(`Creation failed: ${createResponse.status} - ${error.error || createResponse.statusText}`);
      }

      const roomData = await createResponse.json();
      this.createdRooms.push(roomName);
      
      console.log(`   ✅ Room created: ${roomData.url}`);
      console.log(`   🆔 Room ID: ${roomData.id}`);
      
      // Wait a moment for backend to process
      console.log(`2️⃣  Waiting 5 seconds for backend processing...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check if room appears in list
      console.log(`3️⃣  Checking if room appears in API list...`);
      const allRooms = await this.listAllRooms();
      const foundRoom = allRooms.find(room => room.name === roomName);
      
      if (foundRoom) {
        console.log(`   ✅ Room found in API list!`);
        console.log(`   📋 Room details from list:`);
        console.log(`      Name: ${foundRoom.name}`);
        console.log(`      URL: ${foundRoom.url}`);
        console.log(`      Created: ${new Date(foundRoom.created_at).toLocaleString()}`);
      } else {
        console.log(`   ❌ Room NOT found in API list!`);
        console.log('   🚨 This is a serious issue - room created but not listed');
      }
      
      // Check direct room access
      console.log(`4️⃣  Testing direct room API access...`);
      const directResponse = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
        headers: { 'Authorization': `Bearer ${this.dailyApiKey}` }
      });
      
      if (directResponse.ok) {
        const directRoom = await directResponse.json();
        console.log(`   ✅ Room accessible via direct API call`);
        console.log(`   🌐 URL confirmed: ${directRoom.url}`);
      } else {
        console.log(`   ❌ Room NOT accessible via direct API call (${directResponse.status})`);
      }
      
      // Check URL accessibility
      console.log(`5️⃣  Testing room URL accessibility...`);
      const urlResponse = await fetch(roomData.url, { method: 'HEAD' });
      console.log(`   ${urlResponse.ok ? '✅' : '❌'} Room URL response: HTTP ${urlResponse.status}`);
      
      return true;
      
    } catch (error) {
      console.error(`❌ Test room creation failed: ${error.message}`);
      return false;
    }
  }

  async investigateDashboardIssues() {
    console.log('\n🔍 INVESTIGATING DASHBOARD VISIBILITY ISSUES');
    console.log('=============================================');
    
    console.log('🤔 Possible reasons rooms don\'t appear in dashboard:');
    console.log('');
    
    console.log('1️⃣  API Key vs Dashboard Account Mismatch:');
    console.log('   - API key might belong to different Daily.co account');
    console.log('   - You might be logged into wrong account in browser');
    console.log('   - Multiple Daily.co accounts with same email?');
    
    console.log('');
    console.log('2️⃣  Domain/Subdomain Issues:');
    console.log('   - API creates rooms on different subdomain');
    console.log('   - Dashboard shows rooms from different subdomain');
    console.log('   - Check if URLs use different subdomains');
    
    console.log('');
    console.log('3️⃣  Room Filtering in Dashboard:');
    console.log('   - Dashboard might have filters applied');
    console.log('   - Check "Active Only" vs "All Rooms" toggle');
    console.log('   - Date range filters might hide recent rooms');
    
    console.log('');
    console.log('4️⃣  Caching/Sync Issues:');
    console.log('   - Dashboard might have caching delays');
    console.log('   - Try hard refresh (Ctrl+F5 or Cmd+Shift+R)');
    console.log('   - Try different browser or incognito mode');
    
    console.log('');
    console.log('5️⃣  Room Expiration:');
    console.log('   - Rooms expire quickly (30 min - 2 hours in tests)');
    console.log('   - Dashboard might auto-hide expired rooms');
    console.log('   - Check "Show Expired" option if available');
    
    // Check current API key info
    console.log('\n🔑 Current Configuration:');
    console.log(`   API Key: ${this.dailyApiKey.substring(0, 12)}...`);
    console.log(`   Domain from URLs: mbinina.daily.co`);
    console.log('');
    
    console.log('📋 Action Items to Check:');
    console.log('   1. Verify you\'re logged into mbinina.daily.co dashboard');
    console.log('   2. Check account settings match API key');
    console.log('   3. Look for room filters in dashboard');
    console.log('   4. Try creating room with longer expiration');
    console.log('   5. Check browser console for errors');
  }

  async cleanup() {
    if (this.createdRooms.length === 0) return;
    
    console.log(`\n🧹 Cleaning up ${this.createdRooms.length} test rooms`);
    console.log('='.repeat(40));
    
    for (const roomName of this.createdRooms) {
      try {
        const response = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${this.dailyApiKey}` }
        });
        
        console.log(`   ${response.ok ? '✅' : '⚠️'} ${roomName} (${response.status})`);
      } catch (error) {
        console.log(`   ❌ Error deleting ${roomName}: ${error.message}`);
      }
    }
  }

  async runDebugAnalysis() {
    console.log('🔍 DAILY.CO DASHBOARD VISIBILITY DEBUG');
    console.log('======================================');
    console.log(`Debug Time: ${new Date().toLocaleString()}`);
    
    if (!this.dailyApiKey) {
      console.log('❌ No Daily.co API key found!');
      return false;
    }
    
    try {
      // Check account info
      await this.checkAccountInfo();
      
      // List current rooms
      await this.listAllRooms();
      
      // Create test room and check visibility
      await this.createTestRoomAndVerifyVisibility();
      
      // Provide troubleshooting guidance
      await this.investigateDashboardIssues();
      
      return true;
      
    } catch (error) {
      console.error(`💥 Debug analysis failed: ${error.message}`);
      return false;
    } finally {
      await this.cleanup();
    }
  }
}

// Run debug analysis
async function main() {
  const debugTool = new DashboardVisibilityDebugger();
  
  try {
    await debugTool.runDebugAnalysis();
  } catch (error) {
    console.error('💥 Debug runner failed:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = DashboardVisibilityDebugger;