#!/usr/bin/env node

/**
 * Timeout Stress Test - Test with very short timeouts to verify timeout protection works
 */

const fs = require('fs');

console.log('🔥 Stress Testing Timeout Protection...\n');

// Create a temporary .env file with very short timeouts
const stressTestEnv = `
# Stress test with very short timeouts
HOPMED_INIT_TIMEOUT=2000
HOPMED_SPLASH_TIMEOUT=1000  
HOPMED_REDUX_PERSIST_TIMEOUT=3000
HOPMED_PERMISSION_TIMEOUT=1500
HOPMED_LAUNCH_DEBUG_MODE=true

# Keep other essential vars
HOPMED_BUILD_ENVIRONMENT=local
HOPMED_API_BASE_URL=http://localhost:3001/api/v1
HOPMED_DEBUG_MODE=true
`;

console.log('Creating stress test environment...');
fs.writeFileSync('.env.stress-test', stressTestEnv);

console.log(`✅ Created .env.stress-test with aggressive timeouts:
   - INIT_TIMEOUT: 2s (vs normal 15s)
   - SPLASH_TIMEOUT: 1s (vs normal 10s)  
   - REDUX_PERSIST_TIMEOUT: 3s (vs normal 12s)
   - PERMISSION_TIMEOUT: 1.5s (vs normal 8s)
   - LAUNCH_DEBUG_MODE: enabled (for detailed logging)
`);

console.log(`🚀 To test with stress timeouts:
   1. Copy .env.stress-test to .env.local:
      cp .env.stress-test .env.local
   
   2. Run your dev server:
      npm start
   
   3. Open app - it should still work but with much faster timeouts
   
   4. Check logs for timeout messages like:
      "⚠️ Redux persist timeout - continuing without persistence"
      "⚠️ Permission initialization timeout"
   
   5. Restore original settings:
      git checkout -- .env.local
`);

console.log('\n💡 If the app works with these aggressive timeouts, your fix is solid!');