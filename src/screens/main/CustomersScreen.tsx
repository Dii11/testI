import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Image, RefreshControl, Alert } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import {
  AdaptiveFlatList,
  AdaptiveTouchableOpacity,
  AdaptiveCard,
  AdaptiveAnimatedView,
  useAdaptiveTheme,
  PerformanceMonitor,
} from '../../components/adaptive/AdaptiveComponents';
import { SearchInput } from '../../components/common/SearchInput';
import {
  CustomerSkeleton,
  HeaderSkeleton,
  SearchBarSkeleton,
  ShimmerProvider,
} from '../../components/common/SkeletonLoader';
import { COLORS } from '../../constants';
import { useEntityList } from '../../hooks/useEntityList';
import type { Customer } from '../../services/customersService';
import type { AppDispatch } from '../../store';
import { selectIsAuthenticated } from '../../store/selectors/authSelectors';
import {
  selectLightweightCustomers,
  selectCustomersLoading,
  selectCustomersError,
  selectFilteredCustomersCount,
} from '../../store/selectors/customersSelectors';
import { logoutUser } from '../../store/slices/authSlice';
import { fetchCustomers, setSearchQuery } from '../../store/slices/customersSlice';

const CustomersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch<AppDispatch>();
  const isAuthenticated = useSelector(selectIsAuthenticated);

  // Enhanced entity list with performance tracking and error handling
  const {
    entities: lightweightCustomers,
    isLoading,
    error,
    filteredCount: filteredCustomersCount,
    refreshing,
    onRefresh,
    handleSearchChange,
    retry,
    retryCount,
    loadingStates,
  } = useEntityList<Customer>({
    fetchAction: fetchCustomers,
    setSearchQueryAction: setSearchQuery,
    dataSelector: selectLightweightCustomers,
    loadingSelector: selectCustomersLoading,
    errorSelector: selectCustomersError,
    filteredCountSelector: selectFilteredCustomersCount,
    enablePerformanceLogging: __DEV__,
    screenName: 'CustomersScreen',
  });

  // Adaptive theme and performance hooks
  const {
    theme,
    isLowEndDevice,
    shouldUseGradients,
    shouldUseShadows,
    getCardStyle,
    getFlatListOptimizations,
  } = useAdaptiveTheme();

  // Memoized customer age calculation for performance
  const getCustomerAge = useCallback((dateOfBirth: string) => {
    return new Date().getFullYear() - new Date(dateOfBirth).getFullYear();
  }, []);

  const handleSearchSubmit = useCallback((query: string) => {
    console.log('🔍 CustomersScreen - Search submitted:', query);
  }, []);

  const handleCustomerPress = useCallback(
    (customer: Customer) => {
      if (!customer.id) {
        console.warn('Invalid customer data provided for navigation');
        Alert.alert('Error', 'Unable to view customer details');
        return;
      }
      try {
        navigation.navigate('CustomerDetails', { customer });
      } catch (error) {
        console.error('Navigation error:', error);
        Alert.alert('Navigation Error', 'Unable to view customer details');
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

  // Memoized customer item for better performance
  const renderCustomerItem = useCallback(
    ({ item: customer, index }: { item: Customer; index: number }) => {
      const customerAge = customer.dateOfBirth ? getCustomerAge(customer.dateOfBirth) : null;
      const joinDate = new Date(customer.createdAt).toLocaleDateString(); // Simple calculation, no need for useMemo inside useCallback

      return (
        <AdaptiveAnimatedView
          animationType={isLowEndDevice ? 'none' : 'fadeIn'}
          delay={isLowEndDevice ? 0 : Math.min(index * 30, 300)} // Cap delay at 300ms to prevent rendering issues
          style={styles.customerCardContainer}
        >
          <AdaptiveCard
            style={StyleSheet.flatten(
              isLowEndDevice
                ? [styles.customerCard, styles.customerCardSimple]
                : styles.customerCard
            )}
            onPress={() => handleCustomerPress(customer)}
          >
            <View style={styles.customerInfo}>
              <View style={styles.avatarContainer}>
                {customer.profilePicture ? (
                  <Image source={{ uri: customer.profilePicture }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={24} color="#666" />
                  </View>
                )}
                <View
                  style={[
                    styles.onlineIndicator,
                    { backgroundColor: customer.isOnline ? '#4CAF50' : '#999' },
                  ]}
                />
              </View>
              <View style={styles.customerDetails}>
                <View style={styles.nameContainer}>
                  <Text style={styles.customerName}>
                    {customer.firstName} {customer.lastName}
                  </Text>
                  {customer.emailVerified && (
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color="#4CAF50"
                      style={styles.verifiedIcon}
                    />
                  )}
                </View>
                <Text style={styles.email}>{customer.email}</Text>
                <View style={styles.infoContainer}>
                  <Ionicons name="calendar" size={14} color="#666" />
                  <Text style={styles.joinDate}>Joined {joinDate}</Text>
                </View>
                {customer.phoneNumber && (
                  <View style={styles.infoContainer}>
                    <Ionicons name="call-outline" size={14} color="#666" />
                    <Text style={styles.phoneNumber}>{customer.phoneNumber}</Text>
                  </View>
                )}
              </View>
              <View style={styles.statusContainer}>
                <Text style={[styles.status, customer.isOnline ? styles.online : styles.offline]}>
                  {customer.isOnline ? 'Online' : 'Offline'}
                </Text>
                {customerAge && <Text style={styles.age}>Age {customerAge}</Text>}
              </View>
            </View>
          </AdaptiveCard>
        </AdaptiveAnimatedView>
      );
    },
    [handleCustomerPress, isLowEndDevice, getCustomerAge]
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
          <SearchBarSkeleton />
        </View>

        <View style={styles.content}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Patients</Text>
          </View>
          {Array.from({ length: isLowEndDevice ? 3 : 6 }, (_, index) => (
            <CustomerSkeleton key={index} />
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
              <Text style={styles.headerTitle}>My Patients</Text>
              <Text style={styles.headerSubtitle}>Manage your patient consultations</Text>
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

          {/* <SearchInput
            onSearchChange={handleSearchChange}
            onSearchSubmit={handleSearchSubmit}
            placeholder="Search patients..."
            accessibilityLabel="Search patients"
            containerStyle={styles.searchContainer}
            variant="glass"
            debounceMs={300}
            isLoading={isLoading && searchQuery.length > 0}
            testID="patients-search"
          /> */}
        </View>

        <View
          style={styles.content}
          collapsable={false}
          needsOffscreenAlphaCompositing={false}
          renderToHardwareTextureAndroid={true}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.titleContainer}>
              <Text style={styles.sectionTitle}>Active Patients</Text>
              <View
                style={
                  isLowEndDevice ? [styles.countBadge, styles.countBadgeSimple] : styles.countBadge
                }
              >
                <Text style={styles.countText}>{filteredCustomersCount}</Text>
              </View>
            </View>
          </View>

          <AdaptiveFlatList
            data={lightweightCustomers}
            renderItem={renderCustomerItem}
            keyExtractor={item => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={styles.customersList}
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
                      <CustomerSkeleton key={`skeleton-${index}`} />
                    ))}
                  </View>
                </ShimmerProvider>
              ) : loadingStates.hasError ? (
                <AdaptiveAnimatedView animationType="fadeIn" style={styles.emptyContainer}>
                  <Ionicons name="warning-outline" size={48} color="#E74C3C" />
                  <Text style={styles.errorText}>Failed to load patients</Text>
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
                  <Ionicons name="people" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>No patients found</Text>
                  <Text style={styles.emptySubtext}>Your patients will appear here</Text>
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
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  customersList: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  customerCard: {
    backgroundColor: COLORS.GLASS_BG, // OLD APP exact color
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.GLASS_BORDER, // OLD APP exact color
    shadowColor: 'rgba(55, 120, 92, 0.11)',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  customerInfo: {
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
  customerDetails: {
    marginLeft: 12,
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  email: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  joinDate: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginLeft: 4,
  },
  phoneNumber: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginLeft: 4,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  status: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  online: {
    backgroundColor: '#E8F5E8',
    color: '#4CAF50',
  },
  offline: {
    backgroundColor: '#F5F5F5',
    color: '#999',
  },
  age: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 4,
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: COLORS.BUTTON_SECONDARY, // OLD APP semi-transparent overlay
    borderRadius: 20,
    padding: 10,
    marginTop: 5,
  },
  skeletonContainer: {
    paddingTop: 20,
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
  // Low-end device optimizations
  customerCardContainer: {
    marginBottom: 12,
  },
  customerCardSimple: {
    backgroundColor: COLORS.GLASS_BG, // OLD APP exact color
    borderWidth: 1,
    borderColor: COLORS.GLASS_BORDER, // OLD APP exact color
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

export default CustomersScreen;
