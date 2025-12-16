import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { doctorsService } from '../../services/doctorsService';

export interface Doctor {
  id: string;
  userId: string; // ✅ CRITICAL: User ID required for call initiation
  firstName: string;
  lastName: string;
  specialistType: string;
  rating: number;
  totalReviews: number;
  teleconsultationFee: number;
  profilePicture?: string;
  isVerified: boolean;
  isOnline: boolean;
  email: string;
  phoneNumber?: string;
  agenda?: string;
  healthContent?: string;
}

interface DoctorsState {
  doctors: Doctor[];
  filteredDoctors: Doctor[];
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  selectedDoctor: Doctor | null;
}

const initialState: DoctorsState = {
  doctors: [],
  filteredDoctors: [],
  searchQuery: '',
  isLoading: false,
  error: null,
  selectedDoctor: null,
};

// Async thunk for fetching doctors from API
export const fetchDoctors = createAsyncThunk(
  'doctors/fetchDoctors',
  async (_, { rejectWithValue }) => {
    try {
      const doctors = await doctorsService.getDoctors();
      return doctors;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

// Async thunk for fetching doctor details
export const fetchDoctorDetails = createAsyncThunk(
  'doctors/fetchDoctorDetails',
  async (doctorId: string, { rejectWithValue }) => {
    try {
      const doctor = await doctorsService.getDoctorById(doctorId);
      if (!doctor) {
        throw new Error('Doctor not found');
      }
      return doctor;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

const doctorsSlice = createSlice({
  name: 'doctors',
  initialState,
  reducers: {
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
      // Filter doctors based on search query
      if (action.payload.trim() === '') {
        state.filteredDoctors = state.doctors;
      } else {
        const query = action.payload.toLowerCase();
        state.filteredDoctors = state.doctors.filter(
          doctor =>
            `${doctor.firstName} ${doctor.lastName}`.toLowerCase().includes(query) ||
            doctor.specialistType.toLowerCase().includes(query)
        );
      }
    },
    setSelectedDoctor: (state, action: PayloadAction<Doctor | null>) => {
      state.selectedDoctor = action.payload;
    },
    clearError: state => {
      state.error = null;
    },
    updateDoctorOnlineStatus: (
      state,
      action: PayloadAction<{ doctorId: string; isOnline: boolean }>
    ) => {
      const doctor = state.doctors.find(d => d.id === action.payload.doctorId);
      if (doctor) {
        doctor.isOnline = action.payload.isOnline;
      }
      // Update filtered doctors as well
      const filteredDoctor = state.filteredDoctors.find(d => d.id === action.payload.doctorId);
      if (filteredDoctor) {
        filteredDoctor.isOnline = action.payload.isOnline;
      }
    },
  },
  extraReducers: builder => {
    builder
      // Fetch doctors
      .addCase(fetchDoctors.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDoctors.fulfilled, (state, action: PayloadAction<Doctor[]>) => {
        state.isLoading = false;
        console.log('✅ Redux: Received doctors:', action.payload);
        console.log('📊 Redux: Doctors count:', action.payload.length || 0);
        state.doctors = action.payload;
        state.filteredDoctors = action.payload;
        state.error = null;
        console.log(
          '🏪 Redux: State updated - doctors:',
          state.doctors.length,
          'filtered:',
          state.filteredDoctors.length
        );
      })
      .addCase(fetchDoctors.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch doctor details
      .addCase(fetchDoctorDetails.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDoctorDetails.fulfilled, (state, action: PayloadAction<Doctor>) => {
        state.isLoading = false;
        state.selectedDoctor = action.payload;
        state.error = null;
      })
      .addCase(fetchDoctorDetails.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSearchQuery, setSelectedDoctor, clearError, updateDoctorOnlineStatus } =
  doctorsSlice.actions;

export default doctorsSlice.reducer;
