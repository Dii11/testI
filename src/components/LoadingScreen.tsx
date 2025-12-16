import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useRef, useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Animated } from 'react-native';

import { COLORS } from '../constants';

import { SkeletonLoader } from './common/SkeletonLoader';

interface LoadingScreenProps {
  message?: string;
  showSkeleton?: boolean;
  testID?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = memo(
  ({ message = 'Loading HopMed...', showSkeleton = false, testID = 'loading-screen' }) => {
    // Debug logging
    console.log('LoadingScreen rendered with message:', message);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }, [fadeAnim, scaleAnim]);
    if (showSkeleton) {
      return (
        <LinearGradient colors={COLORS.BRAND_GRADIENT} style={styles.container} testID={testID}>
          <View style={styles.skeletonContainer}>
            <SkeletonLoader height={40} width={200} style={styles.titleSkeleton} />
            <SkeletonLoader height={20} width={150} style={styles.subtitleSkeleton} />
            <View style={styles.cardSkeletons}>
              {Array.from({ length: 3 }, (_, index) => (
                <SkeletonLoader key={index} height={120} style={styles.cardSkeleton} />
              ))}
            </View>
          </View>
        </LinearGradient>
      );
    }

    return (
      <LinearGradient colors={COLORS.BRAND_GRADIENT} style={styles.container} testID={testID}>
        <Animated.Text
          style={[
            styles.brandText,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
          testID="hopmed-brand-text"
          accessibilityRole="text"
        >
          HopMed
        </Animated.Text>
      </LinearGradient>
    );
  }
);

LoadingScreen.displayName = 'LoadingScreen';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  brandText: {
    fontSize: 36,
    fontWeight: '600',
    color: COLORS.WHITE,
    textAlign: 'center',
    letterSpacing: 1,
  },
  skeletonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  titleSkeleton: {
    marginBottom: 16,
  },
  subtitleSkeleton: {
    marginBottom: 32,
  },
  cardSkeletons: {
    width: '100%',
    gap: 16,
  },
  cardSkeleton: {
    marginBottom: 16,
    borderRadius: 12,
  },
});

export default LoadingScreen;
