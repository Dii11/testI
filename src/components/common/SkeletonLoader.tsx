import React, { useEffect, useRef, createContext, useContext } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

import { COLORS } from '../../constants';

const { width } = Dimensions.get('window');

// Shared animation context to prevent multiple animations
const ShimmerContext = createContext<Animated.Value | null>(null);

// Provider component to share animation across all skeletons
export const ShimmerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    shimmerAnimation.start();

    return () => {
      shimmerAnimation.stop();
    };
  }, [shimmerAnim]);

  return <ShimmerContext.Provider value={shimmerAnim}>{children}</ShimmerContext.Provider>;
};

// Optimized shimmer animation component using shared context
const Shimmer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const sharedShimmerAnim = useContext(ShimmerContext);
  const fallbackShimmerAnim = useRef(new Animated.Value(0)).current;

  // Use shared animation if available, otherwise create local one
  const shimmerAnim = sharedShimmerAnim || fallbackShimmerAnim;

  useEffect(() => {
    // Only start local animation if no shared animation is available
    if (!sharedShimmerAnim) {
      const shimmerAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(fallbackShimmerAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(fallbackShimmerAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );

      shimmerAnimation.start();

      return () => {
        shimmerAnimation.stop();
      };
    }
  }, [sharedShimmerAnim, fallbackShimmerAnim]);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  return (
    <View style={styles.shimmerContainer}>
      {children}
      <Animated.View
        style={[
          styles.shimmer,
          {
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
};

// Base skeleton component with shimmer
const SkeletonBase: React.FC<{
  width?: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}> = ({ width: skeletonWidth, height, borderRadius = 8, style }) => (
  <Shimmer>
    <View
      style={[
        styles.skeletonBase,
        {
          width: skeletonWidth,
          height,
          borderRadius,
        },
        style,
      ]}
    />
  </Shimmer>
);

// Doctor/Customer card skeleton
export const DoctorSkeleton: React.FC = () => (
  <View style={styles.cardSkeleton}>
    <View style={styles.cardHeader}>
      <View style={styles.avatarSection}>
        <SkeletonBase width={50} height={50} borderRadius={25} />
        <View style={styles.onlineIndicatorSkeleton} />
      </View>
      <View style={styles.infoSection}>
        <View style={styles.nameRow}>
          <SkeletonBase width={120} height={16} />
          <SkeletonBase
            width={16}
            height={16}
            borderRadius={8}
            style={styles.verifiedIconSkeleton}
          />
        </View>
        <SkeletonBase width={80} height={14} style={styles.specialtySkeleton} />
        <View style={styles.ratingRow}>
          <SkeletonBase width={14} height={14} borderRadius={7} />
          <SkeletonBase width={30} height={14} style={styles.ratingSkeleton} />
          <SkeletonBase width={60} height={12} style={styles.reviewsSkeleton} />
        </View>
      </View>
      <View style={styles.priceSection}>
        <SkeletonBase width={50} height={18} />
        <SkeletonBase width={40} height={12} style={styles.priceLabelSkeleton} />
      </View>
    </View>
    <View style={styles.actionButtons}>
      <SkeletonBase width="48%" height={44} borderRadius={8} />
      <SkeletonBase width="48%" height={44} borderRadius={8} />
    </View>
  </View>
);

// Customer card skeleton (similar to doctor but with different fields)
export const CustomerSkeleton: React.FC = () => (
  <View style={styles.cardSkeleton}>
    <View style={styles.cardHeader}>
      <View style={styles.avatarSection}>
        <SkeletonBase width={50} height={50} borderRadius={25} />
        <View style={styles.onlineIndicatorSkeleton} />
      </View>
      <View style={styles.infoSection}>
        <View style={styles.nameRow}>
          <SkeletonBase width={120} height={16} />
          <SkeletonBase
            width={16}
            height={16}
            borderRadius={8}
            style={styles.verifiedIconSkeleton}
          />
        </View>
        <SkeletonBase width={100} height={14} style={styles.specialtySkeleton} />
        <View style={styles.ratingRow}>
          <SkeletonBase width={14} height={14} borderRadius={7} />
          <SkeletonBase width={80} height={12} style={styles.ratingSkeleton} />
        </View>
        <SkeletonBase width={60} height={12} style={styles.reviewsSkeleton} />
      </View>
      <View style={styles.priceSection}>
        <SkeletonBase width={60} height={12} />
        <SkeletonBase width={40} height={12} style={styles.priceLabelSkeleton} />
      </View>
    </View>
    <View style={styles.actionButtons}>
      <SkeletonBase width="48%" height={44} borderRadius={8} />
      <SkeletonBase width="48%" height={44} borderRadius={8} />
    </View>
  </View>
);

// Health dashboard skeleton
export const HealthDashboardSkeleton: React.FC = () => {
  return (
    <View style={styles.healthContainer}>
      {/* Time period selector skeleton */}
      <View style={styles.timePeriodSkeleton}>
        <SkeletonBase width="30%" height={40} borderRadius={12} />
        <SkeletonBase width="30%" height={40} borderRadius={12} />
        <SkeletonBase width="30%" height={40} borderRadius={12} />
      </View>

      {/* Main stats skeleton */}
      <View style={styles.mainStatsSkeleton}>
        <SkeletonBase width="80%" height={24} />
      </View>

      {/* Chart skeleton */}
      <View style={styles.chartSkeleton}>
        <SkeletonBase width="100%" height={180} borderRadius={16} />
        <View style={styles.chartLabels}>
          {Array.from({ length: 7 }, (_, i) => (
            <SkeletonBase key={i} width={30} height={12} />
          ))}
        </View>
      </View>

      {/* Health metrics skeleton */}
      <View style={styles.metricsSkeleton}>
        {Array.from({ length: 3 }, (_, i) => (
          <View key={i} style={styles.metricItem}>
            <SkeletonBase width={16} height={16} borderRadius={8} />
            <View style={styles.metricContent}>
              <SkeletonBase width={40} height={24} />
              <SkeletonBase width={60} height={12} />
            </View>
          </View>
        ))}
      </View>

      {/* Most steps card skeleton */}
      <View style={styles.mostStepsSkeleton}>
        <View style={styles.mostStepsHeader}>
          <SkeletonBase width={64} height={48} borderRadius={12} />
          <View style={styles.mostStepsInfo}>
            <SkeletonBase width={100} height={16} />
            <SkeletonBase width={80} height={18} />
          </View>
          <SkeletonBase width={20} height={20} borderRadius={10} />
        </View>
      </View>
    </View>
  );
};

// Doctor details skeleton
export const DoctorDetailsSkeleton: React.FC = () => (
  <View style={styles.detailsContainer}>
    <View style={styles.detailsHeader}>
      <SkeletonBase width={80} height={80} borderRadius={40} />
      <View style={styles.detailsInfo}>
        <View style={styles.detailsNameRow}>
          <SkeletonBase width={150} height={22} />
          <SkeletonBase width={20} height={20} borderRadius={10} />
        </View>
        <SkeletonBase width={100} height={16} />
        <View style={styles.detailsRatingRow}>
          <SkeletonBase width={16} height={16} borderRadius={8} />
          <SkeletonBase width={30} height={16} />
          <SkeletonBase width={80} height={14} />
        </View>
        <SkeletonBase width={80} height={14} />
      </View>
    </View>

    <View style={styles.priceSectionSkeleton}>
      <SkeletonBase width={100} height={16} />
      <SkeletonBase width={80} height={24} />
    </View>

    <View style={styles.callButtonsSkeleton}>
      <SkeletonBase width="48%" height={56} borderRadius={12} />
      <SkeletonBase width="48%" height={56} borderRadius={12} />
    </View>
  </View>
);

// Customer details skeleton
export const CustomerDetailsSkeleton: React.FC = () => (
  <View style={styles.customerDetailsContainer}>
    <View style={styles.customerProfileSection}>
      <SkeletonBase width={120} height={120} borderRadius={60} />
      <View style={styles.customerProfileInfo}>
        <View style={styles.customerNameRow}>
          <SkeletonBase width={140} height={24} />
          <SkeletonBase width={20} height={20} borderRadius={10} />
        </View>
        <SkeletonBase width={120} height={16} />
        <SkeletonBase width={60} height={14} />
      </View>
    </View>

    <View style={styles.customerActionButtons}>
      <SkeletonBase width="48%" height={56} borderRadius={12} />
      <SkeletonBase width="48%" height={56} borderRadius={12} />
    </View>

    <View style={styles.customerDetailsSection}>
      <SkeletonBase width={120} height={18} />
      {Array.from({ length: 4 }, (_, i) => (
        <View key={i} style={styles.customerDetailRow}>
          <SkeletonBase width={20} height={20} borderRadius={10} />
          <SkeletonBase width={60} height={16} />
          <SkeletonBase width={100} height={16} />
        </View>
      ))}
    </View>
  </View>
);

// Header skeleton
export const HeaderSkeleton: React.FC = () => (
  <View style={styles.headerSkeleton}>
    <View style={styles.headerContent}>
      <SkeletonBase width={120} height={28} />
      <SkeletonBase width={200} height={16} />
    </View>
    <SkeletonBase width={44} height={44} borderRadius={22} />
  </View>
);

// Search bar skeleton
export const SearchBarSkeleton: React.FC = () => (
  <View style={styles.searchBarSkeleton}>
    <SkeletonBase width={20} height={20} borderRadius={10} />
    <SkeletonBase width="80%" height={16} />
  </View>
);

const styles = StyleSheet.create({
  shimmerContainer: {
    overflow: 'hidden',
    position: 'relative',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    transform: [{ translateX: -width }],
  },
  skeletonBase: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },

  // Card skeleton styles
  cardSkeleton: {
    backgroundColor: COLORS.GLASS_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.GLASS_BORDER_LIGHT,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  avatarSection: {
    position: 'relative',
  },
  onlineIndicatorSkeleton: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  infoSection: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedIconSkeleton: {
    marginLeft: 4,
  },
  specialtySkeleton: {
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingSkeleton: {
    marginLeft: 4,
  },
  reviewsSkeleton: {
    marginLeft: 4,
  },
  priceSection: {
    alignItems: 'flex-end',
  },
  priceLabelSkeleton: {
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  // Health dashboard skeleton styles
  healthContainer: {
    paddingHorizontal: 24,
  },
  timePeriodSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  mainStatsSkeleton: {
    alignItems: 'center',
    marginBottom: 40,
  },
  chartSkeleton: {
    marginBottom: 40,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  metricsSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricContent: {
    alignItems: 'center',
    marginTop: 8,
  },
  mostStepsSkeleton: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  mostStepsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mostStepsInfo: {
    flex: 1,
    marginLeft: 16,
  },

  // Details skeleton styles
  detailsContainer: {
    paddingHorizontal: 20,
  },
  detailsHeader: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  detailsInfo: {
    flex: 1,
    marginLeft: 16,
  },
  detailsNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailsRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceSectionSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  callButtonsSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 40,
  },

  // Customer details skeleton styles
  customerDetailsContainer: {
    paddingHorizontal: 20,
  },
  customerProfileSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  customerProfileInfo: {
    alignItems: 'center',
    marginTop: 16,
  },
  customerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  customerActionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    gap: 16,
  },
  customerDetailsSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  customerDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },

  // Header and search skeleton styles
  headerSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flex: 1,
  },
  searchBarSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
});

// Additional skeleton components for consistency
export const SkeletonLoader = SkeletonBase;
export const HealthMetricSkeleton = HealthDashboardSkeleton;
export const HealthChartSkeleton = HealthDashboardSkeleton;
export const HomeStatsSkeleton = HealthDashboardSkeleton;
export const HomeActionsSkeleton = DoctorSkeleton;
export const HomeActivitySkeleton = HealthDashboardSkeleton;
export const ProfileHeaderSkeleton = HeaderSkeleton;
export const ProfileCardSkeleton = DoctorSkeleton;
export const ProfileOptionsSkeleton = DoctorSkeleton;
