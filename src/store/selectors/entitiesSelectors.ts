import { createSelector } from '@reduxjs/toolkit';

import type { RootState } from '../index';
import { selectAllNormalizedDoctors, selectAllNormalizedCustomers } from '../slices/entitiesSlice';

// Base selectors
const selectDoctorsState = (state: RootState) => state.entities.doctors;
const selectCustomersState = (state: RootState) => state.entities.customers;

// Doctors selectors
export const selectDoctorsSearchQuery = createSelector(
  [selectDoctorsState],
  doctors => doctors.searchQuery
);

export const selectDoctorsFilters = createSelector(
  [selectDoctorsState],
  doctors => doctors.filters
);

export const selectDoctorsLoading = createSelector(
  [selectDoctorsState],
  doctors => doctors.isLoading
);

export const selectDoctorsError = createSelector([selectDoctorsState], doctors => doctors.error);

// Filtered doctors based on search and filters
export const selectFilteredNormalizedDoctors = createSelector(
  [selectAllNormalizedDoctors, selectDoctorsSearchQuery, selectDoctorsFilters],
  (doctors, searchQuery, filters) => {
    let filtered = doctors;

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        doctor =>
          `${doctor.firstName} ${doctor.lastName}`.toLowerCase().includes(query) ||
          doctor.specialistType.toLowerCase().includes(query) ||
          doctor.email.toLowerCase().includes(query)
      );
    }

    // Apply filters
    if (filters.specialty) {
      filtered = filtered.filter(doctor => doctor.specialistType === filters.specialty);
    }

    if (filters.onlineOnly) {
      filtered = filtered.filter(doctor => doctor.isOnline);
    }

    if (filters.verifiedOnly) {
      filtered = filtered.filter(doctor => doctor.isVerified);
    }

    if (filters.minRating > 0) {
      filtered = filtered.filter(doctor => doctor.rating >= filters.minRating);
    }

    if (filters.maxPrice) {
      filtered = filtered.filter(doctor => doctor.teleconsultationFee <= filters.maxPrice!);
    }

    return filtered;
  }
);

export const selectFilteredDoctorsCount = createSelector(
  [selectFilteredNormalizedDoctors],
  filteredDoctors => filteredDoctors.length
);

export const selectOnlineNormalizedDoctors = createSelector([selectAllNormalizedDoctors], doctors =>
  doctors.filter(doctor => doctor.isOnline)
);

export const selectVerifiedNormalizedDoctors = createSelector(
  [selectAllNormalizedDoctors],
  doctors => doctors.filter(doctor => doctor.isVerified)
);

export const selectTopRatedNormalizedDoctors = createSelector(
  [selectAllNormalizedDoctors],
  doctors => {
    return [...doctors]
      .filter(doctor => doctor.totalReviews >= 5)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 10);
  }
);

export const selectDoctorsStatsNormalized = createSelector(
  [selectAllNormalizedDoctors, selectOnlineNormalizedDoctors, selectVerifiedNormalizedDoctors],
  (allDoctors, onlineDoctors, verifiedDoctors) => ({
    total: allDoctors.length,
    online: onlineDoctors.length,
    verified: verifiedDoctors.length,
    onlinePercentage:
      allDoctors.length > 0 ? Math.round((onlineDoctors.length / allDoctors.length) * 100) : 0,
    verifiedPercentage:
      allDoctors.length > 0 ? Math.round((verifiedDoctors.length / allDoctors.length) * 100) : 0,
  })
);

// Customers selectors
export const selectCustomersSearchQuery = createSelector(
  [selectCustomersState],
  customers => customers.searchQuery
);

export const selectCustomersFilters = createSelector(
  [selectCustomersState],
  customers => customers.filters
);

export const selectCustomersLoading = createSelector(
  [selectCustomersState],
  customers => customers.isLoading
);

export const selectCustomersError = createSelector(
  [selectCustomersState],
  customers => customers.error
);

// Filtered customers based on search and filters
export const selectFilteredNormalizedCustomers = createSelector(
  [selectAllNormalizedCustomers, selectCustomersSearchQuery, selectCustomersFilters],
  (customers, searchQuery, filters) => {
    let filtered = customers;
    const currentYear = new Date().getFullYear();

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        customer =>
          `${customer.firstName} ${customer.lastName}`.toLowerCase().includes(query) ||
          customer.email.toLowerCase().includes(query) ||
          customer.phoneNumber?.toLowerCase().includes(query)
      );
    }

    // Apply filters
    if (filters.onlineOnly) {
      filtered = filtered.filter(customer => customer.isOnline);
    }

    if (filters.verifiedOnly) {
      filtered = filtered.filter(customer => customer.emailVerified);
    }

    if (filters.ageRange) {
      filtered = filtered.filter(customer => {
        if (!customer.dateOfBirth) return false;
        const age = currentYear - new Date(customer.dateOfBirth).getFullYear();
        return age >= filters.ageRange!.min && age <= filters.ageRange!.max;
      });
    }

    if (filters.gender) {
      filtered = filtered.filter(customer => customer.gender === filters.gender);
    }

    return filtered;
  }
);

export const selectFilteredCustomersCount = createSelector(
  [selectFilteredNormalizedCustomers],
  filteredCustomers => filteredCustomers.length
);

export const selectOnlineNormalizedCustomers = createSelector(
  [selectAllNormalizedCustomers],
  customers => customers.filter(customer => customer.isOnline)
);

export const selectVerifiedNormalizedCustomers = createSelector(
  [selectAllNormalizedCustomers],
  customers => customers.filter(customer => customer.emailVerified)
);

export const selectRecentNormalizedCustomers = createSelector(
  [selectAllNormalizedCustomers],
  customers => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return customers.filter(customer => new Date(customer.createdAt) >= thirtyDaysAgo);
  }
);

export const selectCustomersStatsNormalized = createSelector(
  [
    selectAllNormalizedCustomers,
    selectOnlineNormalizedCustomers,
    selectVerifiedNormalizedCustomers,
    selectRecentNormalizedCustomers,
  ],
  (allCustomers, onlineCustomers, verifiedCustomers, recentCustomers) => ({
    total: allCustomers.length,
    online: onlineCustomers.length,
    verified: verifiedCustomers.length,
    recent: recentCustomers.length,
    onlinePercentage:
      allCustomers.length > 0
        ? Math.round((onlineCustomers.length / allCustomers.length) * 100)
        : 0,
    verifiedPercentage:
      allCustomers.length > 0
        ? Math.round((verifiedCustomers.length / allCustomers.length) * 100)
        : 0,
  })
);

// Performance indicators
export const selectEntitiesPerformanceMetrics = createSelector(
  [selectDoctorsState, selectCustomersState],
  (doctorsState, customersState) => ({
    doctors: {
      lastFetch: doctorsState.lastFetch,
      cacheAge: doctorsState.lastFetch ? Date.now() - doctorsState.lastFetch : null,
      isCacheFresh: doctorsState.lastFetch
        ? Date.now() - doctorsState.lastFetch < 5 * 60 * 1000
        : false,
      isLoading: doctorsState.isLoading,
      hasError: !!doctorsState.error,
    },
    customers: {
      lastFetch: customersState.lastFetch,
      cacheAge: customersState.lastFetch ? Date.now() - customersState.lastFetch : null,
      isCacheFresh: customersState.lastFetch
        ? Date.now() - customersState.lastFetch < 5 * 60 * 1000
        : false,
      isLoading: customersState.isLoading,
      hasError: !!customersState.error,
    },
  })
);

// Loading states for components
export const selectDoctorsLoadingStatesNormalized = createSelector(
  [selectDoctorsState, selectAllNormalizedDoctors],
  (doctorsState, allDoctors) => ({
    isLoading: doctorsState.isLoading,
    hasError: !!doctorsState.error,
    hasData: allDoctors.length > 0,
    isEmpty: allDoctors.length === 0 && !doctorsState.isLoading,
    isSearching: !!doctorsState.searchQuery.trim() && doctorsState.isLoading,
  })
);

export const selectCustomersLoadingStatesNormalized = createSelector(
  [selectCustomersState, selectAllNormalizedCustomers],
  (customersState, allCustomers) => ({
    isLoading: customersState.isLoading,
    hasError: !!customersState.error,
    hasData: allCustomers.length > 0,
    isEmpty: allCustomers.length === 0 && !customersState.isLoading,
    isSearching: !!customersState.searchQuery.trim() && customersState.isLoading,
  })
);

// Optimized selectors for list rendering (memoized and filtered for essential props only)
export const selectOptimizedDoctorsForList = createSelector(
  [selectFilteredNormalizedDoctors],
  doctors =>
    doctors.map(doctor => ({
      id: doctor.id,
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      specialistType: doctor.specialistType,
      rating: doctor.rating,
      totalReviews: doctor.totalReviews,
      teleconsultationFee: doctor.teleconsultationFee,
      isOnline: doctor.isOnline,
      isVerified: doctor.isVerified,
      profilePicture: doctor.profilePicture,
    }))
);

export const selectOptimizedCustomersForList = createSelector(
  [selectFilteredNormalizedCustomers],
  customers =>
    customers.map(customer => ({
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phoneNumber: customer.phoneNumber,
      isOnline: customer.isOnline,
      emailVerified: customer.emailVerified,
      profilePicture: customer.profilePicture,
      createdAt: customer.createdAt,
      dateOfBirth: customer.dateOfBirth,
    }))
);
