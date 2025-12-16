import type { Doctor } from '../store/slices/doctorsSlice';

import { apiService } from './api';

class DoctorsService {
  // Fetch all doctors (health specialists)
  async getDoctors(): Promise<Doctor[]> {
    try {
      const response = await apiService.get<Doctor[]>('/health-specialists');
      console.log('🔍 Raw API Response type:', typeof response);
      console.log('🔍 Raw API Response success:', response.success);
      console.log('📋 Response has data property:', !!response.data);
      console.log(
        '📋 Doctors data type:',
        Array.isArray(response.data) ? 'array' : typeof response.data
      );
      console.log('📊 Doctors count:', response.data?.length || 0);

      // Check if we have a successful API response
      if (response.success && response.data && Array.isArray(response.data)) {
        if (response.data.length > 0) {
          console.log('✅ Using real API doctors data');
          // Map the API response to match our Doctor interface
          return response.data.map(doctor => this.mapApiDoctorToInterface(doctor));
        } else {
          // API is working but no doctors in database - this should not happen with seeded data
          console.warn('⚠️ API returned empty array - database may not be seeded');
          return [];
        }
      }

      // If API response is malformed
      console.error('⚠️ API returned unexpected response structure:', response);
      throw new Error('Invalid API response format');
    } catch (error: any) {
      console.error('❌ Error fetching doctors:', error?.response?.status, error?.message);

      // Only fall back to mock data in development or if specifically configured
      if (__DEV__ && process.env.NODE_ENV !== 'production') {
        console.warn('⚠️ Development mode: API unavailable, using mock doctors for testing');
        return this.getMockDoctors();
      }

      // In production, throw the error to let the UI handle it properly
      throw error;
    }
  }

  // Map API doctor data to our Doctor interface
  private mapApiDoctorToInterface(apiDoctor: any): Doctor {
    // Parse health content to get specialization
    let specialization = this.formatSpecialistType(apiDoctor.specialistType);

    if (apiDoctor.healthContent) {
      try {
        const healthData = JSON.parse(apiDoctor.healthContent);
        if (healthData.specialization) {
          specialization = healthData.specialization;
        }
      } catch (error) {
        console.warn('Failed to parse healthContent for doctor:', apiDoctor.id);
      }
    }

    return {
      id: apiDoctor.id,
      userId: apiDoctor.userId, // ✅ CRITICAL FIX: Include userId for call initiation
      firstName: apiDoctor.firstName,
      lastName: apiDoctor.lastName,
      email: apiDoctor.email,
      phoneNumber: apiDoctor.phoneNumber,
      specialistType: specialization,
      teleconsultationFee: apiDoctor.teleconsultationFee,
      isVerified: apiDoctor.isVerified,
      rating: apiDoctor.rating,
      totalReviews: apiDoctor.totalReviews,
      isOnline: apiDoctor.isOnline,
      profilePicture: apiDoctor.profilePicture || `https://i.pravatar.cc/150?u=${apiDoctor.id}`,
      agenda: apiDoctor.agenda,
      healthContent: apiDoctor.healthContent,
    };
  }

  // Format specialist type for display (fallback for when healthContent is not available)
  private formatSpecialistType(type: string): string {
    const typeMap: Record<string, string> = {
      doctor: 'General Medicine',
      therapist: 'Therapy',
      nutritionist: 'Nutrition',
      sport_coach: 'Fitness Coaching',
    };
    return typeMap[type] || type;
  }

  // Keep mock data for development fallback only
  private getMockDoctors(): Doctor[] {
    return [
      {
        id: 'mock-1',
        userId: 'mock-user-1', // Mock userId for development
        firstName: 'Dr. Sarah',
        lastName: 'Johnson',
        specialistType: 'Cardiologist',
        rating: 4.8,
        totalReviews: 127,
        teleconsultationFee: 80,
        isVerified: true,
        isOnline: true,
        email: 'sarah.johnson@hopmed.com',
        phoneNumber: '+1-555-0123',
        profilePicture: 'https://i.pravatar.cc/150?img=1',
      },
      {
        id: 'mock-2',
        userId: 'mock-user-2', // Mock userId for development
        firstName: 'Dr. Michael',
        lastName: 'Chen',
        specialistType: 'Neurologist',
        rating: 4.9,
        totalReviews: 89,
        teleconsultationFee: 95,
        isVerified: true,
        isOnline: false,
        email: 'michael.chen@hopmed.com',
        phoneNumber: '+1-555-0124',
        profilePicture: 'https://i.pravatar.cc/150?img=2',
      },
      {
        id: 'mock-3',
        userId: 'mock-user-3', // Mock userId for development
        firstName: 'Dr. Emily',
        lastName: 'Rodriguez',
        specialistType: 'Dermatologist',
        rating: 4.7,
        totalReviews: 156,
        teleconsultationFee: 70,
        isVerified: true,
        isOnline: true,
        email: 'emily.rodriguez@hopmed.com',
        phoneNumber: '+1-555-0125',
        profilePicture: 'https://i.pravatar.cc/150?img=3',
      },
    ];
  }

  // Get doctor by ID
  async getDoctorById(doctorId: string): Promise<Doctor | null> {
    try {
      const response = await apiService.get<Doctor>(`/health-specialists/${doctorId}`);
      return response.data || null;
    } catch (error) {
      console.error('Error fetching doctor details:', error);
      throw error;
    }
  }

  // Search doctors
  async searchDoctors(query: string): Promise<Doctor[]> {
    try {
      const response = await apiService.get<Doctor[]>('/health-specialists/search', { q: query });
      return response.data || [];
    } catch (error) {
      console.error('Error searching doctors:', error);
      throw error;
    }
  }

  // Get doctors by specialty
  async getDoctorsBySpecialty(specialty: string): Promise<Doctor[]> {
    try {
      const response = await apiService.get<Doctor[]>('/health-specialists', { specialty });
      return response.data || [];
    } catch (error) {
      console.error('Error fetching doctors by specialty:', error);
      throw error;
    }
  }

  // Get available doctors (online)
  async getAvailableDoctors(): Promise<Doctor[]> {
    try {
      const response = await apiService.get<Doctor[]>('/health-specialists', { available: true });
      return response.data || [];
    } catch (error) {
      console.error('Error fetching available doctors:', error);
      throw error;
    }
  }
}

export const doctorsService = new DoctorsService();
export default doctorsService;
