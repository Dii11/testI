import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, RefreshControl, Alert, Image } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import {
  AdaptiveFlatList,
  AdaptiveTouchableOpacity,
  AdaptiveCard,
  AdaptiveAnimatedView,
  useAdaptiveTheme,
  PerformanceMonitor,
} from '../../components/adaptive/AdaptiveComponents';
import {
  DoctorSkeleton,
  HeaderSkeleton,
  ShimmerProvider,
} from '../../components/common/SkeletonLoader';
import { COLORS } from '../../constants';
import { useEntityList } from '../../hooks/useEntityList';
import type { AppDispatch } from '../../store';
import { selectIsAuthenticated } from '../../store/selectors/authSelectors';
import {
  selectLightweightDoctors,
  selectDoctorsLoading,
  selectDoctorsError,
  selectFilteredDoctorsCount,
} from '../../store/selectors/doctorsSelectors';
import { logoutUser } from '../../store/slices/authSlice';
import { fetchDoctors, setSearchQuery } from '../../store/slices/doctorsSlice';
import type { HealthSpecialist as HealthSpecialistDto } from '../../types/api';

const DoctorsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch<AppDispatch>();
  const isAuthenticated = useSelector(selectIsAuthenticated);

  // Enhanced entity list with performance tracking and error handling
  const {
    entities: lightweightDoctors,
    isLoading,
    error,
    filteredCount: filteredDoctorsCount,
    refreshing,
    onRefresh,
    handleSearchChange,
    retry,
    retryCount,
    loadingStates,
  } = useEntityList<HealthSpecialistDto>({
    fetchAction: fetchDoctors,
    setSearchQueryAction: setSearchQuery,
    dataSelector: selectLightweightDoctors,
    loadingSelector: selectDoctorsLoading,
    errorSelector: selectDoctorsError,
    filteredCountSelector: selectFilteredDoctorsCount,
    enablePerformanceLogging: __DEV__,
    screenName: 'DoctorsScreen',
  });

  const { theme, isLowEndDevice, getFlatListOptimizations } = useAdaptiveTheme();

  // Memoized rating display for performance
  const formatRating = useCallback((rating: number, totalReviews: number) => {
    return {
      rating: rating.toFixed(1),
      reviews: `(${totalReviews} review${totalReviews !== 1 ? 's' : ''})`,
    };
  }, []);

  const handleDoctorPress = useCallback(
    (doctor: HealthSpecialistDto) => {
      if (!doctor.id) {
        console.warn('Invalid doctor data provided for navigation');
        return;
      }
      try {
        navigation.navigate('DoctorDetails', { doctor });
      } catch (error) {
        console.error('Navigation error:', error);
        Alert.alert('Navigation Error', 'Unable to view doctor details');
      }
    },
    [navigation]
  );

  const handleLogout = useCallback(async () => {
    try {
      await dispatch(logoutUser()).unwrap();
    } catch (error: any) {
      console.error('Error during logout:', error);
      Alert.alert('Logout Error', 'Unable to logout. Please try again.');
    }
  }, [dispatch]);

  // Memoized doctor item for better performance
  const renderDoctorItem = useCallback(
    ({ item: doctor, index }: { item: HealthSpecialistDto; index: number }) => {
      const ratingInfo = formatRating(Number(doctor.rating), Number(doctor.totalReviews));
      const formattedPrice = `$${doctor.teleconsultationFee}`; // Simple string formatting, no need for useMemo inside useCallback

      return (
        <AdaptiveAnimatedView
          animationType={isLowEndDevice ? 'none' : 'fadeIn'}
          delay={isLowEndDevice ? 0 : Math.min(index * 30, 300)} // Cap delay at 300ms to prevent rendering issues
          style={styles.doctorCardContainer}
        >
          <AdaptiveCard
            style={StyleSheet.flatten(
              isLowEndDevice ? [styles.doctorCard, styles.doctorCardSimple] : styles.doctorCard
            )}
            onPress={() => handleDoctorPress(doctor)}
          >
            <View style={styles.doctorInfo}>
              <View style={styles.avatarContainer}>
                {doctor.profilePicture ? (
                  <Image source={{ uri: doctor.profilePicture }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={24} color="#666" />
                  </View>
                )}
                <View
                  style={[
                    styles.onlineIndicator,
                    { backgroundColor: doctor.isOnline ? '#4CAF50' : '#999' },
                  ]}
                />
              </View>
              <View style={styles.doctorDetails}>
                <View style={styles.nameContainer}>
                  <Text style={styles.doctorName}>
                    {doctor.firstName} {doctor.lastName}
                  </Text>
                  {doctor.isVerified && (
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color="#4CAF50"
                      style={styles.verifiedIcon}
                    />
                  )}
                </View>
                <Text style={styles.specialty}>{doctor.specialistType}</Text>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={14} color="#FFD700" />
                  <Text style={styles.rating}>{ratingInfo.rating}</Text>
                  <Text style={styles.reviews}>{ratingInfo.reviews}</Text>
                </View>
              </View>
              <View style={styles.priceContainer}>
                <Text style={styles.price}>{formattedPrice}</Text>
                <Text style={styles.priceLabel}>per session</Text>
              </View>
            </View>
          </AdaptiveCard>
        </AdaptiveAnimatedView>
      );
    },
    [handleDoctorPress, isLowEndDevice, formatRating]
  );

  const renderSkeletonLoaders = () => (
    <LinearGradient
      colors={COLORS.BRAND_GRADIENT}
      locations={COLORS.BRAND_GRADIENT_LOCATIONS}
      start={COLORS.BRAND_GRADIENT_START}
      style={styles.container}
    >
      <ShimmerProvider>
        <View style={styles.header}>
          <HeaderSkeleton />
        </View>
        <View style={styles.content}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Available Doctors</Text>
          </View>
          {Array.from({ length: isLowEndDevice ? 3 : 6 }, (_, index) => (
            <DoctorSkeleton key={index} />
          ))}
        </View>
      </ShimmerProvider>
    </LinearGradient>
  );

  if (loadingStates.isInitialLoad) {
    return renderSkeletonLoaders();
  }

  return (
    <PerformanceMonitor>
      <LinearGradient
        colors={COLORS.BRAND_GRADIENT}
      locations={COLORS.BRAND_GRADIENT_LOCATIONS}
      start={COLORS.BRAND_GRADIENT_START}
        style={styles.container}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Find a Doctor</Text>
              <Text style={styles.headerSubtitle}>Connect with healthcare professionals</Text>
            </View>
            {isAuthenticated && (
              <AdaptiveTouchableOpacity
                style={
                  isLowEndDevice
                    ? [styles.logoutButton, styles.logoutButtonSimple]
                    : styles.logoutButton
                }
                onPress={handleLogout}
                enableHaptics={!isLowEndDevice}
              >
                <Ionicons name="log-out-outline" size={24} color={COLORS.WHITE} />
              </AdaptiveTouchableOpacity>
            )}
          </View>
        </View>
        <View
          style={styles.content}
          collapsable={false}
          needsOffscreenAlphaCompositing={false}
          renderToHardwareTextureAndroid={true}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.titleContainer}>
              <Text style={styles.sectionTitle}>Available Doctors</Text>
              <View
                style={
                  isLowEndDevice ? [styles.countBadge, styles.countBadgeSimple] : styles.countBadge
                }
              >
                <Text style={styles.countText}>{filteredDoctorsCount}</Text>
              </View>
            </View>
          </View>
          <AdaptiveFlatList
            data={lightweightDoctors}
            renderItem={renderDoctorItem}
            keyExtractor={item => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={styles.doctorsList}
            nestedScrollEnabled={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[COLORS.SECONDARY]}
                tintColor={COLORS.SECONDARY}
              />
            }
            showsVerticalScrollIndicator={false}
            {...getFlatListOptimizations()}
            performanceOptimized
            removeClippedSubviews={isLowEndDevice}
            initialNumToRender={isLowEndDevice ? 5 : 10}
            maxToRenderPerBatch={isLowEndDevice ? 5 : 10}
            windowSize={isLowEndDevice ? 7 : 10}
            ListEmptyComponent={
              loadingStates.isLoading && !loadingStates.hasData ? (
                <ShimmerProvider>
                  <View style={styles.skeletonContainer}>
                    {Array.from({ length: isLowEndDevice ? 2 : 4 }, (_, index) => (
                      <DoctorSkeleton key={`skeleton-${index}`} />
                    ))}
                  </View>
                </ShimmerProvider>
              ) : loadingStates.hasError ? (
                <AdaptiveAnimatedView animationType="fadeIn" style={styles.emptyContainer}>
                  <Ionicons name="warning-outline" size={48} color="#E74C3C" />
                  <Text style={styles.errorText}>Failed to load doctors</Text>
                  <Text style={styles.errorSubtext}>{error}</Text>
                  {retryCount > 0 && (
                    <Text style={styles.retryCountText}>Retry attempt: {retryCount}</Text>
                  )}
                  <AdaptiveTouchableOpacity
                    style={styles.retryButton}
                    onPress={retry}
                    enableHaptics={!isLowEndDevice}
                  >
                    <Text style={styles.retryButtonText}>
                      {retryCount > 2 ? 'Try Again' : 'Retry'}
                    </Text>
                  </AdaptiveTouchableOpacity>
                </AdaptiveAnimatedView>
              ) : (
                <AdaptiveAnimatedView animationType="fadeIn" style={styles.emptyContainer}>
                  <Ionicons name="medical" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>No doctors found</Text>
                  <Text style={styles.emptySubtext}>Available doctors will appear here</Text>
                </AdaptiveAnimatedView>
              )
            }
          />
        </View>
      </LinearGradient>
    </PerformanceMonitor>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  content: {
    flex: 1,
    paddingTop: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.001)', // Very slight non-transparent to fix Android 12+ rendering
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginRight: 12,
  },
  countBadge: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.TEXT_DARK,
  },
  doctorsList: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  doctorCardContainer: {
    marginBottom: 12,
  },
  doctorCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: 'rgba(55, 120, 92, 0.11)',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  doctorInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  doctorDetails: {
    marginLeft: 12,
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  specialty: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.TEXT_PRIMARY,
    marginLeft: 4,
  },
  reviews: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginLeft: 4,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.PRIMARY,
  },
  priceLabel: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 10,
    marginTop: 5,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.TEXT_PRIMARY,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 4,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.ERROR,
    marginTop: 16,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: COLORS.TEXT_DARK,
    fontSize: 16,
    fontWeight: '600',
  },
  retryCountText: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 8,
    fontStyle: 'italic',
  },
  skeletonContainer: {
    paddingTop: 20,
  },
  doctorCardSimple: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowOpacity: 0,
    elevation: 0,
  },
  logoutButtonSimple: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
    shadowOpacity: 0,
    elevation: 0,
  },
  countBadgeSimple: {
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
  },
});

export default DoctorsScreen;
