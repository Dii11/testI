import { createSelector } from '@reduxjs/toolkit';

import type { Customer } from '../../services/customersService';
import type { RootState } from '../index';

// Base selector for customers state
const selectCustomersState = (state: RootState) => state.customers;

// Core selectors
export const selectAllCustomers = createSelector(
  [selectCustomersState],
  customers => customers.customers
);

export const selectFilteredCustomers = createSelector(
  [selectCustomersState],
  customers => customers.filteredCustomers
);

export const selectCustomersSearchQuery = createSelector(
  [selectCustomersState],
  customers => customers.searchQuery
);

export const selectCustomersLoading = createSelector(
  [selectCustomersState],
  customers => customers.isLoading
);

export const selectCustomersError = createSelector(
  [selectCustomersState],
  customers => customers.error
);

export const selectSelectedCustomer = createSelector(
  [selectCustomersState],
  customers => customers.selectedCustomer
);

// Enhanced selectors
export const selectCustomersCount = createSelector(
  [selectAllCustomers],
  customers => customers.length
);

export const selectFilteredCustomersCount = createSelector(
  [selectFilteredCustomers],
  filteredCustomers => filteredCustomers.length
);

export const selectOnlineCustomers = createSelector([selectAllCustomers], customers =>
  customers.filter(customer => customer.isOnline)
);

export const selectOnlineCustomersCount = createSelector(
  [selectOnlineCustomers],
  onlineCustomers => onlineCustomers.length
);

export const selectVerifiedCustomers = createSelector([selectAllCustomers], customers =>
  customers.filter(customer => customer.emailVerified)
);

export const selectVerifiedCustomersCount = createSelector(
  [selectVerifiedCustomers],
  verifiedCustomers => verifiedCustomers.length
);

// Age-based selectors
export const selectCustomersByAgeGroup = createSelector([selectAllCustomers], customers => {
  const ageGroups: Record<string, Customer[]> = {
    'Under 18': [],
    '18-25': [],
    '26-35': [],
    '36-45': [],
    '46-55': [],
    '56-65': [],
    'Over 65': [],
  };

  const currentYear = new Date().getFullYear();

  customers.forEach(customer => {
    if (!customer.dateOfBirth) return;

    const age = currentYear - new Date(customer.dateOfBirth).getFullYear();

    if (age < 18) ageGroups['Under 18'].push(customer);
    else if (age <= 25) ageGroups['18-25'].push(customer);
    else if (age <= 35) ageGroups['26-35'].push(customer);
    else if (age <= 45) ageGroups['36-45'].push(customer);
    else if (age <= 55) ageGroups['46-55'].push(customer);
    else if (age <= 65) ageGroups['56-65'].push(customer);
    else ageGroups['Over 65'].push(customer);
  });

  return ageGroups;
});

export const selectAverageCustomerAge = createSelector([selectAllCustomers], customers => {
  const currentYear = new Date().getFullYear();
  const ages = customers
    .filter(customer => customer.dateOfBirth)
    .map(customer => currentYear - new Date(customer.dateOfBirth!).getFullYear());

  if (ages.length === 0) return 0;

  const sum = ages.reduce((acc, age) => acc + age, 0);
  return Math.round(sum / ages.length);
});

// Gender-based selectors
export const selectCustomersByGender = createSelector([selectAllCustomers], customers => {
  const genderGroups: Record<string, Customer[]> = {
    male: [],
    female: [],
    other: [],
    unspecified: [],
  };

  customers.forEach(customer => {
    const gender = customer.gender || 'unspecified';
    if (genderGroups[gender]) {
      genderGroups[gender].push(customer);
    } else {
      genderGroups.unspecified.push(customer);
    }
  });

  return genderGroups;
});

// Recent customers (joined in last 30 days)
export const selectRecentCustomers = createSelector([selectAllCustomers], customers => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return customers.filter(customer => new Date(customer.createdAt) >= thirtyDaysAgo);
});

export const selectRecentCustomersCount = createSelector(
  [selectRecentCustomers],
  recentCustomers => recentCustomers.length
);

// Search and filtering selectors
export const selectCustomerById = (customerId: string) =>
  createSelector(
    [selectAllCustomers],
    customers => customers.find(customer => customer.id === customerId) || null
  );

export const selectFilteredCustomersByQuery = (searchQuery: string) =>
  createSelector([selectAllCustomers], customers => {
    if (!searchQuery.trim()) return customers;

    const query = searchQuery.toLowerCase();
    return customers.filter(
      customer =>
        `${customer.firstName} ${customer.lastName}`.toLowerCase().includes(query) ||
        customer.email.toLowerCase().includes(query) ||
        customer.phoneNumber?.toLowerCase().includes(query)
    );
  });

export const selectFilteredCustomersByStatus = (onlineOnly: boolean) =>
  createSelector([selectAllCustomers], customers =>
    onlineOnly ? customers.filter(customer => customer.isOnline) : customers
  );

export const selectFilteredCustomersByVerification = (verifiedOnly: boolean) =>
  createSelector([selectAllCustomers], customers =>
    verifiedOnly ? customers.filter(customer => customer.emailVerified) : customers
  );

// Complex filtering selector
export const selectFilteredCustomersAdvanced = (filters: {
  searchQuery?: string;
  onlineOnly?: boolean;
  verifiedOnly?: boolean;
  ageRange?: { min: number; max: number };
  gender?: 'male' | 'female' | 'other';
  joinedAfter?: Date;
}) =>
  createSelector([selectAllCustomers], customers => {
    let filtered = customers;
    const currentYear = new Date().getFullYear();

    if (filters.searchQuery?.trim()) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        customer =>
          `${customer.firstName} ${customer.lastName}`.toLowerCase().includes(query) ||
          customer.email.toLowerCase().includes(query) ||
          customer.phoneNumber?.toLowerCase().includes(query)
      );
    }

    if (filters.onlineOnly) {
      filtered = filtered.filter(customer => customer.isOnline);
    }

    if (filters.verifiedOnly) {
      filtered = filtered.filter(customer => customer.emailVerified);
    }

    if (filters.ageRange?.min !== undefined && filters.ageRange.max !== undefined) {
      filtered = filtered.filter(customer => {
        if (!customer.dateOfBirth) return false;
        const age = currentYear - new Date(customer.dateOfBirth).getFullYear();
        return age >= filters.ageRange!.min && age <= filters.ageRange!.max;
      });
    }

    if (filters.gender) {
      filtered = filtered.filter(customer => customer.gender === filters.gender);
    }

    if (filters.joinedAfter) {
      filtered = filtered.filter(customer => new Date(customer.createdAt) >= filters.joinedAfter!);
    }

    return filtered;
  });

// Statistics selectors
export const selectCustomersStats = createSelector(
  [
    selectAllCustomers,
    selectOnlineCustomers,
    selectVerifiedCustomers,
    selectRecentCustomers,
    selectAverageCustomerAge,
  ],
  (allCustomers, onlineCustomers, verifiedCustomers, recentCustomers, averageAge) => ({
    total: allCustomers.length,
    online: onlineCustomers.length,
    verified: verifiedCustomers.length,
    recentSignups: recentCustomers.length,
    averageAge,
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

// Loading states selector
export const selectCustomersLoadingStates = createSelector([selectCustomersState], customers => ({
  isLoading: customers.isLoading,
  hasError: !!customers.error,
  hasData: customers.customers.length > 0,
  isEmpty: customers.customers.length === 0 && !customers.isLoading,
  isSearching: !!customers.searchQuery.trim() && customers.isLoading,
}));

// Chart data selectors (for analytics)
export const selectCustomersByAgeGroupChart = createSelector(
  [selectCustomersByAgeGroup],
  ageGroups => {
    return Object.entries(ageGroups)
      .map(([ageGroup, customers]) => ({
        ageGroup,
        count: customers.length,
        percentage: 0, // Will be calculated by component
      }))
      .filter(group => group.count > 0)
      .sort((a, b) => {
        // Sort by age group order
        const order = ['Under 18', '18-25', '26-35', '36-45', '46-55', '56-65', 'Over 65'];
        return order.indexOf(a.ageGroup) - order.indexOf(b.ageGroup);
      });
  }
);

export const selectCustomersByGenderChart = createSelector(
  [selectCustomersByGender],
  genderGroups => {
    return Object.entries(genderGroups)
      .map(([gender, customers]) => ({
        gender: gender.charAt(0).toUpperCase() + gender.slice(1),
        count: customers.length,
        percentage: 0, // Will be calculated by component
      }))
      .filter(group => group.count > 0)
      .sort((a, b) => b.count - a.count);
  }
);

export const selectCustomerRegistrationTrend = createSelector([selectAllCustomers], customers => {
  // Group customers by month for the last 12 months
  const months: Record<string, number> = {};
  const now = new Date();

  // Initialize last 12 months
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    months[key] = 0;
  }

  // Count customers by registration month
  customers.forEach(customer => {
    const date = new Date(customer.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (months.hasOwnProperty(key)) {
      months[key]++;
    }
  });

  return Object.entries(months).map(([month, count]) => ({
    month,
    count,
    formattedMonth: new Date(month + '-01').toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    }),
  }));
});

// Active customers (customers who have been online in the last 7 days)
export const selectActiveCustomers = createSelector([selectAllCustomers], customers => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return customers.filter(
    customer =>
      customer.isOnline || (customer.updatedAt && new Date(customer.updatedAt) >= sevenDaysAgo)
  );
});

export const selectActiveCustomersCount = createSelector(
  [selectActiveCustomers],
  activeCustomers => activeCustomers.length
);

// Performance optimization selector - for display in lists (keeps all required fields)
export const selectLightweightCustomers = createSelector([selectFilteredCustomers], customers =>
  customers.map(customer => ({
    ...customer,
    // Ensure we have all required fields for display
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phoneNumber: customer.phoneNumber,
    dateOfBirth: customer.dateOfBirth,
    createdAt: customer.createdAt,
    isOnline: customer.isOnline,
    emailVerified: customer.emailVerified,
    profilePicture: customer.profilePicture,
  }))
);

// Quick access selectors for dashboard
export const selectCustomersDashboardData = createSelector(
  [
    selectCustomersCount,
    selectOnlineCustomersCount,
    selectRecentCustomersCount,
    selectVerifiedCustomersCount,
  ],
  (total, online, recent, verified) => ({
    total,
    online,
    recent,
    verified,
    metrics: [
      { label: 'Total Patients', value: total, icon: 'people' as const },
      { label: 'Online Now', value: online, icon: 'radio-button-on' as const },
      { label: 'New (30d)', value: recent, icon: 'person-add' as const },
      { label: 'Verified', value: verified, icon: 'checkmark-circle' as const },
    ],
  })
);
