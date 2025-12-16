/**
 * 🔧 VIDEO RENDERING TEST SUITE v2.2.3
 *
 * Comprehensive test component to diagnose video rendering issues
 * Tests multiple approaches to identify what works and what doesn't
 */

import { DailyMediaView } from '@daily-co/react-native-daily-js';
import type { DailyTrackState } from '@daily-co/react-native-daily-js';
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';

interface VideoRenderingTestSuiteProps {
  videoTrackState: DailyTrackState | null;
  audioTrackState: DailyTrackState | null;
  isLocal?: boolean;
}

export const VideoRenderingTestSuite: React.FC<VideoRenderingTestSuiteProps> = ({
  videoTrackState,
  audioTrackState,
  isLocal = false,
}) => {
  const [activeTest, setActiveTest] = useState<number>(1);

  // Get tracks for testing
  const videoTrack = useMemo(() => {
    if (!videoTrackState || videoTrackState.state !== 'playable') return null;
    return videoTrackState.track || videoTrackState.persistentTrack || null;
  }, [videoTrackState]);

  const audioTrack = useMemo(() => {
    if (!audioTrackState || audioTrackState.state !== 'playable') return null;
    return audioTrackState.track || audioTrackState.persistentTrack || null;
  }, [audioTrackState]);

  if (!videoTrack) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🔧 VIDEO TEST SUITE - No Track Available</Text>
        <Text style={styles.status}>
          State: {videoTrackState?.state || 'null'} | Track: {videoTrackState?.track ? '✅' : '❌'}
        </Text>
      </View>
    );
  }

  const renderTest1 = () => (
    <View style={styles.testContainer}>
      <Text style={styles.testTitle}>Test 1: Minimal Container</Text>
      <View style={styles.minimalContainer}>
        <DailyMediaView
          videoTrack={videoTrack}
          audioTrack={audioTrack || null}
          style={styles.minimalMedia}
          objectFit="cover"
        />
      </View>
    </View>
  );

  const renderTest2 = () => (
    <View style={styles.testContainer}>
      <Text style={styles.testTitle}>Test 2: Explicit Dimensions</Text>
      <View style={styles.explicitContainer}>
        <DailyMediaView
          videoTrack={videoTrack}
          audioTrack={audioTrack || null}
          style={styles.explicitMedia}
          objectFit="cover"
        />
      </View>
    </View>
  );

  const renderTest3 = () => (
    <View style={styles.testContainer}>
      <Text style={styles.testTitle}>Test 3: Android Optimized</Text>
      <View style={styles.androidContainer}>
        <DailyMediaView
          videoTrack={videoTrack}
          audioTrack={audioTrack || null}
          style={styles.androidMedia}
          objectFit="cover"
          zOrder={isLocal ? 2 : 1}
        />
      </View>
    </View>
  );

  const renderTest4 = () => (
    <View style={styles.testContainer}>
      <Text style={styles.testTitle}>Test 4: Colored Background Test</Text>
      <View style={styles.coloredContainer}>
        <DailyMediaView
          videoTrack={videoTrack}
          audioTrack={audioTrack || null}
          style={styles.coloredMedia}
          objectFit="cover"
        />
        {/* Colored border to see container boundaries */}
        <View style={styles.coloredBorder} />
      </View>
    </View>
  );

  const getCurrentTest = () => {
    switch (activeTest) {
      case 1:
        return renderTest1();
      case 2:
        return renderTest2();
      case 3:
        return renderTest3();
      case 4:
        return renderTest4();
      default:
        return renderTest1();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔧 VIDEO RENDERING TEST SUITE v2.2.3</Text>

      {/* Track info */}
      <View style={styles.infoPanel}>
        <Text style={styles.infoText}>
          📹 Track ID: {videoTrack.id.slice(-8)} | State: {videoTrackState?.state}
        </Text>
        <Text style={styles.infoText}>
          🎯 Ready: {videoTrack.readyState} | Muted: {videoTrack.muted ? '🔇' : '🔊'}
        </Text>
        <Text style={styles.infoText}>
          🏷️ {isLocal ? 'LOCAL' : 'REMOTE'} | Platform: {Platform.OS}
        </Text>
      </View>

      {/* Test selector */}
      <View style={styles.selectorContainer}>
        {[1, 2, 3, 4].map(testNum => (
          <TouchableOpacity
            key={testNum}
            style={[styles.selectorButton, activeTest === testNum && styles.selectorButtonActive]}
            onPress={() => setActiveTest(testNum)}
          >
            <Text
              style={[styles.selectorText, activeTest === testNum && styles.selectorTextActive]}
            >
              Test {testNum}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Current test */}
      <View style={styles.testArea}>{getCurrentTest()}</View>

      {/* Instructions */}
      <View style={styles.instructionsPanel}>
        <Text style={styles.instructionsTitle}>📋 Test Instructions:</Text>
        <Text style={styles.instructionsText}>
          • Switch between tests to see which approach works
        </Text>
        <Text style={styles.instructionsText}>
          • Look for any visible video content in the test areas
        </Text>
        <Text style={styles.instructionsText}>
          • Test 4 has colored borders to verify container visibility
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  infoPanel: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  infoText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  selectorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  selectorButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 8,
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  selectorButtonActive: {
    backgroundColor: 'rgba(156, 39, 176, 0.3)',
    borderColor: '#9C27B0',
  },
  selectorText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  selectorTextActive: {
    color: '#9C27B0',
    fontWeight: 'bold',
  },
  testArea: {
    flex: 1,
    marginBottom: 16,
  },
  testContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
  },
  testTitle: {
    color: '#FFC107',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'monospace',
  },

  // Test 1: Minimal
  minimalContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  minimalMedia: {
    flex: 1,
  },

  // Test 2: Explicit dimensions
  explicitContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  explicitMedia: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },

  // Test 3: Android optimized
  androidContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    ...Platform.select({
      android: {
        elevation: 10,
        overflow: 'visible',
      },
      ios: {
        overflow: 'hidden',
      },
    }),
  },
  androidMedia: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    ...Platform.select({
      android: {
        renderToHardwareTextureAndroid: true,
      },
    }),
  },

  // Test 4: Colored background
  coloredContainer: {
    flex: 1,
    backgroundColor: '#FF6B35',
    position: 'relative',
    borderRadius: 8,
  },
  coloredMedia: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  coloredBorder: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    borderWidth: 3,
    borderColor: '#9C27B0',
    borderRadius: 8,
    borderStyle: 'dashed',
    pointerEvents: 'none',
  },

  // Instructions
  instructionsPanel: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  instructionsTitle: {
    color: '#FFC107',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  instructionsText: {
    color: '#FFC107',
    fontSize: 12,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  status: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});
