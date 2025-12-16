import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { appointmentService } from '../../services/appointmentService';
import type { Appointment, CreateAppointmentRequest, PaginationParams } from '../../types';

interface AppointmentsState {
  appointments: Appointment[];
  upcomingAppointments: Appointment[];
  selectedAppointment: Appointment | null;
  isLoading: boolean;
  error: string | null;
  stats: {
    total: number;
    upcoming: number;
    past: number;
    cancelled: number;
  };
}

const initialState: AppointmentsState = {
  appointments: [],
  upcomingAppointments: [],
  selectedAppointment: null,
  isLoading: false,
  error: null,
  stats: {
    total: 0,
    upcoming: 0,
    past: 0,
    cancelled: 0,
  },
};

// Async thunks
export const createAppointment = createAsyncThunk(
  'appointments/create',
  async (appointmentData: CreateAppointmentRequest, { rejectWithValue }) => {
    try {
      const response = await appointmentService.createAppointment(appointmentData);
      if (response.success && response.data) {
        return response.data;
      }
      return rejectWithValue(response.message || 'Failed to create appointment');
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create appointment');
    }
  }
);

export const fetchMyAppointments = createAsyncThunk(
  'appointments/fetchMy',
  async (
    params: PaginationParams & { status?: string; upcoming?: boolean; past?: boolean } = {},
    { rejectWithValue }
  ) => {
    try {
      const response = await appointmentService.getMyAppointments(params);
      if (response.success && response.data) {
        return response.data;
      }
      return rejectWithValue(response.message || 'Failed to fetch appointments');
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch appointments');
    }
  }
);

export const fetchAppointmentById = createAsyncThunk(
  'appointments/fetchById',
  async (appointmentId: number, { rejectWithValue }) => {
    try {
      const response = await appointmentService.getAppointmentById(appointmentId);
      if (response.success && response.data) {
        return response.data;
      }
      return rejectWithValue(response.message || 'Failed to fetch appointment');
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch appointment');
    }
  }
);

export const fetchUpcomingAppointments = createAsyncThunk(
  'appointments/fetchUpcoming',
  async (limit: number = 5, { rejectWithValue }) => {
    try {
      const response = await appointmentService.getUpcomingAppointments(limit);
      if (response.success && response.data) {
        return response.data;
      }
      return rejectWithValue(response.message || 'Failed to fetch upcoming appointments');
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch upcoming appointments');
    }
  }
);

export const cancelAppointment = createAsyncThunk(
  'appointments/cancel',
  async (
    { appointmentId, reason }: { appointmentId: number; reason?: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await appointmentService.cancelAppointment(appointmentId, reason);
      if (response.success) {
        return appointmentId;
      }
      return rejectWithValue(response.message || 'Failed to cancel appointment');
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to cancel appointment');
    }
  }
);

export const rescheduleAppointment = createAsyncThunk(
  'appointments/reschedule',
  async (
    {
      appointmentId,
      newDate,
      reason,
    }: {
      appointmentId: number;
      newDate: string;
      reason?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await appointmentService.rescheduleAppointment(
        appointmentId,
        newDate,
        reason
      );
      if (response.success && response.data) {
        return response.data;
      }
      return rejectWithValue(response.message || 'Failed to reschedule appointment');
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to reschedule appointment');
    }
  }
);

export const updateAppointment = createAsyncThunk(
  'appointments/update',
  async (
    {
      appointmentId,
      updateData,
    }: {
      appointmentId: number;
      updateData: { symptoms?: string; notes?: string };
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await appointmentService.updateAppointment(appointmentId, updateData);
      if (response.success && response.data) {
        return response.data;
      }
      return rejectWithValue(response.message || 'Failed to update appointment');
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update appointment');
    }
  }
);

const appointmentsSlice = createSlice({
  name: 'appointments',
  initialState,
  reducers: {
    setSelectedAppointment: (state, action: PayloadAction<Appointment | null>) => {
      state.selectedAppointment = action.payload;
    },
    clearError: state => {
      state.error = null;
    },
    updateAppointmentStatus: (state, action: PayloadAction<{ id: number; status: string }>) => {
      const appointment = state.appointments.find(apt => apt.appointment_id === action.payload.id);
      if (appointment) {
        appointment.status = action.payload.status as any;
      }

      const upcomingAppointment = state.upcomingAppointments.find(
        apt => apt.appointment_id === action.payload.id
      );
      if (upcomingAppointment) {
        upcomingAppointment.status = action.payload.status as any;
      }
    },
    removeAppointmentFromList: (state, action: PayloadAction<number>) => {
      state.appointments = state.appointments.filter(apt => apt.appointment_id !== action.payload);
      state.upcomingAppointments = state.upcomingAppointments.filter(
        apt => apt.appointment_id !== action.payload
      );
    },
  },
  extraReducers: builder => {
    // Create appointment
    builder
      .addCase(createAppointment.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createAppointment.fulfilled, (state, action) => {
        state.isLoading = false;
        state.appointments.unshift(action.payload);
        state.upcomingAppointments.unshift(action.payload);
        state.stats.total += 1;
        state.stats.upcoming += 1;
        state.error = null;
      })
      .addCase(createAppointment.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch my appointments
    builder
      .addCase(fetchMyAppointments.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMyAppointments.fulfilled, (state, action) => {
        state.isLoading = false;
        state.appointments = action.payload.appointments;
        state.stats = {
          total: action.payload.total,
          upcoming: action.payload.upcoming,
          past: action.payload.past,
          cancelled: action.payload.cancelled,
        };
        state.error = null;
      })
      .addCase(fetchMyAppointments.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch appointment by ID
    builder
      .addCase(fetchAppointmentById.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAppointmentById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.selectedAppointment = action.payload;
        state.error = null;
      })
      .addCase(fetchAppointmentById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch upcoming appointments
    builder
      .addCase(fetchUpcomingAppointments.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUpcomingAppointments.fulfilled, (state, action) => {
        state.isLoading = false;
        state.upcomingAppointments = action.payload;
        state.error = null;
      })
      .addCase(fetchUpcomingAppointments.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Cancel appointment
    builder
      .addCase(cancelAppointment.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(cancelAppointment.fulfilled, (state, action) => {
        state.isLoading = false;
        const appointmentId = action.payload;

        // Update status in appointments list
        const appointment = state.appointments.find(apt => apt.appointment_id === appointmentId);
        if (appointment) {
          appointment.status = 'cancelled';
        }

        // Remove from upcoming appointments
        state.upcomingAppointments = state.upcomingAppointments.filter(
          apt => apt.appointment_id !== appointmentId
        );

        // Update stats
        if (state.stats.upcoming > 0) {
          state.stats.upcoming -= 1;
          state.stats.cancelled += 1;
        }

        state.error = null;
      })
      .addCase(cancelAppointment.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Reschedule appointment
    builder
      .addCase(rescheduleAppointment.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(rescheduleAppointment.fulfilled, (state, action) => {
        state.isLoading = false;
        const updatedAppointment = action.payload;

        // Update in appointments list
        const index = state.appointments.findIndex(
          apt => apt.appointment_id === updatedAppointment.appointment_id
        );
        if (index !== -1) {
          state.appointments[index] = updatedAppointment;
        }

        // Update in upcoming appointments
        const upcomingIndex = state.upcomingAppointments.findIndex(
          apt => apt.appointment_id === updatedAppointment.appointment_id
        );
        if (upcomingIndex !== -1) {
          state.upcomingAppointments[upcomingIndex] = updatedAppointment;
        }

        state.error = null;
      })
      .addCase(rescheduleAppointment.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Update appointment
    builder
      .addCase(updateAppointment.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateAppointment.fulfilled, (state, action) => {
        state.isLoading = false;
        const updatedAppointment = action.payload;

        // Update in appointments list
        const index = state.appointments.findIndex(
          apt => apt.appointment_id === updatedAppointment.appointment_id
        );
        if (index !== -1) {
          state.appointments[index] = updatedAppointment;
        }

        // Update selected appointment if it's the same
        if (state.selectedAppointment?.appointment_id === updatedAppointment.appointment_id) {
          state.selectedAppointment = updatedAppointment;
        }

        state.error = null;
      })
      .addCase(updateAppointment.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  setSelectedAppointment,
  clearError,
  updateAppointmentStatus,
  removeAppointmentFromList,
} = appointmentsSlice.actions;

export default appointmentsSlice.reducer;
