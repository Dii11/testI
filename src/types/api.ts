export interface HealthSpecialist {
  id: string;
  firstName: string;
  lastName: string;
  specialistType: string;
  profilePicture?: string;
  isOnline: boolean;
  isVerified: boolean;
  rating: number | string;
  totalReviews: number | string;
  teleconsultationFee: number | string;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  profilePicture?: string;
  lastActivity: string;
}

export interface CustomerDto {
  id: string;
  userId: string;  // ✅ FIX: Added User ID (required for call initiation)
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  profilePicture?: string;
  isOnline: boolean;
  emailVerified: boolean;
  lastActivity?: string;
}

export interface HealthSpecialistDto {
  id: string;
  userId: string;  // ✅ FIX: Added User ID (required for call initiation)
  firstName: string;
  lastName: string;
  specialistType: string;
  profilePicture?: string;
  isOnline: boolean;
  isVerified: boolean;
  rating: number | string;
  totalReviews: number | string;
  teleconsultationFee: number | string;
}
