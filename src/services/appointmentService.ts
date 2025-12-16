import type {
  Appointment,
  CreateAppointmentRequest,
  ApiResponse,
  PaginationParams,
} from '../types';

import { apiService } from './api';

class AppointmentService {
  // Appointment Management
  async createAppointment(
    appointmentData: CreateAppointmentRequest
  ): Promise<ApiResponse<Appointment>> {
    return await apiService.post<Appointment>('/appointments', appointmentData);
  }

  async getMyAppointments(
    params: PaginationParams & {
      status?: string;
      upcoming?: boolean;
      past?: boolean;
    } = {}
  ): Promise<
    ApiResponse<{
      appointments: Appointment[];
      total: number;
      upcoming: number;
      past: number;
      cancelled: number;
    }>
  > {
    return await apiService.get<{
      appointments: Appointment[];
      total: number;
      upcoming: number;
      past: number;
      cancelled: number;
    }>('/appointments/my-appointments', params);
  }

  async getAppointmentById(appointmentId: number): Promise<ApiResponse<Appointment>> {
    return await apiService.get<Appointment>(`/appointments/${appointmentId}`);
  }

  async updateAppointment(
    appointmentId: number,
    updateData: {
      symptoms?: string;
      notes?: string;
    }
  ): Promise<ApiResponse<Appointment>> {
    return await apiService.put<Appointment>(`/appointments/${appointmentId}`, updateData);
  }

  async cancelAppointment(appointmentId: number, reason?: string): Promise<ApiResponse<void>> {
    return await apiService.put<void>(`/appointments/${appointmentId}/cancel`, {
      cancellation_reason: reason,
    });
  }

  async rescheduleAppointment(
    appointmentId: number,
    newDate: string,
    reason?: string
  ): Promise<ApiResponse<Appointment>> {
    return await apiService.put<Appointment>(`/appointments/${appointmentId}/reschedule`, {
      new_appointment_date: newDate,
      reschedule_reason: reason,
    });
  }

  // Appointment Status Management
  async confirmAppointment(appointmentId: number): Promise<ApiResponse<void>> {
    return await apiService.put<void>(`/appointments/${appointmentId}/confirm`);
  }

  async markAsCompleted(appointmentId: number, notes?: string): Promise<ApiResponse<void>> {
    return await apiService.put<void>(`/appointments/${appointmentId}/complete`, {
      completion_notes: notes,
    });
  }

  async markAsNoShow(appointmentId: number): Promise<ApiResponse<void>> {
    return await apiService.put<void>(`/appointments/${appointmentId}/no-show`);
  }

  // Appointment Availability
  async checkAvailability(
    doctorId: number,
    date: string,
    duration: number = 30
  ): Promise<
    ApiResponse<{
      isAvailable: boolean;
      availableSlots: string[];
      nextAvailable: string;
    }>
  > {
    return await apiService.get<{
      isAvailable: boolean;
      availableSlots: string[];
      nextAvailable: string;
    }>('/appointments/check-availability', {
      doctor_id: doctorId,
      date,
      duration,
    });
  }

  async getAvailableSlots(
    doctorId: number,
    startDate: string,
    endDate: string,
    duration: number = 30
  ): Promise<
    ApiResponse<{
      [date: string]: string[];
    }>
  > {
    return await apiService.get<{
      [date: string]: string[];
    }>('/appointments/available-slots', {
      doctor_id: doctorId,
      start_date: startDate,
      end_date: endDate,
      duration,
    });
  }

  // Appointment History and Analytics
  async getAppointmentHistory(
    params: PaginationParams & {
      doctorId?: number;
      hospitalId?: number;
      status?: string;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<
    ApiResponse<{
      appointments: Appointment[];
      total: number;
      summary: {
        total: number;
        completed: number;
        cancelled: number;
        noShow: number;
      };
    }>
  > {
    return await apiService.get<{
      appointments: Appointment[];
      total: number;
      summary: {
        total: number;
        completed: number;
        cancelled: number;
        noShow: number;
      };
    }>('/appointments/history', params);
  }

  async getUpcomingAppointments(limit: number = 5): Promise<ApiResponse<Appointment[]>> {
    return await apiService.get<Appointment[]>('/appointments/upcoming', { limit });
  }

  async getTodaysAppointments(): Promise<ApiResponse<Appointment[]>> {
    return await apiService.get<Appointment[]>('/appointments/today');
  }

  // Appointment Reminders
  async getAppointmentReminders(): Promise<
    ApiResponse<
      {
        appointments: Appointment[];
        reminderTime: string;
      }[]
    >
  > {
    return await apiService.get<
      {
        appointments: Appointment[];
        reminderTime: string;
      }[]
    >('/appointments/reminders');
  }

  async updateReminderPreferences(preferences: {
    email: boolean;
    sms: boolean;
    push: boolean;
    reminderTimes: number[]; // hours before appointment
  }): Promise<ApiResponse<void>> {
    return await apiService.put<void>('/appointments/reminder-preferences', preferences);
  }

  // Appointment Documents and Files
  async uploadAppointmentDocument(
    appointmentId: number,
    fileUri: string,
    fileName: string,
    fileType: string
  ): Promise<
    ApiResponse<{
      file_id: number;
      file_url: string;
    }>
  > {
    const formData = new FormData();
    formData.append('document', {
      uri: fileUri,
      type: fileType,
      name: fileName,
    } as any);

    return await apiService.upload<{
      file_id: number;
      file_url: string;
    }>(`/appointments/${appointmentId}/documents`, formData);
  }

  async getAppointmentDocuments(appointmentId: number): Promise<
    ApiResponse<
      {
        file_id: number;
        file_name: string;
        file_url: string;
        file_size: number;
        uploaded_at: string;
      }[]
    >
  > {
    return await apiService.get<
      {
        file_id: number;
        file_name: string;
        file_url: string;
        file_size: number;
        uploaded_at: string;
      }[]
    >(`/appointments/${appointmentId}/documents`);
  }

  // Payment and Billing
  async getAppointmentBilling(appointmentId: number): Promise<
    ApiResponse<{
      appointment_fee: number;
      additional_charges: number;
      total_amount: number;
      payment_status: string;
      payment_method: string;
      paid_at?: string;
    }>
  > {
    return await apiService.get<{
      appointment_fee: number;
      additional_charges: number;
      total_amount: number;
      payment_status: string;
      payment_method: string;
      paid_at?: string;
    }>(`/appointments/${appointmentId}/billing`);
  }

  // Reviews and Feedback
  async submitAppointmentReview(
    appointmentId: number,
    rating: number,
    comment?: string
  ): Promise<ApiResponse<void>> {
    return await apiService.post<void>(`/appointments/${appointmentId}/review`, {
      rating,
      comment,
    });
  }

  async getAppointmentReview(appointmentId: number): Promise<
    ApiResponse<{
      rating: number;
      comment?: string;
      submitted_at: string;
    }>
  > {
    return await apiService.get<{
      rating: number;
      comment?: string;
      submitted_at: string;
    }>(`/appointments/${appointmentId}/review`);
  }
}

export const appointmentService = new AppointmentService();
export default appointmentService;
