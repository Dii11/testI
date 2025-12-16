import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import type { Customer } from '../../services/customersService';
import { customersService } from '../../services/customersService';

interface CustomersState {
  customers: Customer[];
  filteredCustomers: Customer[];
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  selectedCustomer: Customer | null;
}

const initialState: CustomersState = {
  customers: [],
  filteredCustomers: [],
  searchQuery: '',
  isLoading: false,
  error: null,
  selectedCustomer: null,
};

export const fetchCustomers = createAsyncThunk(
  'customers/fetchCustomers',
  async (_, { rejectWithValue }) => {
    try {
      const customers = await customersService.getCustomers();
      return customers;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const fetchCustomerDetails = createAsyncThunk(
  'customers/fetchCustomerDetails',
  async (customerId: string, { rejectWithValue }) => {
    try {
      const customer = await customersService.getCustomerById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }
      return customer;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

const customersSlice = createSlice({
  name: 'customers',
  initialState,
  reducers: {
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
      if (action.payload.trim() === '') {
        state.filteredCustomers = state.customers;
      } else {
        const query = action.payload.toLowerCase();
        state.filteredCustomers = state.customers.filter(
          customer =>
            `${customer.firstName} ${customer.lastName}`.toLowerCase().includes(query) ||
            customer.email.toLowerCase().includes(query)
        );
      }
    },
    setSelectedCustomer: (state, action: PayloadAction<Customer | null>) => {
      state.selectedCustomer = action.payload;
    },
    clearError: state => {
      state.error = null;
    },
    updateCustomerOnlineStatus: (
      state,
      action: PayloadAction<{ customerId: string; isOnline: boolean }>
    ) => {
      const customer = state.customers.find(c => c.id === action.payload.customerId);
      if (customer) {
        customer.isOnline = action.payload.isOnline;
      }
      const filteredCustomer = state.filteredCustomers.find(
        c => c.id === action.payload.customerId
      );
      if (filteredCustomer) {
        filteredCustomer.isOnline = action.payload.isOnline;
      }
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchCustomers.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCustomers.fulfilled, (state, action: PayloadAction<Customer[]>) => {
        state.isLoading = false;
        console.log('✅ Redux: Received customers:', action.payload);
        console.log('📊 Redux: Customers count:', action.payload.length || 0);
        state.customers = action.payload;
        state.filteredCustomers = action.payload;
        state.error = null;
        console.log(
          '🏪 Redux: State updated - customers:',
          state.customers.length,
          'filtered:',
          state.filteredCustomers.length
        );
      })
      .addCase(fetchCustomers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        console.error('🏪 Redux: Customers fetch failed:', action.payload);

        // Clear any existing customer data if the fetch failed
        const errorMessage = (action.payload as string) || '';
        if (errorMessage.includes('Authentication') || errorMessage.includes('Access denied')) {
          state.customers = [];
          state.filteredCustomers = [];
        }
      })
      .addCase(fetchCustomerDetails.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCustomerDetails.fulfilled, (state, action: PayloadAction<Customer>) => {
        state.isLoading = false;
        state.selectedCustomer = action.payload;
        state.error = null;
      })
      .addCase(fetchCustomerDetails.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSearchQuery, setSelectedCustomer, clearError, updateCustomerOnlineStatus } =
  customersSlice.actions;

export default customersSlice.reducer;
