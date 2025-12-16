import { createSelector } from '@reduxjs/toolkit';

import type { RootState } from '../index';
import type { Doctor } from '../slices/doctorsSlice';

// Base selector for doctors state
const selectDoctorsState = (state: RootState) => state.doctors;

// Core selectors
export const selectAllDoctors = createSelector([selectDoctorsState], doctors => doctors.doctors);

export const selectFilteredDoctors = createSelector(
  [selectDoctorsState],
  doctors => doctors.filteredDoctors
);

export const selectDoctorsSearchQuery = createSelector(
  [selectDoctorsState],
  doctors => doctors.searchQuery
);

export const selectDoctorsLoading = createSelector(
  [selectDoctorsState],
  doctors => doctors.isLoading
);

export const selectDoctorsError = createSelector([selectDoctorsState], doctors => doctors.error);

export const selectSelectedDoctor = createSelector(
  [selectDoctorsState],
  doctors => doctors.selectedDoctor
);

// Enhanced selectors
export const selectDoctorsCount = createSelector([selectAllDoctors], doctors => doctors.length);

export const selectFilteredDoctorsCount = createSelector(
  [selectFilteredDoctors],
  filteredDoctors => filteredDoctors.length
);

export const selectOnlineDoctors = createSelector([selectAllDoctors], doctors =>
  doctors.filter(doctor => doctor.isOnline)
);

export const selectOnlineDoctorsCount = createSelector(
  [selectOnlineDoctors],
  onlineDoctors => onlineDoctors.length
);

export const selectVerifiedDoctors = createSelector([selectAllDoctors], doctors =>
  doctors.filter(doctor => doctor.isVerified)
);

export const selectDoctorsBySpecialty = createSelector([selectAllDoctors], doctors => {
  const specialtyGroups: Record<string, Doctor[]> = {};

  doctors.forEach(doctor => {
    const specialty = doctor.specialistType;
    if (!specialtyGroups[specialty]) {
      specialtyGroups[specialty] = [];
    }
    specialtyGroups[specialty].push(doctor);
  });

  return specialtyGroups;
});

export const selectSpecialties = createSelector([selectDoctorsBySpecialty], specialtyGroups =>
  Object.keys(specialtyGroups).sort()
);

export const selectTopRatedDoctors = createSelector([selectAllDoctors], doctors => {
  return [...doctors]
    .filter(doctor => doctor.totalReviews >= 5) // Only doctors with meaningful reviews
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 10);
});

export const selectDoctorsByPriceRange = (minPrice: number, maxPrice: number) =>
  createSelector([selectAllDoctors], doctors =>
    doctors.filter(
      doctor => doctor.teleconsultationFee >= minPrice && doctor.teleconsultationFee <= maxPrice
    )
  );

export const selectDoctorById = (doctorId: string) =>
  createSelector(
    [selectAllDoctors],
    doctors => doctors.find(doctor => doctor.id === doctorId) || null
  );

export const selectPriceRange = createSelector([selectAllDoctors], doctors => {
  if (doctors.length === 0) return { min: 0, max: 0, average: 0 };

  const fees = doctors.map(doctor => doctor.teleconsultationFee);
  const min = Math.min(...fees);
  const max = Math.max(...fees);
  const average = fees.reduce((sum, fee) => sum + fee, 0) / fees.length;

  return { min, max, average: Math.round(average * 100) / 100 };
});

// Search and filtering selectors
export const selectFilteredDoctorsByQuery = (searchQuery: string) =>
  createSelector([selectAllDoctors], doctors => {
    if (!searchQuery.trim()) return doctors;

    const query = searchQuery.toLowerCase();
    return doctors.filter(
      doctor =>
        `${doctor.firstName} ${doctor.lastName}`.toLowerCase().includes(query) ||
        doctor.specialistType.toLowerCase().includes(query) ||
        doctor.email.toLowerCase().includes(query)
    );
  });

export const selectFilteredDoctorsBySpecialty = (specialty: string) =>
  createSelector([selectAllDoctors], doctors =>
    specialty ? doctors.filter(doctor => doctor.specialistType === specialty) : doctors
  );

export const selectFilteredDoctorsByAvailability = (onlineOnly: boolean) =>
  createSelector([selectAllDoctors], doctors =>
    onlineOnly ? doctors.filter(doctor => doctor.isOnline) : doctors
  );

// Complex filtering selector
export const selectFilteredDoctorsAdvanced = (filters: {
  searchQuery?: string;
  specialty?: string;
  onlineOnly?: boolean;
  verifiedOnly?: boolean;
  minRating?: number;
  maxPrice?: number;
}) =>
  createSelector([selectAllDoctors], doctors => {
    let filtered = doctors;

    if (filters.searchQuery?.trim()) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        doctor =>
          `${doctor.firstName} ${doctor.lastName}`.toLowerCase().includes(query) ||
          doctor.specialistType.toLowerCase().includes(query)
      );
    }

    if (filters.specialty) {
      filtered = filtered.filter(doctor => doctor.specialistType === filters.specialty);
    }

    if (filters.onlineOnly) {
      filtered = filtered.filter(doctor => doctor.isOnline);
    }

    if (filters.verifiedOnly) {
      filtered = filtered.filter(doctor => doctor.isVerified);
    }

    if (filters.minRating) {
      filtered = filtered.filter(doctor => doctor.rating >= filters.minRating!);
    }

    if (filters.maxPrice) {
      filtered = filtered.filter(doctor => doctor.teleconsultationFee <= filters.maxPrice!);
    }

    return filtered;
  });

// Statistics selectors
export const selectDoctorsStats = createSelector(
  [selectAllDoctors, selectOnlineDoctors, selectVerifiedDoctors],
  (allDoctors, onlineDoctors, verifiedDoctors) => ({
    total: allDoctors.length,
    online: onlineDoctors.length,
    verified: verifiedDoctors.length,
    offlinePercentage:
      allDoctors.length > 0
        ? Math.round(((allDoctors.length - onlineDoctors.length) / allDoctors.length) * 100)
        : 0,
    verifiedPercentage:
      allDoctors.length > 0 ? Math.round((verifiedDoctors.length / allDoctors.length) * 100) : 0,
  })
);

// Loading states selector
export const selectDoctorsLoadingStates = createSelector([selectDoctorsState], doctors => ({
  isLoading: doctors.isLoading,
  hasError: !!doctors.error,
  hasData: doctors.doctors.length > 0,
  isEmpty: doctors.doctors.length === 0 && !doctors.isLoading,
  isSearching: !!doctors.searchQuery.trim() && doctors.isLoading,
}));

// Recommendation selectors
export const selectRecommendedDoctors = createSelector([selectAllDoctors], doctors => {
  // Simple recommendation logic based on rating and verification
  return [...doctors]
    .filter(doctor => doctor.isVerified && doctor.rating >= 4.0)
    .sort((a, b) => {
      // Prioritize online doctors, then by rating, then by review count
      if (a.isOnline !== b.isOnline) return b.isOnline ? 1 : -1;
      if (a.rating !== b.rating) return b.rating - a.rating;
      return b.totalReviews - a.totalReviews;
    })
    .slice(0, 5);
});

// Chart data selectors (for analytics)
export const selectDoctorsBySpecialtyChart = createSelector(
  [selectDoctorsBySpecialty],
  specialtyGroups => {
    return Object.entries(specialtyGroups)
      .map(([specialty, doctors]) => ({
        specialty,
        count: doctors.length,
        percentage: 0, // Will be calculated by component
      }))
      .sort((a, b) => b.count - a.count);
  }
);

export const selectDoctorsRatingDistribution = createSelector([selectAllDoctors], doctors => {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  doctors.forEach(doctor => {
    const rating = Math.floor(doctor.rating);
    if (rating >= 1 && rating <= 5) {
      distribution[rating as keyof typeof distribution]++;
    }
  });

  return Object.entries(distribution).map(([rating, count]) => ({
    rating: parseInt(rating),
    count,
    percentage: doctors.length > 0 ? Math.round((count / doctors.length) * 100) : 0,
  }));
});

// Performance optimization selector - for display in lists (keeps all required fields)
export const selectLightweightDoctors = createSelector([selectFilteredDoctors], doctors =>
  doctors.map(doctor => ({
    ...doctor,
    // Ensure we have all required fields for display
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
