import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice, createEntityAdapter, createAsyncThunk } from '@reduxjs/toolkit';

import type { Customer } from '../../services/customersService';
import { customersService } from '../../services/customersService';
import { doctorsService } from '../../services/doctorsService';
import type { RootState } from '../index';

import type { Doctor } from './doctorsSlice';

// Entity adapters for normalized storage
const doctorsAdapter = createEntityAdapter<Doctor>({
  // Sort by rating (descending), then by name
  sortComparer: (a, b) => {
    if (a.rating !== b.rating) return b.rating - a.rating;
    return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
  },
});

const customersAdapter = createEntityAdapter<Customer>({
  // Sort by last name, then by first name
  sortComparer: (a, b) => {
    const aName = `${a.lastName}, ${a.firstName}`;
    const bName = `${b.lastName}, ${b.firstName}`;
    return aName.localeCompare(bName);
  },
});

interface DoctorsEntityState {
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  filters: {
    specialty?: string;
    onlineOnly: boolean;
    verifiedOnly: boolean;
    minRating: number;
    maxPrice?: number;
  };
  lastFetch: number | null;
}

interface CustomersEntityState {
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  filters: {
    onlineOnly: boolean;
    verifiedOnly: boolean;
    ageRange?: { min: number; max: number };
    gender?: 'male' | 'female' | 'other';
  };
  lastFetch: number | null;
}

interface EntitiesState {
  doctors: DoctorsEntityState & ReturnType<typeof doctorsAdapter.getInitialState>;
  customers: CustomersEntityState & ReturnType<typeof customersAdapter.getInitialState>;
}

const initialDoctorsState: DoctorsEntityState = {
  searchQuery: '',
  isLoading: false,
  error: null,
  filters: {
    onlineOnly: false,
    verifiedOnly: false,
    minRating: 0,
  },
  lastFetch: null,
};

const initialCustomersState: CustomersEntityState = {
  searchQuery: '',
  isLoading: false,
  error: null,
  filters: {
    onlineOnly: false,
    verifiedOnly: false,
  },
  lastFetch: null,
};

const initialState: EntitiesState = {
  doctors: doctorsAdapter.getInitialState(initialDoctorsState),
  customers: customersAdapter.getInitialState(initialCustomersState),
};

// Async thunks for normalized doctors
export const fetchNormalizedDoctors = createAsyncThunk(
  'entities/fetchDoctors',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const lastFetch = state.entities.doctors.lastFetch;
      const now = Date.now();

      // Only refetch if more than 5 minutes have passed (cache strategy)
      if (lastFetch && now - lastFetch < 5 * 60 * 1000) {
        return { doctors: Object.values(state.entities.doctors.entities), cached: true };
      }

      const doctors = await doctorsService.getDoctors();
      return { doctors, cached: false };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const fetchNormalizedCustomers = createAsyncThunk(
  'entities/fetchCustomers',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const lastFetch = state.entities.customers.lastFetch;
      const now = Date.now();

      // Only refetch if more than 5 minutes have passed (cache strategy)
      if (lastFetch && now - lastFetch < 5 * 60 * 1000) {
        return { customers: Object.values(state.entities.customers.entities), cached: true };
      }

      const customers = await customersService.getCustomers();
      return { customers, cached: false };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

const entitiesSlice = createSlice({
  name: 'entities',
  initialState,
  reducers: {
    // Doctor reducers
    setDoctorsSearchQuery: (state, action: PayloadAction<string>) => {
      state.doctors.searchQuery = action.payload;
    },
    setDoctorsFilters: (state, action: PayloadAction<Partial<DoctorsEntityState['filters']>>) => {
      state.doctors.filters = { ...state.doctors.filters, ...action.payload };
    },
    updateDoctorOnlineStatus: (
      state,
      action: PayloadAction<{ doctorId: string; isOnline: boolean }>
    ) => {
      const { doctorId, isOnline } = action.payload;
      if (state.doctors.entities[doctorId]) {
        state.doctors.entities[doctorId]!.isOnline = isOnline;
      }
    },
    clearDoctorsError: state => {
      state.doctors.error = null;
    },

    // Customer reducers
    setCustomersSearchQuery: (state, action: PayloadAction<string>) => {
      state.customers.searchQuery = action.payload;
    },
    setCustomersFilters: (
      state,
      action: PayloadAction<Partial<CustomersEntityState['filters']>>
    ) => {
      state.customers.filters = { ...state.customers.filters, ...action.payload };
    },
    updateCustomerOnlineStatus: (
      state,
      action: PayloadAction<{ customerId: string; isOnline: boolean }>
    ) => {
      const { customerId, isOnline } = action.payload;
      if (state.customers.entities[customerId]) {
        state.customers.entities[customerId]!.isOnline = isOnline;
      }
    },
    clearCustomersError: state => {
      state.customers.error = null;
    },

    // Batch updates for performance
    updateMultipleDoctorsStatus: (
      state,
      action: PayloadAction<{ id: string; isOnline: boolean }[]>
    ) => {
      action.payload.forEach(({ id, isOnline }) => {
        if (state.doctors.entities[id]) {
          state.doctors.entities[id]!.isOnline = isOnline;
        }
      });
    },
    updateMultipleCustomersStatus: (
      state,
      action: PayloadAction<{ id: string; isOnline: boolean }[]>
    ) => {
      action.payload.forEach(({ id, isOnline }) => {
        if (state.customers.entities[id]) {
          state.customers.entities[id]!.isOnline = isOnline;
        }
      });
    },
  },
  extraReducers: builder => {
    // Doctors async thunks
    builder
      .addCase(fetchNormalizedDoctors.pending, state => {
        state.doctors.isLoading = true;
        state.doctors.error = null;
      })
      .addCase(fetchNormalizedDoctors.fulfilled, (state, action) => {
        state.doctors.isLoading = false;
        state.doctors.error = null;

        if (!action.payload.cached) {
          // Only update entities if not from cache
          doctorsAdapter.setAll(state.doctors, action.payload.doctors);
          state.doctors.lastFetch = Date.now();
        }
      })
      .addCase(fetchNormalizedDoctors.rejected, (state, action) => {
        state.doctors.isLoading = false;
        state.doctors.error = action.payload as string;
      });

    // Customers async thunks
    builder
      .addCase(fetchNormalizedCustomers.pending, state => {
        state.customers.isLoading = true;
        state.customers.error = null;
      })
      .addCase(fetchNormalizedCustomers.fulfilled, (state, action) => {
        state.customers.isLoading = false;
        state.customers.error = null;

        if (!action.payload.cached) {
          // Only update entities if not from cache
          customersAdapter.setAll(state.customers, action.payload.customers);
          state.customers.lastFetch = Date.now();
        }
      })
      .addCase(fetchNormalizedCustomers.rejected, (state, action) => {
        state.customers.isLoading = false;
        state.customers.error = action.payload as string;
      });
  },
});

export const {
  setDoctorsSearchQuery,
  setDoctorsFilters,
  updateDoctorOnlineStatus,
  clearDoctorsError,
  setCustomersSearchQuery,
  setCustomersFilters,
  updateCustomerOnlineStatus,
  clearCustomersError,
  updateMultipleDoctorsStatus,
  updateMultipleCustomersStatus,
} = entitiesSlice.actions;

// Export entity adapter selectors
export const {
  selectAll: selectAllNormalizedDoctors,
  selectById: selectNormalizedDoctorById,
  selectIds: selectDoctorIds,
  selectEntities: selectDoctorEntities,
  selectTotal: selectDoctorsTotal,
} = doctorsAdapter.getSelectors((state: RootState) => state.entities.doctors);

export const {
  selectAll: selectAllNormalizedCustomers,
  selectById: selectNormalizedCustomerById,
  selectIds: selectCustomerIds,
  selectEntities: selectCustomerEntities,
  selectTotal: selectCustomersTotal,
} = customersAdapter.getSelectors((state: RootState) => state.entities.customers);

export default entitiesSlice.reducer;
