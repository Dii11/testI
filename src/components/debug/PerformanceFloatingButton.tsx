/**
 * Performance Floating Button
 *
 * Dev-only floating button to access performance report
 * Only shows in development builds
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Text } from 'react-native';

import { COLORS } from '../../constants';

import PerformanceReport from './PerformanceReport';

const PerformanceFloatingButton: React.FC = () => {
  const [showReport, setShowReport] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));

  // Only render in development
  if (!__DEV__) {
    return null;
  }

  // Subtle pulse animation to indicate dev tool
  React.useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <>
      <Animated.View
        style={[
          styles.floatingButton,
          {
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.button}
          onPress={() => setShowReport(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="speedometer-outline" size={24} color="#FFFFFF" />
          <Text style={styles.buttonText}>PERF</Text>
        </TouchableOpacity>
      </Animated.View>

      <PerformanceReport visible={showReport} onClose={() => setShowReport(false)} />
    </>
  );
};

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    zIndex: 9999,
    elevation: 8,
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF5722',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
    marginTop: 2,
  },
});

export default PerformanceFloatingButton;
