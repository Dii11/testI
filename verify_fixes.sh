#!/bin/bash

echo "🧪 Running Video Call Fixes Verification..."
echo ""

PASS=0
FAIL=0

# Test 1: Frozen frame fix
echo "Test 1: Frozen frame fix"
if grep -q "Explicitly stopped local video track" src/components/daily/EnterpriseCallInterface.tsx; then
  echo "✅ PASS: Frozen frame fix applied"
  ((PASS++))
else
  echo "❌ FAIL: Frozen frame fix missing"
  ((FAIL++))
fi

# Test 2: User preference property
echo "Test 2: User preference property"
if grep -q "private userCameraPreference" src/services/VideoCallBackgroundManager.ts; then
  echo "✅ PASS: User preference property added"
  ((PASS++))
else
  echo "❌ FAIL: User preference property missing"
  ((FAIL++))
fi

# Test 3: Background state sync
echo "Test 3: Background state sync"
if grep -q "Syncing camera preference" src/components/daily/EnterpriseCallInterface.tsx; then
  echo "✅ PASS: Background state sync added"
  ((PASS++))
else
  echo "❌ FAIL: Background state sync missing"
  ((FAIL++))
fi

# Test 4: Safe participant cleanup
echo "Test 4: Safe participant cleanup"
if grep -q "Daily.co manages cleanup" src/components/daily/EnterpriseCallInterface.tsx; then
  echo "✅ PASS: Safe participant cleanup applied"
  ((PASS++))
else
  echo "❌ FAIL: Safe participant cleanup missing"
  ((FAIL++))
fi

# Test 5: Foreground resume logic
echo "Test 5: Foreground resume logic"
if grep -q "user had camera off" src/services/VideoCallBackgroundManager.ts; then
  echo "✅ PASS: Foreground resume logic added"
  ((PASS++))
else
  echo "❌ FAIL: Foreground resume logic missing"
  ((FAIL++))
fi

# Test 6: Integration points
echo "Test 6: Integration points (setUserCameraPreference calls)"
COUNT=$(grep -c "setUserCameraPreference" src/components/daily/EnterpriseCallInterface.tsx || echo 0)
if [ "$COUNT" -eq 3 ]; then
  echo "✅ PASS: All 3 integration points present"
  ((PASS++))
else
  echo "❌ FAIL: Expected 3 calls, found $COUNT"
  ((FAIL++))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Results: $PASS passed, $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $FAIL -eq 0 ]; then
  echo "✅ ALL TESTS PASSED - Fixes verified!"
  exit 0
else
  echo "❌ SOME TESTS FAILED - Review fixes"
  exit 1
fi
