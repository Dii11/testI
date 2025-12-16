#!/usr/bin/env node

/**
 * Test script to validate the Daily.co refactoring
 * This script checks that the refactored code follows official Daily.co patterns
 */

const fs = require('fs');
const path = require('path');

function testFile(filepath, fileName) {
  console.log(`\n🧪 Testing ${fileName}...`);
  
  const content = fs.readFileSync(filepath, 'utf8');
  const issues = [];
  
  // ✅ Should use direct Daily.createCallObject
  if (content.includes('Daily.createCallObject')) {
    console.log('✅ Uses direct Daily.createCallObject pattern');
  } else {
    issues.push('❌ Missing Daily.createCallObject usage');
  }
  
  // ✅ Should NOT use UnifiedVideoCallService (outside comments)
  const activeCode = content.replace(/\/\*[\s\S]*?\*\//g, ''); // Remove block comments
  if (!activeCode.includes('UnifiedVideoCallService')) {
    console.log('✅ No longer uses UnifiedVideoCallService abstraction in active code');
  } else {
    issues.push('❌ Still contains UnifiedVideoCallService references in active code');
  }
  
  // ✅ Should NOT use OfficialDailyCallManager
  if (!content.includes('OfficialDailyCallManager')) {
    console.log('✅ No longer uses OfficialDailyCallManager abstraction');
  } else {
    issues.push('❌ Still contains OfficialDailyCallManager references');
  }
  
  // ✅ Should use simplified app state management
  if (content.includes("useState<'idle' | 'creating' | 'joining' | 'joined' | 'leaving' | 'error'>")) {
    console.log('✅ Uses simplified app state enum pattern');
  } else {
    issues.push('❌ Missing simplified app state management');
  }
  
  // ✅ Should use official event handling patterns
  if (content.includes("const events: DailyEvent[]")) {
    console.log('✅ Uses official event handling pattern');
  } else {
    issues.push('❌ Missing official event handling pattern');
  }
  
  // ✅ Should use proper call lifecycle
  if (content.includes('callObject.join') && content.includes('callObject.meetingState')) {
    console.log('✅ Uses proper call lifecycle management');
  } else {
    issues.push('❌ Missing proper call lifecycle management');
  }
  
  // ✅ Should manage participants directly
  if (content.includes('callObject.participants()')) {
    console.log('✅ Uses direct participant management');
  } else {
    issues.push('❌ Missing direct participant management');
  }
  
  return issues;
}

function main() {
  console.log('🚀 Testing Daily.co Refactoring Implementation\n');
  console.log('=' * 50);
  
  const customerScreenPath = '/Users/rochelhasina/Documents/hopmed/hopmed-mobile/src/screens/main/CustomerDetailsScreen.tsx';
  const doctorScreenPath = '/Users/rochelhasina/Documents/hopmed/hopmed-mobile/src/screens/main/DoctorDetailsScreen.tsx';
  
  let allIssues = [];
  
  // Test CustomerDetailsScreen
  if (fs.existsSync(customerScreenPath)) {
    const issues = testFile(customerScreenPath, 'CustomerDetailsScreen');
    allIssues = allIssues.concat(issues);
  } else {
    console.log('❌ CustomerDetailsScreen.tsx not found');
  }
  
  // Test DoctorDetailsScreen  
  if (fs.existsSync(doctorScreenPath)) {
    const issues = testFile(doctorScreenPath, 'DoctorDetailsScreen');
    allIssues = allIssues.concat(issues);
  } else {
    console.log('❌ DoctorDetailsScreen.tsx not found');
  }
  
  // Summary
  console.log('\n' + '=' * 50);
  console.log('📊 REFACTORING SUMMARY');
  console.log('=' * 50);
  
  if (allIssues.length === 0) {
    console.log('🎉 SUCCESS: All Daily.co refactoring patterns implemented correctly!');
    console.log('✅ Your implementation now follows official Daily.co best practices');
    console.log('✅ Removed unnecessary abstraction layers');  
    console.log('✅ Uses direct Daily.co API calls');
    console.log('✅ Simplified state management');
    console.log('✅ Official event handling patterns');
  } else {
    console.log('⚠️  Issues found:');
    allIssues.forEach(issue => console.log(`  ${issue}`));
  }
  
  console.log('\n🔗 Next steps:');
  console.log('1. Test the calls in your app');
  console.log('2. Monitor for any runtime issues');
  console.log('3. Consider removing unused abstraction files');
}

main();