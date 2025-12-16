import type { User } from '../types';

import { apiService } from './api';

export interface Customer extends User {
  userId: string; // ✅ CRITICAL: User ID required for call initiation
  healthContent?: string;
  isOnline?: boolean;
}

class CustomersService {
  async getCustomers(): Promise<Customer[]> {
    try {
      console.log('🚀 Fetching customers from backend API...');
      const response = await apiService.get<Customer[]>('/customers');
      console.log('🔍 Raw API Response:', JSON.stringify(response, null, 2));
      console.log('🔍 Raw API Response type:', typeof response);
      console.log('🔍 Raw API Response success:', response.success);
      console.log('📋 Response has data property:', !!response.data);
      console.log(
        '📋 Customers data type:',
        Array.isArray(response.data) ? 'array' : typeof response.data
      );
      console.log('📊 Customers count:', response.data?.length || 0);

      if (response.success && response.data && Array.isArray(response.data)) {
        if (response.data.length > 0) {
          console.log('✅ Using real API customers data');
          return response.data.map(customer => this.mapApiCustomerToInterface(customer));
        } else {
          console.warn('⚠️ API returned empty array - no customers found');
          return [];
        }
      }

      console.error('⚠️ API returned unexpected response structure:', response);
      console.error('❌ FORCING BACKEND DATA - Disabling mock fallback');
      throw new Error('Invalid API response format - Backend required');
    } catch (error: any) {
      console.error('❌ Error fetching customers:', error?.response?.status, error?.message);
      console.error('❌ Full error:', error);

      // Check if it's an authorization error
      if (error?.response?.status === 401) {
        console.error(
          '🔒 Authentication error - user may not be properly logged in as health specialist'
        );
        throw new Error('Authentication required. Please log in as a health specialist.');
      }

      if (error?.response?.status === 403) {
        console.error('🚫 Authorization error - user may not have health specialist role');
        throw new Error('Access denied. Health specialist role required.');
      }

      // Only use mock data if explicitly enabled
      if (__DEV__ && process.env.EXPO_USE_MOCK_CUSTOMERS === 'true') {
        console.warn('⚠️ Development mode: Using mock customers (EXPO_USE_MOCK_CUSTOMERS=true)');
        return this.getMockCustomers();
      }

      console.error('❌ BACKEND REQUIRED - Not using mock data');
      throw error;
    }
  }

  private mapApiCustomerToInterface(apiCustomer: any): Customer {
    return {
      id: apiCustomer.id,
      userId: apiCustomer.userId, // ✅ CRITICAL FIX: Include userId for call initiation
      email: apiCustomer.email,
      firstName: apiCustomer.firstName,
      lastName: apiCustomer.lastName,
      phoneNumber: apiCustomer.phoneNumber,
      dateOfBirth: apiCustomer.dateOfBirth,
      gender: apiCustomer.gender,
      address: apiCustomer.address,
      profilePicture: apiCustomer.profilePicture || `https://i.pravatar.cc/150?u=${apiCustomer.id}`,
      accountType: 'customer',
      emailVerified: apiCustomer.emailVerified,
      referralCode: apiCustomer.referralCode,
      countryCode: apiCustomer.countryCode,
      currency: apiCustomer.currency,
      createdAt: apiCustomer.createdAt,
      updatedAt: apiCustomer.updatedAt,
      healthContent: apiCustomer.healthContent,
      isOnline: apiCustomer.isOnline || false,
    };
  }

  private getMockCustomers(): Customer[] {
    return [
      {
        id: 'mock-customer-1',
        userId: 'mock-user-customer-1', // Mock userId for development
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: '+1-555-0111',
        dateOfBirth: '1985-06-15',
        gender: 'male',
        address: '123 Main St, New York, NY',
        profilePicture: 'https://i.pravatar.cc/150?img=11',
        accountType: 'customer',
        emailVerified: true,
        countryCode: 'US',
        currency: 'USD',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
        isOnline: true,
      },
      {
        id: 'mock-customer-2',
        userId: 'mock-user-customer-2', // Mock userId for development
        email: 'jane.smith@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        phoneNumber: '+1-555-0112',
        dateOfBirth: '1990-03-22',
        gender: 'female',
        address: '456 Oak Ave, Los Angeles, CA',
        profilePicture: 'https://i.pravatar.cc/150?img=12',
        accountType: 'customer',
        emailVerified: true,
        countryCode: 'US',
        currency: 'USD',
        createdAt: '2024-01-16T14:30:00Z',
        updatedAt: '2024-01-16T14:30:00Z',
        isOnline: false,
      },
      {
        id: 'mock-customer-3',
        userId: 'mock-user-customer-3', // Mock userId for development
        email: 'mike.johnson@example.com',
        firstName: 'Mike',
        lastName: 'Johnson',
        phoneNumber: '+1-555-0113',
        dateOfBirth: '1978-11-08',
        gender: 'male',
        address: '789 Pine St, Chicago, IL',
        profilePicture: 'https://i.pravatar.cc/150?img=13',
        accountType: 'customer',
        emailVerified: true,
        countryCode: 'US',
        currency: 'USD',
        createdAt: '2024-01-17T09:15:00Z',
        updatedAt: '2024-01-17T09:15:00Z',
        isOnline: true,
      },
    ];
  }

  async getCustomerById(customerId: string): Promise<Customer | null> {
    try {
      const response = await apiService.get<Customer>(`/customers/${customerId}`);
      return response.data || null;
    } catch (error) {
      console.error('Error fetching customer details:', error);
      throw error;
    }
  }

  async searchCustomers(query: string): Promise<Customer[]> {
    try {
      const response = await apiService.get<Customer[]>('/customers/search', { q: query });
      return response.data || [];
    } catch (error) {
      console.error('Error searching customers:', error);
      throw error;
    }
  }
}

export const customersService = new CustomersService();
export default customersService;
