/**
 * ✅ COMPONENT VERSION TRACKER - v2.2.0
 *
 * This component helps track which version of video components are being used
 * to avoid confusion between old/new implementations during development
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

interface ComponentVersionTrackerProps {
  componentName: string;
  version: string;
  fixes: string[];
  visible?: boolean;
}

export const ComponentVersionTracker: React.FC<ComponentVersionTrackerProps> = ({
  componentName,
  version,
  fixes,
  visible = __DEV__, // Only show in development by default
}) => {
  if (!visible) return null;

  return (
    <View style={styles.tracker}>
      <Text style={styles.componentName}>{componentName}</Text>
      <Text style={styles.version}>{version}</Text>
      {fixes.map((fix, index) => (
        <Text key={index} style={styles.fix}>
          ✅ {fix}
        </Text>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  tracker: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 4,
    padding: 6,
    maxWidth: 200,
    // Enhanced positioning for Android
    ...Platform.select({
      android: {
        zIndex: 99,
        elevation: 10,
      },
      ios: {
        zIndex: 10,
      },
    }),
  },
  componentName: {
    color: '#4CAF50',
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  version: {
    color: '#FFC107',
    fontSize: 7,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  fix: {
    color: '#fff',
    fontSize: 6,
    fontFamily: 'monospace',
  },
});

export default ComponentVersionTracker;
